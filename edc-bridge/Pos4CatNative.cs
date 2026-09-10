using System.Runtime.InteropServices;
using System.Text;

namespace EdcBridge;

// P/Invoke signatures per POS4EDC User Guide v108 (DLL), section 3.1 "VISUAL C#" sample.
// POS4CAT_Ctl.dll is 32-bit — this project must build with PlatformTarget=x86.
//
// Tried CallingConvention.Cdecl on every entry point (2026-09-08) as a hypothesis for the
// huge, closely-clustered garbage COMStatus()/GetResponseCode() values (e.g. 47704772,
// 51899420 -- spec only documents 0/-1/-2) that don't match any documented return code.
// Live-tested and DISPROVEN: garbage persisted unchanged with Cdecl (just a different
// range), so reverted to the default StdCall the vendor's own sample uses. Root cause of
// the garbage values is still unknown -- see Pesan_Yokke_ResponseTimeout.txt.
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

    // DANGER -- confirmed live 2026-09-10 to crash the whole process with a native access
    // violation (0xC0000005) the instant it's called, zero-arg exactly as documented. Same
    // failure signature as the GenQRIS arity mismatch found earlier (doc said 1 param, real
    // export needed 2) -- likely this export's real signature also takes an undocumented
    // parameter. Do NOT call this until Yokke confirms the actual signature; QRISInqLastTrans
    // (same section family, tested working with zero args) is not a safe stand-in assumption.
    //
    // Aftermath observed live: the crash killed the managed EdcBridge.exe process but left its
    // native POS4CAT.exe helper (spawned by the preceding COMCreate) running as an orphan,
    // holding the COM port open -- every subsequent EDC call failed with COMCreate ret=-2 and
    // an empty "COM PORT=[\\.\]" in catlog (looks identical to the empty-ini-value bug, but is
    // actually just the stale process squatting on the port). Fix: Task Manager / `Get-Process
    // POS4CAT` and kill it before retrying.
    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_QRISInqAnyTrans();

    // Mandiri v1.12 section 2.2.24 (narrative text) documents this taking a
    // "Reff No" string, but the section 3.1 C# DllImport sample (line ~2350)
    // declares a bare `StringBuilder amount` parameter instead (likely just a
    // copy-pasted variable name in their sample, not the real semantics).
    // RESOLVED live 2026-09-10: passed the original transaction's own
    // ReferenceNumber (625387497216, from a prior GenerateQris) -- refund
    // succeeded cleanly (StatusTransaksi SUKSES, TransactionName "QRIS
    // REFUND", money genuinely credited back). Confirmed it takes a Reff No,
    // matching the narrative doc, not an amount.
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
