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

    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_MTIQRIS_MenuDomestic();

    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_GenQRIS(StringBuilder amount);

    [DllImport("POS4CAT_Ctl.dll")]
    public static extern int POS4EDC_ReqEchoTest();
}
