using System.Runtime.InteropServices;
using System.Text;

namespace EdcBridge;

// Watches for every #32770 dialog POS4CAT_Ctl.dll shows and keeps it above
// whatever else is on screen -- purely a z-order nudge, never clicks or hides
// anything. Renamed from `DialogAutoCloser` (which used to paint a white
// overlay ON TOP of these dialogs to hide them from customers) once that
// approach was abandoned -- see start-kiosk.ps1's 2026-09-15 note: some
// dialogs (e.g. "Error response from Host") block POS4CAT_Ctl.dll from
// accepting the next request until a human clicks OK, so hiding them meant
// nobody ever could, permanently wedging the terminal. Dialogs are meant to
// render normally now, visible to staff/customers -- this class exists only
// because they can end up BEHIND the kiosk browser's own window.
//
// History (still applies -- do not add auto-click logic back): earlier
// versions auto-clicked OK on two dialogs believed "safe" ("Initialize EDC
// communicate", "Error response from Host"), since letting them sit unclicked
// was observed to hang the transaction indefinitely. That auto-click was
// tried two ways -- a raw BM_CLICK message, then a real WM_LBUTTONDOWN/UP
// mouse simulation at the confirmed correct "OK" button (control ID 1,
// verified via GetWindowText, not "Cancel") -- and BOTH reproducibly
// corrupted the very next POS4EDC_COMStatus() call into returning huge
// undocumented garbage codes (e.g. 5760392, 12050960, 46916768) instead of
// the documented 0/-1/-2. A real human mouse click on the exact same dialog
// never triggered this, tested repeatedly live 2026-09-10. This needs to go
// back to Yokke as its own question -- why do these dialogs appear at all
// when their sample never handles them, and how should an unattended ECR
// suppress or dismiss them safely? See Pesan_Yokke_ResponseTimeout.txt.
//
// Why kiosk browsers can cover these dialogs: they launch as
// `chrome.exe --kiosk` (fullscreen, see start-kiosk.ps1), a completely
// separate process from EdcBridge.exe. Nothing hides the EDC dialog on
// purpose -- it's just two unrelated top-level windows, and Windows doesn't
// automatically prefer one's z-order over the other. Re-asserting
// HWND_TOPMOST via SetWindowPos (not SetForegroundWindow, which is subject to
// Windows' foreground-stealing restrictions for a background process with no
// active window of its own, and would likely silently no-op here) brings it
// back above the kiosk browser without touching the dialog's content/controls
// at all -- same safety property the old covering-overlay approach had.
//
// Runs its polling on its OWN background thread, deliberately NOT a
// System.Windows.Forms.Timer -- a first attempt using one for the old
// covering-overlay version of this class shared the same WM_TIMER-driven
// message queue that POS4CAT_Ctl.dll's fragile internal state machine depends
// on (see Program.cs), and transactions started failing within 2-4 seconds
// the moment that timer was added. EnumWindows/GetWindowRect/SetWindowPos are
// all safe to call cross-thread; this class touches no UI thread/Form at all.
public sealed class DialogForegrounder : IDisposable
{
    private const string DialogClassName = "#32770"; // standard Win32 dialog/MessageBox class

    private readonly Thread _thread;
    private volatile bool _stop;

    public DialogForegrounder(int pollIntervalMs = 100)
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
            BringOwnDialogsToFront();
        }
    }

    private static void BringOwnDialogsToFront()
    {
        var ownProcessId = (uint)Environment.ProcessId;

        EnumWindows((hWnd, _) =>
        {
            GetWindowThreadProcessId(hWnd, out var windowProcessId);
            if (windowProcessId != ownProcessId) return true; // only touch our own process's windows

            var classBuf = new StringBuilder(256);
            GetClassName(hWnd, classBuf, classBuf.Capacity);
            if (classBuf.ToString() != DialogClassName) return true;

            if (!IsWindowVisible(hWnd)) return true;

            // Re-asserted every poll tick (not just once) in case the kiosk
            // browser keeps regaining topmost/foreground on its own -- cheap
            // no-op if the dialog is already on top.
            SetWindowPos(hWnd, HwndTopmost, 0, 0, 0, 0, SwpNoMove | SwpNoSize | SwpShowWindow);
            return true;
        }, IntPtr.Zero);
    }

    public void Dispose()
    {
        _stop = true;
    }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    private static readonly IntPtr HwndTopmost = new(-1);
    private const uint SwpNoMove = 0x0002;
    private const uint SwpNoSize = 0x0001;
    private const uint SwpShowWindow = 0x0040;

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}
