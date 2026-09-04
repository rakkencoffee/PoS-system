using System.ComponentModel;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace EdcBridge;

// Handles every #32770 dialog POS4CAT_Ctl.dll shows, split into two groups by observed
// behaviour (all confirmed live, one transaction at a time -- this DLL is closed-source, so
// this is the only way to find out):
//
// 1. Dialogs that need an actual OK click to ever go away -- they do NOT self-dismiss no
//    matter what happens on the physical EDC, confirmed by letting each hang indefinitely:
//      - "Service requesting to EDC..... Initialize EDC communicate....." (shown once at the
//        very start of every Purchase() call, before any card prompt)
//      - "Error response from Host" (shown after the terminal/host reports a failure, e.g.
//        cancelling from the EDC's own physical Cancel button)
//    These are safe to click OK on immediately -- by the time they appear, the DLL is not
//    actively waiting on hardware any more, it just needs the acknowledgement to unwind.
//
// 2. "Please check EDC display" -- shown WHILE the DLL is actively polling the terminal for
//    a card tap. Clicking OK on this one (even exact-text matched, even once) broke a real
//    approved-in-progress transaction live: the very next COMStatus() call returned a garbage
//    response code within ~100ms of the click. This one must NEVER be clicked or hidden --
//    only visually covered, so the DLL's own hardware-driven wait resolves it on its own
//    (real card tap, or a cancel/timeout on the physical terminal).
//
// Anything not recognized falls into the "cover only" bucket too, on the assumption that an
// unknown dialog is more likely to be another hardware-wait status than a safe-to-acknowledge
// one -- guessing wrong the other way (auto-clicking something we don't understand) is the
// mistake that broke transactions in every earlier iteration.
//
// Runs its polling on its OWN background thread, deliberately NOT a System.Windows.Forms.Timer
// -- a first attempt using one shared the same WM_TIMER-driven message queue that
// POS4CAT_Ctl.dll's fragile internal state machine depends on (see Program.cs), and
// transactions started failing within 2-4 seconds the moment that timer was added.
// EnumWindows/GetWindowRect/GetDlgItem/PostMessage are safe to call cross-thread; actually
// creating/moving/closing the overlay Form is marshaled onto the UI thread (via uiThread)
// since Forms must live on the thread that pumps their messages -- that thread is already
// running Application.Run() for the hidden host form, so overlay windows share that same pump.
public sealed class DialogAutoCloser : IDisposable
{
    private const string DialogClassName = "#32770"; // standard Win32 dialog/MessageBox class
    private const int IDOK = 1;
    private const uint BM_CLICK = 0x00F5;

    // Substring match against the dialog's combined child control text (its message body --
    // every dialog this DLL shows has a BLANK title bar, so title text can't tell them apart).
    private static readonly string[] SafeToClickMessages =
    {
        "Initialize EDC communicate",
        "Error response from Host",
    };

    private readonly ISynchronizeInvoke _uiThread;
    private readonly Thread _thread;
    private readonly Dictionary<IntPtr, Form> _overlays = new();
    private readonly HashSet<IntPtr> _clicked = new();
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

            var bodyText = GetChildText(hWnd);
            var safeToClick = Array.Find(SafeToClickMessages, m => bodyText.Contains(m, StringComparison.OrdinalIgnoreCase));

            if (safeToClick is not null)
            {
                seen.Add(hWnd); // covered below too, until the click actually takes effect
                if (_clicked.Add(hWnd))
                {
                    var okButton = GetDlgItem(hWnd, IDOK);
                    if (okButton != IntPtr.Zero)
                    {
                        Console.WriteLine($"[DialogAutoCloser] Auto-dismissing known dialog: \"{safeToClick}\"");
                        PostMessage(okButton, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
                    }
                }
            }

            if (!GetWindowRect(hWnd, out var rect)) return true;
            seen.Add(hWnd);
            var bounds = Rectangle.FromLTRB(rect.Left, rect.Top, rect.Right, rect.Bottom);

            if (!_overlays.ContainsKey(hWnd))
            {
                if (safeToClick is null)
                    Console.WriteLine("[DialogAutoCloser] Covering unrecognized dialog on screen (not touching it)");
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
            _clicked.Remove(goneHandle);
            _uiThread.Invoke(new Action(overlay.Close), null);
        }
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
        return sb.ToString().Trim();
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
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern IntPtr GetDlgItem(IntPtr hDlg, int nIDDlgItem);
}
