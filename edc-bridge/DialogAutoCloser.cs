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
// Closes ANY #32770 dialog belonging to our own process — not just ones whose title
// mentions "error". The DLL isn't only showing error dialogs (confirmed live: a plain
// "Response Time Out" box, no "error" in its title, was seen slipping past the earlier
// title filter). A background thread targeting only our own process's windows carries no
// real risk of closing something unrelated.
public sealed class DialogAutoCloser : IDisposable
{
    private const string MessageBoxClassName = "#32770"; // standard Win32 dialog/MessageBox class
    private const uint WM_CLOSE = 0x0010;

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
            CloseOwnDialogs();
        }
    }

    private static void CloseOwnDialogs()
    {
        var ownProcessId = (uint)Environment.ProcessId;

        EnumWindows((hWnd, _) =>
        {
            GetWindowThreadProcessId(hWnd, out var windowProcessId);
            if (windowProcessId != ownProcessId) return true; // only touch our own process's windows

            var classBuf = new StringBuilder(256);
            GetClassName(hWnd, classBuf, classBuf.Capacity);
            if (classBuf.ToString() != MessageBoxClassName) return true;

            var titleBuf = new StringBuilder(256);
            GetWindowText(hWnd, titleBuf, titleBuf.Capacity);
            Console.WriteLine($"[DialogAutoCloser] Auto-closing native dialog: \"{titleBuf}\"");
            PostMessage(hWnd, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
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
}
