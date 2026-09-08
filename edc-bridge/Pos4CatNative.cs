using System.Runtime.InteropServices;
using System.Text;

namespace EdcBridge;

// P/Invoke signatures per POS4EDC User Guide v108 (DLL), section 3.1 "VISUAL C#" sample.
// POS4CAT_Ctl.dll is 32-bit — this project must build with PlatformTarget=x86.
internal static class Pos4CatNative
{
    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_COMCreate();

    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_COMStatus();

    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_ServiceTerminate();

    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_GetResponseCode(StringBuilder resCode);

    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_GetResponseData(StringBuilder resData);

    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_Purchase(
        StringBuilder amount, StringBuilder addAmount,
        StringBuilder optCode1, StringBuilder optCode2, StringBuilder optCode3,
        StringBuilder optCode4, StringBuilder optCode5, StringBuilder optCode6,
        StringBuilder optCode7, StringBuilder optCode8, StringBuilder optCode9,
        StringBuilder optCode10);

    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_Void(StringBuilder traceNumber);

    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_Refund(StringBuilder amount);

    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_Settlement();

    // Declared per the older, generic MTI doc -- superseded for Mandiri by
    // POS4EDC Mandiri User Guide v1.12, which doesn't mention this function
    // at all. Left declared (harmless, unused) rather than deleted in case
    // some other undocumented path still needs it; EdcClient no longer calls
    // it before GenQRIS.
    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_MTIQRIS_MenuDomestic();

    // Per POS4EDC Mandiri User Guide v1.12 section 2.2.21 / section 3.1 C#
    // sample (line ~2348) -- the older generic doc our first implementation
    // was built against declared only a single `amount` parameter, a
    // P/Invoke arity mismatch that corrupts the native call stack. amount =
    // purchase amount, cashout = TIP/cashout amount (pass "0" if unused).
    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_GenQRIS(StringBuilder amount, StringBuilder cashout);

    // New in the Mandiri v1.12 doc (sections 2.2.22/2.2.23) -- QRIS payment is
    // asynchronous (customer pays via their own e-wallet/m-banking app after
    // scanning), so GenQRIS alone never confirms settlement. One of these
    // must be polled afterward to find out whether the customer actually paid.
    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_QRISInqLastTrans();

    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_QRISInqAnyTrans();

    // Mandiri v1.12 section 2.2.24 (narrative text) documents this taking a
    // "Reff No" string, but the section 3.1 C# DllImport sample (line ~2350)
    // declares a bare `StringBuilder amount` parameter instead -- the two
    // parts of the vendor doc disagree on what this parameter actually is.
    // Matches the compilable C# sample since that's more likely accurate to
    // the real export than descriptive prose; UNTESTED either way, verify
    // against a real refund before relying on it.
    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_RefundQRIS(StringBuilder amountOrReffNo);

    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_ReqEchoTest();

    // "Resend Last Transaction" (Mandiri v1.12 guide section 2.2.16) -- retrieves the
    // result of the most recent transaction. Candidate fix for the confirmed bug where
    // COMStatus() times out ("Response Timeout") even though the EDC's own screen and
    // printed receipt show the transaction genuinely APPROVED -- both for card Purchase
    // and QRIS, reproduced live 2026-09-07. UNTESTED -- the doc's own response-data
    // format table for this function just says "Status: OK|SUCCESS", so it's unclear
    // whether GetResponseData() after this returns full transaction detail (matching
    // Purchase's own format) or only a bare status string. Named ReqLastSend() in the
    // guide's narrative section 2.2.16 but ReqLastReSend() in both the table of
    // contents and the compilable C# sample (line ~2320) -- matching the sample.
    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_ReqLastReSend();
}
