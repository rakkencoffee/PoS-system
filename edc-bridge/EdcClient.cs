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

// For simple service requests whose response data is just a short status string rather than
// a structured record (Echo Test, Any Transaction, Last Settlement, Audit/Summary Report --
// guide sections 2.4.10, 2.4.16 etc. all just say "Status: OK|SUCCESS" or similar).
public sealed record EdcSimpleResult
{
    public required bool Approved { get; init; }
    public required string ResponseCode { get; init; }
    public string? ErrorMessage { get; init; }
    public string? RawResponseData { get; init; }
}

public sealed record EdcQrisResult
{
    public required bool Approved { get; init; }
    public required string ResponseCode { get; init; }
    public string? ErrorMessage { get; init; }
    public string? RawResponseData { get; init; }

    // Parsed from RawResponseData (pipe-delimited), 16-field order per
    // POS4EDC Mandiri User Guide v1.12 sections 2.4.18-2.4.20 (Generate and
    // both Inquiry variants share this same format).
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
    public string? Tip { get; init; }
    public string? TotalAmount { get; init; }
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

        return ParseCardResult(cycle);
    }

    // "Resend Last Transaction" (Mandiri v1.12 guide section 2.2.16, POS4EDC_ReqLastReSend()
    // in the compilable C# sample). Candidate fix for the confirmed bug where COMStatus()
    // reports "Response Timeout" even though the EDC's own screen/printed receipt show the
    // transaction genuinely APPROVED: call this right after a Purchase() that came back
    // FAILED/timed-out, to see if it can retrieve the real result the original call's
    // COMStatus() failed to relay.
    // Tested live 2026-09-10 against a transaction that had ALREADY come back cleanly
    // APPROVED (approvalCode 142127) -- this function genuinely round-trips to the host
    // (confirmed via the "Error response from Host" dialog it triggered), and the host
    // rejected it, most likely because there was nothing ambiguous to resend. This was the
    // wrong test case: this function's real purpose only shows up during an actual ambiguous
    // COMStatus() garbage-code event, not after an already-clean result. Still needs a live
    // trial the next time that bug recurs naturally, tried BEFORE falling back to manual
    // ResolveEdcJob.ps1 -- if it can recover the real result automatically, that replaces the
    // manual-flip workflow entirely.
    public EdcResult GetLastTransaction()
    {
        var cycle = RunCycle(() => Pos4CatNative.POS4EDC_ReqLastReSend());
        return ParseCardResult(cycle);
    }

    // Shared by Purchase and GetLastTransaction -- both return the same pipe-delimited
    // format per guide section 2.4.1 (assuming GetLastTransaction really does mirror
    // Purchase's own format -- unconfirmed, see caveat above).
    private static EdcResult ParseCardResult((bool Approved, string ResponseCode, string? RawData, string? Error) cycle)
    {
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

    // Per POS4EDC Mandiri User Guide v1.12 section 2.2.21: GenQRIS is called
    // directly, no MenuDomestic prerequisite (that function isn't documented
    // anywhere in the Mandiri-specific guide -- it was carried over from an
    // older, generic MTI doc and is a likely culprit behind past QRIS
    // failures, alongside the GenQRIS arity mismatch fixed in Pos4CatNative).
    public EdcQrisResult GenerateQris(string amountRupiah, string cashoutAmount = "0")
    {
        var cycle = RunCycle(() => Pos4CatNative.POS4EDC_GenQRIS(Buf(amountRupiah), Buf(cashoutAmount)));
        return ParseQrisResult(cycle);
    }

    // QRIS payment is asynchronous -- the customer pays via their own
    // e-wallet/m-banking app after scanning, so GenerateQris() alone never
    // confirms settlement. Call one of these afterward (poll on an interval)
    // to find out whether the customer actually completed payment.
    // Tested live 2026-09-10: called right after a clean GenerateQris APPROVED
    // (ref 625387497216) -- returned identical data for every field, no host
    // rejection (unlike the card-side ReqLastReSend, which triggers a real
    // host round-trip and gets rejected on an already-settled transaction).
    // Confirms EdcDaemon's existing retry-on-ambiguous-result path is sound.
    public EdcQrisResult InquiryQrisLastTransaction()
    {
        var cycle = RunCycle(() => Pos4CatNative.POS4EDC_QRISInqLastTrans());
        return ParseQrisResult(cycle);
    }

    // DANGER -- confirmed live 2026-09-10: crashes the whole process with a native access
    // violation. See the DANGER comment on Pos4CatNative.POS4EDC_QRISInqAnyTrans. Do not call
    // this until Yokke confirms the real signature.
    public EdcQrisResult InquiryQrisAnyTransaction()
    {
        var cycle = RunCycle(() => Pos4CatNative.POS4EDC_QRISInqAnyTrans());
        return ParseQrisResult(cycle);
    }

    // UNTESTED -- see the parameter-meaning caveat on
    // Pos4CatNative.POS4EDC_RefundQRIS (doc's narrative text and C# sample
    // disagree on whether this takes a Reff No or an amount).
    public EdcQrisResult RefundQris(string amountOrReffNo)
    {
        var cycle = RunCycle(() => Pos4CatNative.POS4EDC_RefundQRIS(Buf(amountOrReffNo)));
        return ParseQrisResult(cycle);
    }

    // Shared by Generate and both Inquiry variants -- all three return the
    // same 16-field pipe-delimited format per guide sections 2.4.18-2.4.20.
    private static EdcQrisResult ParseQrisResult((bool Approved, string ResponseCode, string? RawData, string? Error) cycle)
    {
        if (cycle.Error is not null)
            return new EdcQrisResult { Approved = false, ResponseCode = cycle.ResponseCode, ErrorMessage = cycle.Error, RawResponseData = cycle.RawData };

        var fields = cycle.RawData!.Split('|');
        string? At(int i) => i < fields.Length ? fields[i] : null;

        return new EdcQrisResult
        {
            Approved = cycle.Approved,
            ResponseCode = cycle.ResponseCode,
            RawResponseData = cycle.RawData,
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
            Tip = At(14),
            TotalAmount = At(15),
        };
    }

    // "Purchase Void" (guide section 2.2.2) -- reverses a prior card transaction identified by
    // its own trace number (from that transaction's own EdcResult.TraceNumber), not amount.
    // Tested live 2026-09-10: voided trace 000134 (the Rp1.000 test Purchase, approvalCode
    // 142127) -- returned a clean ResponseCode 00, raw data echoed "VOID SALE" with the exact
    // same trace/reference/approval code. Confirmed working as documented.
    public EdcSimpleResult Void(string traceNumber)
    {
        var cycle = RunCycle(() => Pos4CatNative.POS4EDC_Void(Buf(traceNumber)));
        return new EdcSimpleResult
        {
            Approved = cycle.Approved,
            ResponseCode = cycle.ResponseCode,
            ErrorMessage = cycle.Error,
            RawResponseData = cycle.RawData,
        };
    }

    // "Refund" (guide section 2.2.3) -- credits the cardholder the given amount. Unlike Void,
    // this takes an amount rather than a trace number and isn't necessarily tied to a specific
    // prior transaction -- UNTESTED which transaction (if any) it reconciles against.
    public EdcSimpleResult Refund(string amountRupiah)
    {
        var cycle = RunCycle(() => Pos4CatNative.POS4EDC_Refund(Buf(amountRupiah)));
        return new EdcSimpleResult
        {
            Approved = cycle.Approved,
            ResponseCode = cycle.ResponseCode,
            ErrorMessage = cycle.Error,
            RawResponseData = cycle.RawData,
        };
    }

    // "Echo Test" (guide section 2.2.14) -- pings the EDC/host with no financial side effect,
    // response data per section 2.4.16 is RESP|EDC TYPE|APP NAME|VERSION. Useful as a
    // zero-risk connectivity check independent of the COMStatus garbage-code bug, since a
    // clean 0/-1/-2 here with no money involved narrows down whether the bug is tied
    // specifically to financial request types or affects every service request equally.
    public EdcSimpleResult EchoTest()
    {
        var cycle = RunCycle(() => Pos4CatNative.POS4EDC_ReqEchoTest());
        return new EdcSimpleResult
        {
            Approved = cycle.Approved,
            ResponseCode = cycle.ResponseCode,
            ErrorMessage = cycle.Error,
            RawResponseData = cycle.RawData,
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
