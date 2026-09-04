using System.Runtime.InteropServices;
using System.Text;

namespace EdcBridge;

// POS4CAT_Ctl.dll occasionally shows a native Win32 MessageBox for certain error conditions
// (e.g. "Error response from Host") — confirmed live: it froze the daemon indefinitely waiting
// for someone to click OK, which never happens on an unattended kiosk PC.
//
// This runs on its OWN background thread, deliberately NOT a System.Windows.Forms.Timer —
// a first attempt using one shared the same WM_TIMER-driven message queue that
// POS4CAT_Ctl.dll's fragile internal state machine depends on (see Program.cs), and
// transactions started failing within 2-4 seconds (before a card could ever be tapped) the
// moment that timer was added. EnumWindows/PostMessage are safe to call cross-thread against
// another thread's window, so a plain polling thread avoids touching that queue at all.
//
// Dismisses #32770 dialogs belonging to our own process by clicking their IDOK button —
// e.g. "Error response from Host" or "Please check EDC display" (both title-less; the
// window TITLE bar is blank on every dialog this DLL shows, only the body text differs,
// so title text can't be used to tell dialogs apart — see below).
//
// Only acts on dialogs that actually have an IDOK button (id 1) among their children.
// Confirmed live: this DLL also creates a title-less, BUTTON-less #32770 window as part of
// its own internal wait/processing state — closing that one (an earlier attempt sent
// WM_CLOSE to every #32770 window, no distinction) made every transaction fail with a
// garbage COMStatus code within ~100ms, before a card could ever be tapped. Requiring an
// IDOK child is what separates a real, dismissable message box from that internal window.
//
// Clicks IDOK rather than sending WM_CLOSE: closing a dialog (the X button / Escape)
// resolves to whatever the dialog's default/Cancel action is, which is not always
// equivalent to acknowledging it — confirmed live, "Please check EDC display" has both
// OK and Cancel, and this is purely an informational prompt telling the operator to look
// at the terminal, not a failure state that should abort the transaction.
//
// Runs on its OWN background thread, deliberately NOT a System.Windows.Forms.Timer — a
// first attempt using one shared the same WM_TIMER-driven message queue that
// POS4CAT_Ctl.dll's fragile internal state machine depends on (see Program.cs), and
// transactions started failing within 2-4 seconds the moment that timer was added.
// EnumWindows/PostMessage/GetDlgItem are safe to call cross-thread against another
// thread's window, so a plain polling thread avoids touching that queue at all.
public sealed class DialogAutoCloser : IDisposable
{
    private const string MessageBoxClassName = "#32770"; // standard Win32 dialog/MessageBox class
    private const int IDOK = 1;
    private const uint BM_CLICK = 0x00F5;

    private readonly Thread _thread;
    private volatile bool _stop;

    public DialogAutoCloser(int pollIntervalMs = 100)
    {
        _thread = new Thread(() => PollLoop(pollIntervalMs)) { IsBackground = true };
        _thread.Start();
    }

    private void PollLoop(int pollIntervalMs)
    {
        while (!_stop)
        {
            Thread.Sleep(pollIntervalMs);
            if (_stop) return;
            DismissOwnDialogs();
        }
    }

    private static void DismissOwnDialogs()
    {
        var ownProcessId = (uint)Environment.ProcessId;

        EnumWindows((hWnd, _) =>
        {
            GetWindowThreadProcessId(hWnd, out var windowProcessId);
            if (windowProcessId != ownProcessId) return true; // only touch our own process's windows

            var classBuf = new StringBuilder(256);
            GetClassName(hWnd, classBuf, classBuf.Capacity);
            if (classBuf.ToString() != MessageBoxClassName) return true;

            var okButton = GetDlgItem(hWnd, IDOK);
            if (okButton == IntPtr.Zero) return true; // no OK button -- not a real message box, leave it alone

            var titleBuf = new StringBuilder(256);
            GetWindowText(hWnd, titleBuf, titleBuf.Capacity);
            Console.WriteLine($"[DialogAutoCloser] Auto-dismissing native dialog (title=\"{titleBuf}\")");
            PostMessage(okButton, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
            return true;
        }, IntPtr.Zero);
    }

    public void Dispose()
    {
        _stop = true;
    }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern IntPtr GetDlgItem(IntPtr hDlg, int nIDDlgItem);
}
