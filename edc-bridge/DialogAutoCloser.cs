using System.Runtime.InteropServices;
using System.Text;

namespace EdcBridge;

// Hides (does NOT click/close) every #32770 dialog this DLL creates, so nothing is ever
// visible on the kiosk screen -- without ever sending the dialog any input.
//
// Three earlier attempts all clicked/closed the dialog programmatically (skip-empty-title,
// require-IDOK-button, exact-body-text allow-list) and ALL of them broke real transactions,
// including the exact-text match clicking ONLY the confirmed-legitimate "Please check EDC
// display" dialog -- confirmed live, the very next COMStatus call returned a garbage code
// and the job failed within ~100ms of the click.
//
// Conclusion: these dialogs are owned entirely by POS4CAT_Ctl.dll's own state machine and
// it decides itself when to dismiss them (e.g. once the terminal actually responds to a
// card tap) -- clicking OK on its behalf short-circuits that internal flow no matter how
// carefully the target dialog is identified. The only safe intervention is therefore
// non-interactive: hide the window so the customer never sees it, but leave its message
// loop and button completely untouched so the DLL's own logic still drives it end to end.
//
// Runs on its OWN background thread, deliberately NOT a System.Windows.Forms.Timer -- a
// first attempt using one shared the same WM_TIMER-driven message queue that
// POS4CAT_Ctl.dll's fragile internal state machine depends on (see Program.cs), and
// transactions started failing within 2-4 seconds the moment that timer was added.
// EnumWindows/ShowWindow are safe to call cross-thread against another thread's window, so
// a plain polling thread avoids touching that queue.
public sealed class DialogAutoCloser : IDisposable
{
    private const string MessageBoxClassName = "#32770"; // standard Win32 dialog/MessageBox class
    private const int SW_HIDE = 0;

    private readonly Thread _thread;
    private volatile bool _stop;
    private readonly HashSet<IntPtr> _hidden = new();

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
            HideOwnDialogs();
        }
    }

    private void HideOwnDialogs()
    {
        var ownProcessId = (uint)Environment.ProcessId;
        var seenThisPoll = new HashSet<IntPtr>();

        EnumWindows((hWnd, _) =>
        {
            GetWindowThreadProcessId(hWnd, out var windowProcessId);
            if (windowProcessId != ownProcessId) return true; // only touch our own process's windows

            var classBuf = new StringBuilder(256);
            GetClassName(hWnd, classBuf, classBuf.Capacity);
            if (classBuf.ToString() != MessageBoxClassName) return true;

            if (!IsWindowVisible(hWnd)) return true; // already hidden (by us, or never shown)

            seenThisPoll.Add(hWnd);
            if (_hidden.Add(hWnd))
            {
                // First time seeing this window -- log what it says, purely for debugging,
                // then hide it. No click, no PostMessage, no WM_CLOSE: the DLL's own code
                // is left completely free to dismiss it whenever it decides to.
                Console.WriteLine($"[DialogAutoCloser] Hiding dialog (not closing): \"{GetChildText(hWnd)}\"");
            }
            ShowWindow(hWnd, SW_HIDE);
            return true;
        }, IntPtr.Zero);
    }

    // Concatenates the text of every child control (Static labels, buttons, etc.) --
    // logging only, this dialog's own title bar is always blank.
    private static string GetChildText(IntPtr hParent)
    {
        var sb = new StringBuilder();
        EnumChildWindows(hParent, (hChild, _) =>
        {
            var buf = new StringBuilder(512);
            GetWindowText(hChild, buf, buf.Capacity);
            if (buf.Length > 0) sb.Append(buf).Append(' ');
            return true;
        }, IntPtr.Zero);
        return sb.ToString().Trim();
    }

    public void Dispose()
    {
        _stop = true;
    }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
