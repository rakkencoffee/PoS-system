using System.ComponentModel;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace EdcBridge;

// Covers (does NOT click/close/hide) every #32770 dialog this DLL creates, so the customer
// never sees it on the kiosk screen -- without ever touching the real dialog window at all.
//
// Four earlier attempts all interacted with the dialog directly and every one of them broke
// real transactions: clicking OK (even matched to the confirmed-legitimate "Please check EDC
// display" text) made the very next COMStatus call return a garbage code within ~100ms;
// ShowWindow(SW_HIDE) on it made the daemon hang forever (confirmed live: card tapped, PIN
// entered, cancelled -- zero further output). The vendor's own POS4EDC User Guide (section
// 2.1.2) confirms why: POS4EDC_COMStatus() itself "display[s] windows message[s] for status
// of EDC and POS4EDC module" as an intentional, undocumented-as-optional part of its blocking
// wait loop -- there is no silent/unattended-mode flag anywhere in the SDK (checked pos4cat.ini
// and the full API reference). The dialog is owned end-to-end by COMStatus()'s own internal
// state machine; anything we do TO it desyncs that.
//
// So instead of touching the dialog, this creates a separate TOPMOST, non-activating overlay
// window of our own and positions it exactly over the dialog's screen rect -- visually hiding
// it from the customer while leaving its message loop, timers, and button completely
// untouched. The real dialog keeps running exactly as the DLL expects; we just paint over it.
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
            SyncOverlays();
        }
    }

    private void SyncOverlays()
    {
        var ownProcessId = (uint)Environment.ProcessId;
        var seen = new HashSet<IntPtr>();

        EnumWindows((hWnd, _) =>
        {
            GetWindowThreadProcessId(hWnd, out var windowProcessId);
            if (windowProcessId != ownProcessId) return true; // only cover our own process's windows

            var classBuf = new StringBuilder(256);
            GetClassName(hWnd, classBuf, classBuf.Capacity);
            if (classBuf.ToString() != DialogClassName) return true;

            if (!IsWindowVisible(hWnd)) return true;
            if (!GetWindowRect(hWnd, out var rect)) return true;

            seen.Add(hWnd);
            var bounds = Rectangle.FromLTRB(rect.Left, rect.Top, rect.Right, rect.Bottom);

            if (!_overlays.ContainsKey(hWnd))
            {
                Console.WriteLine("[DialogAutoCloser] Covering native dialog on screen (not touching it)");
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

    // Plain WS_EX_NOACTIVATE + ShowWithoutActivation so covering the dialog never steals
    // window activation/focus away from it -- the overlay is purely a visual patch.
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
