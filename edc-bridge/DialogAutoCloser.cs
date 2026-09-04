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
// Closes #32770 dialogs belonging to our own process that have an actual title — e.g.
// "Error response from Host" or "Response Time Out". Deliberately skips untitled #32770
// windows: closing ALL of them (no title filter at all) turned out to also catch a
// title-less window the DLL creates as part of its normal internal wait/processing —
// confirmed live, every single transaction started failing with a garbage COMStatus code
// within ~100ms the moment that untitled window got closed, before the customer could ever
// tap a card. A background thread targeting only our own process's windows carries no real
// risk of closing something unrelated to this daemon.
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
            var title = titleBuf.ToString();
            if (string.IsNullOrWhiteSpace(title)) return true; // internal/status window, not a real message

            Console.WriteLine($"[DialogAutoCloser] Auto-closing native dialog: \"{title}\"");
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
