using System.ComponentModel;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace EdcBridge;

// Covers every #32770 dialog POS4CAT_Ctl.dll shows -- purely visual, never clicks or hides
// anything. Customers should never see raw Win32 dialogs on the kiosk screen, but this DLL is
// closed-source and its own sample code (POS4EDC User Guide section 3.1) has ZERO
// dialog-handling logic at all -- it never expects a POS application to click anything.
//
// History: earlier versions of this class auto-clicked OK on two dialogs believed "safe"
// ("Initialize EDC communicate", "Error response from Host"), since letting them sit
// unclicked was observed to hang the transaction indefinitely. That auto-click was tried two
// ways -- a raw BM_CLICK message, then a real WM_LBUTTONDOWN/UP mouse simulation at the
// confirmed correct "OK" button (control ID 1, verified via GetWindowText, not "Cancel") --
// and BOTH reproducibly corrupted the very next POS4EDC_COMStatus() call into returning huge
// undocumented garbage codes (e.g. 5760392, 12050960, 46916768) instead of the documented
// 0/-1/-2. A real human mouse click on the exact same dialog never triggered this, tested
// repeatedly live 2026-09-10. Since neither click method is in the vendor's spec, the only
// defensible move is to stop deviating from it entirely: cover for visual cleanliness, but
// never interact. This needs to go back to Yokke as its own question -- why do these dialogs
// appear at all when their sample never handles them, and how should an unattended ECR
// suppress or dismiss them safely? See Pesan_Yokke_ResponseTimeout.txt.
//
// Runs its polling on its OWN background thread, deliberately NOT a System.Windows.Forms.Timer
// -- a first attempt using one shared the same WM_TIMER-driven message queue that
// POS4CAT_Ctl.dll's fragile internal state machine depends on (see Program.cs), and
// transactions started failing within 2-4 seconds the moment that timer was added.
// EnumWindows/GetWindowRect are safe to call cross-thread; actually creating/moving/closing the
// overlay Form is marshaled onto the UI thread (via uiThread) since Forms must live on the
// thread that pumps their messages -- that thread is already running Application.Run() for the
// hidden host form, so overlay windows share that same pump.
public sealed class DialogAutoCloser : IDisposable
{
    private const string DialogClassName = "#32770"; // standard Win32 dialog/MessageBox class

    private readonly ISynchronizeInvoke _uiThread;
    private readonly Thread _thread;
    private readonly Dictionary<IntPtr, Form> _overlays = new();
    private volatile bool _stop;

    public DialogAutoCloser(ISynchronizeInvoke uiThread, int pollIntervalMs = 100)
    {
        _uiThread = uiThread;
        _thread = new Thread(() => PollLoop(pollIntervalMs)) { IsBackground = true };
        _thread.Start();
    }

    private void PollLoop(int pollIntervalMs)
    {
        while (!_stop)
        {
            Thread.Sleep(pollIntervalMs);
            if (_stop) return;
            SyncDialogs();
        }
    }

    private void SyncDialogs()
    {
        var ownProcessId = (uint)Environment.ProcessId;
        var seen = new HashSet<IntPtr>();

        EnumWindows((hWnd, _) =>
        {
            GetWindowThreadProcessId(hWnd, out var windowProcessId);
            if (windowProcessId != ownProcessId) return true; // only touch our own process's windows

            var classBuf = new StringBuilder(256);
            GetClassName(hWnd, classBuf, classBuf.Capacity);
            if (classBuf.ToString() != DialogClassName) return true;

            if (!IsWindowVisible(hWnd)) return true;

            if (!GetWindowRect(hWnd, out var rect)) return true;
            seen.Add(hWnd);
            var bounds = Rectangle.FromLTRB(rect.Left, rect.Top, rect.Right, rect.Bottom);

            if (!_overlays.ContainsKey(hWnd))
            {
                Console.WriteLine("[DialogAutoCloser] Covering dialog on screen (not clicking anything)");
                var handle = hWnd;
                _uiThread.Invoke(new Action(() =>
                {
                    var overlay = CreateOverlay(bounds);
                    _overlays[handle] = overlay;
                }), null);
            }
            else
            {
                var overlay = _overlays[hWnd];
                _uiThread.Invoke(new Action(() =>
                {
                    if (overlay.Bounds != bounds) overlay.Bounds = bounds;
                }), null);
            }

            return true;
        }, IntPtr.Zero);

        foreach (var goneHandle in _overlays.Keys.Where(h => !seen.Contains(h)).ToList())
        {
            var overlay = _overlays[goneHandle];
            _overlays.Remove(goneHandle);
            _uiThread.Invoke(new Action(overlay.Close), null);
        }
    }

    private static Form CreateOverlay(Rectangle bounds)
    {
        var overlay = new NonActivatingForm
        {
            FormBorderStyle = FormBorderStyle.None,
            StartPosition = FormStartPosition.Manual,
            Bounds = bounds,
            TopMost = true,
            ShowInTaskbar = false,
            BackColor = Color.White,
        };
        overlay.Show();
        return overlay;
    }

    public void Dispose()
    {
        _stop = true;
        foreach (var overlay in _overlays.Values)
        {
            try { _uiThread.Invoke(new Action(overlay.Close), null); }
            catch { /* UI thread may already be gone during shutdown */ }
        }
        _overlays.Clear();
    }

    // Plain WS_EX_NOACTIVATE + ShowWithoutActivation so covering a dialog never steals window
    // activation/focus away from it -- the overlay is purely a visual patch.
    private sealed class NonActivatingForm : Form
    {
        private const int WS_EX_NOACTIVATE = 0x08000000;

        protected override bool ShowWithoutActivation => true;

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.ExStyle |= WS_EX_NOACTIVATE;
                return cp;
            }
        }
    }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left, Top, Right, Bottom;
    }

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
}
