using System.Text;

namespace EdcBridge;

public sealed record EdcResult
{
    public required bool Approved { get; init; }
    public required string ResponseCode { get; init; }
    public string? ErrorMessage { get; init; }
    public string? RawResponseData { get; init; }

    // Parsed from RawResponseData (pipe-delimited), Purchase/Manual Purchase field order per user guide 2.4.1.
    public string? TerminalId { get; init; }
    public string? MerchantId { get; init; }
    public string? CardType { get; init; }
    public string? Pan { get; init; }
    public string? EntryCode { get; init; }
    public string? TransactionType { get; init; }
    public string? BatchNumber { get; init; }
    public string? TraceNumber { get; init; }
    public string? TransactionDate { get; init; }
    public string? TransactionTime { get; init; }
    public string? ReferenceNumber { get; init; }
    public string? ApprovalCode { get; init; }
    public string? TotalAmount { get; init; }
}

public sealed record EdcQrisResult
{
    public required bool Approved { get; init; }
    public required string ResponseCode { get; init; }
    public string? ErrorMessage { get; init; }
    public string? RawResponseData { get; init; }

    // Parsed from RawResponseData (pipe-delimited), QRIS Generate field order per user guide 2.4.26.
    public string? TerminalId { get; init; }
    public string? MerchantId { get; init; }
    public string? AcquirerName { get; init; }
    public string? MerchantPan { get; init; }
    public string? IssuerName { get; init; }
    public string? TransactionName { get; init; }
    public string? StatusTransaksi { get; init; }
    public string? ReferenceNumber { get; init; }
    public string? TransactionDate { get; init; }
    public string? TransactionTime { get; init; }
    public string? CustomerName { get; init; }
    public string? CustomerPan { get; init; }
    public string? ReferenceId { get; init; }
    public string? SaleAmount { get; init; }
}

// Thin wrapper around POS4CAT_Ctl.dll. Every service request is its own full
// COMCreate -> request -> COMStatus -> GetResponseCode -> GetResponseData -> ServiceTerminate
// cycle — confirmed from POS4EDC_Test.exe's own catlog, which always shows exactly one such
// cycle per single action, never chained. QRIS needs two such cycles back to back: one for
// MTIQRIS_MenuDomestic() (mirrors navigating Menu > QRIS > Domestik on the EDC's screen) and
// a second, separate one for GenQRIS() itself.
public sealed class EdcClient
{
    public EdcResult Purchase(string amountRupiah, string addAmount = "0", string? receiptLine1 = null)
    {
        var cycle = RunCycle(() => Pos4CatNative.POS4EDC_Purchase(
            Buf(amountRupiah),
            Buf(addAmount),
            Buf(receiptLine1 ?? string.Empty),
            Buf(), Buf(), Buf(),
            Buf(), Buf(), Buf(),
            Buf(), Buf(), Buf()));

        if (cycle.Error is not null)
            return new EdcResult { Approved = false, ResponseCode = cycle.ResponseCode, ErrorMessage = cycle.Error, RawResponseData = cycle.RawData };

        var fields = cycle.RawData!.Split('|');
        string? At(int i) => i < fields.Length ? fields[i] : null;

        return new EdcResult
        {
            Approved = cycle.Approved,
            ResponseCode = cycle.ResponseCode,
            RawResponseData = cycle.RawData,
            TerminalId = At(0),
            MerchantId = At(1),
            CardType = At(2),
            Pan = At(3),
            EntryCode = At(4),
            TransactionType = At(5),
            BatchNumber = At(6),
            TraceNumber = At(7),
            TransactionDate = At(8),
            TransactionTime = At(9),
            ReferenceNumber = At(10),
            ApprovalCode = At(11),
            TotalAmount = At(12),
        };
    }

    public EdcQrisResult GenerateQris(string amountRupiah)
    {
        var menuCycle = RunCycle(() => Pos4CatNative.POS4EDC_MTIQRIS_MenuDomestic());
        if (menuCycle.Error is not null)
            return new EdcQrisResult { Approved = false, ResponseCode = menuCycle.ResponseCode, ErrorMessage = $"MenuDomestic: {menuCycle.Error}", RawResponseData = menuCycle.RawData };

        var genCycle = RunCycle(() => Pos4CatNative.POS4EDC_GenQRIS(Buf(amountRupiah)));
        if (genCycle.Error is not null)
            return new EdcQrisResult { Approved = false, ResponseCode = genCycle.ResponseCode, ErrorMessage = genCycle.Error, RawResponseData = genCycle.RawData };

        var fields = genCycle.RawData!.Split('|');
        string? At(int i) => i < fields.Length ? fields[i] : null;

        return new EdcQrisResult
        {
            Approved = genCycle.Approved,
            ResponseCode = genCycle.ResponseCode,
            RawResponseData = genCycle.RawData,
            TerminalId = At(0),
            MerchantId = At(1),
            AcquirerName = At(2),
            MerchantPan = At(3),
            IssuerName = At(4),
            TransactionName = At(5),
            StatusTransaksi = At(6),
            ReferenceNumber = At(7),
            TransactionDate = At(8),
            TransactionTime = At(9),
            CustomerName = At(10),
            CustomerPan = At(11),
            ReferenceId = At(12),
            SaleAmount = At(13),
        };
    }

    // Input StringBuilder params are marshaled to a fixed-size native buffer sized by Capacity
    // (not just Length). GenQRIS crashed with 0xC0000005 when the buffer was sized to the exact
    // input string length — pad generously in case the DLL writes back into it.
    private static StringBuilder Buf(string value = "", int capacity = 64) => new(value, Math.Max(capacity, value.Length + 1));

    // One full COMCreate -> request -> COMStatus -> GetResponseCode -> GetResponseData ->
    // ServiceTerminate cycle for a single service request.
    private static (bool Approved, string ResponseCode, string? RawData, string? Error) RunCycle(Func<int> request)
    {
        var createRet = Pos4CatNative.POS4EDC_COMCreate();
        if (createRet != 0)
            return (false, createRet.ToString(), null, $"COMCreate failed (ret={createRet})");

        try
        {
            var requestRet = request();
            if (requestRet != 0)
                return (false, requestRet.ToString(), null, $"Request failed (ret={requestRet})");

            var statusRet = Pos4CatNative.POS4EDC_COMStatus();
            if (statusRet != 0)
                return (false, statusRet.ToString(), null, $"COMStatus failed (ret={statusRet})");

            var resCodeBuf = new StringBuilder(10);
            var codeRet = Pos4CatNative.POS4EDC_GetResponseCode(resCodeBuf);
            if (codeRet != 0)
                return (false, codeRet.ToString(), null, $"GetResponseCode failed (ret={codeRet})");

            var responseCode = resCodeBuf.ToString();
            var resDataBuf = new StringBuilder(1024);
            var dataRet = Pos4CatNative.POS4EDC_GetResponseData(resDataBuf);
            var approved = responseCode == "00";

            if (dataRet != 0)
            {
                var msg = approved
                    ? $"Approved but GetResponseData failed (ret={dataRet})"
                    : $"Declined (code={responseCode}), GetResponseData failed (ret={dataRet})";
                return (false, responseCode, null, msg);
            }

            return (approved, responseCode, resDataBuf.ToString(), null);
        }
        finally
        {
            Pos4CatNative.POS4EDC_ServiceTerminate();
        }
    }
}
