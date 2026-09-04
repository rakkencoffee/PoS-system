using System.Runtime.InteropServices;
using System.Text;

namespace EdcBridge;

// Dismisses ONLY the specific #32770 dialogs this DLL is known to show, matched by their
// body text (not window title -- every dialog this DLL shows has a BLANK title bar, title
// text can't tell them apart). Matched so far: "Error response from Host" and "Please
// check EDC display".
//
// Deliberately a strict allow-list, not "any dialog" or "any dialog with an OK button":
// this DLL ALSO creates a blank-title #32770 window with what looks like an OK-style
// button as part of its own internal wait/processing state. Both a bare title check and a
// "has an IDOK child" check ended up matching that window too -- confirmed live, twice,
// dismissing it made the transaction fail with a garbage COMStatus code within ~100ms,
// before a card could ever be tapped. Matching the actual message text is the only signal
// left that reliably tells them apart. Anything not on the list is left alone; new
// messages need to be added here once actually observed, not guessed at.
//
// Runs on its OWN background thread, deliberately NOT a System.Windows.Forms.Timer — a
// first attempt using one shared the same WM_TIMER-driven message queue that
// POS4CAT_Ctl.dll's fragile internal state machine depends on (see Program.cs), and
// transactions started failing within 2-4 seconds the moment that timer was added.
// EnumWindows/EnumChildWindows/PostMessage/GetDlgItem are safe to call cross-thread
// against another thread's window, so a plain polling thread avoids touching that queue.
public sealed class DialogAutoCloser : IDisposable
{
    private const string MessageBoxClassName = "#32770"; // standard Win32 dialog/MessageBox class
    private const int IDOK = 1;
    private const uint BM_CLICK = 0x00F5;

    // Substring match against the dialog's combined child control text (the message body).
    private static readonly string[] KnownDismissableMessages =
    {
        "Error response from Host",
        "Please check EDC display",
    };

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
            DismissKnownDialogs();
        }
    }

    private static void DismissKnownDialogs()
    {
        var ownProcessId = (uint)Environment.ProcessId;

        EnumWindows((hWnd, _) =>
        {
            GetWindowThreadProcessId(hWnd, out var windowProcessId);
            if (windowProcessId != ownProcessId) return true; // only touch our own process's windows

            var classBuf = new StringBuilder(256);
            GetClassName(hWnd, classBuf, classBuf.Capacity);
            if (classBuf.ToString() != MessageBoxClassName) return true;

            var bodyText = GetChildText(hWnd);
            var matched = Array.Find(KnownDismissableMessages, m => bodyText.Contains(m, StringComparison.OrdinalIgnoreCase));
            if (matched is null) return true; // not a message we recognize -- leave it alone

            var okButton = GetDlgItem(hWnd, IDOK);
            if (okButton == IntPtr.Zero) return true; // no OK button to click, nothing safe to do

            Console.WriteLine($"[DialogAutoCloser] Auto-dismissing known dialog: \"{matched}\"");
            PostMessage(okButton, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
            return true;
        }, IntPtr.Zero);
    }

    // Concatenates the text of every child control (Static labels, buttons, etc.) so the
    // dialog's message body can be matched even though the window's own title is blank.
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
        return sb.ToString();
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
    private static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern IntPtr GetDlgItem(IntPtr hDlg, int nIDDlgItem);
}
