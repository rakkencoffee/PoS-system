using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace EdcBridge;

// Moves every #32770 dialog POS4CAT_Ctl.dll shows onto a separate Windows virtual
// desktop, so the kiosk customer (on the desktop running the browser) never sees it.
// Does NOT click, hide (SW_HIDE), or otherwise touch the dialog's content -- only
// relocates which virtual desktop it renders on, via the same public
// IVirtualDesktopManager COM API Explorer itself uses when you drag a window between
// desktops in Task View. Deliberately more surgical than two earlier approaches that
// both proved unsafe (see DialogAutoCloser's history comment for the auto-click one):
// covering the dialog with a same-desktop TopMost overlay (DialogAutoCloser) was found
// live (2026-09-15) to still let the dialog visually block the kiosk browser, since
// both sat on the same desktop -- the overlay only hid the dialog's TEXT, not the fact
// that something opaque was still on top of the page.
//
// Critical timing note (found live 2026-09-15): a dialog is created by
// POS4CAT_Ctl.dll dynamically, at the moment of the actual EDC call (e.g. when the
// customer taps "Pay") -- NOT at daemon startup. Windows assigns a newly created
// window to whichever virtual desktop is currently ACTIVE at that exact moment, which
// is the kiosk's own desktop (that's where the operator/customer has to be to trigger
// the payment). So launching EdcBridge.exe on a different desktop and switching away
// does NOT make future dialogs appear there -- they still land wherever the customer
// currently is. This class works around that by capturing the *target hide desktop*
// once at startup from its own host window's desktop id (so EdcBridge.exe must itself
// be launched while that hide desktop, e.g. Desktop 3, is the active one), then
// explicitly re-parenting each dialog it detects onto that captured desktop
// afterwards, regardless of which desktop the dialog was actually created on.
public sealed class DialogDesktopHider : IDisposable
{
    private const string DialogClassName = "#32770"; // standard Win32 dialog/MessageBox class

    private readonly ISynchronizeInvoke _uiThread;
    private readonly Thread _thread;
    private readonly HashSet<IntPtr> _moved = new();
    private volatile bool _stop;
    private Guid _hideDesktopId;
    private bool _hideDesktopCaptured;

    public DialogDesktopHider(ISynchronizeInvoke uiThread, IntPtr hostWindowHandle, int pollIntervalMs = 100)
    {
        _uiThread = uiThread;
        _uiThread.Invoke(new Action(() => CaptureHideDesktop(hostWindowHandle)), null);
        _thread = new Thread(() => PollLoop(pollIntervalMs)) { IsBackground = true };
        _thread.Start();
    }

    private void CaptureHideDesktop(IntPtr hostWindowHandle)
    {
        try
        {
            var manager = (IVirtualDesktopManager)new VirtualDesktopManagerCom();
            var hr = manager.GetWindowDesktopId(hostWindowHandle, out _hideDesktopId);
            _hideDesktopCaptured = hr == 0 && _hideDesktopId != Guid.Empty;
            if (!_hideDesktopCaptured)
            {
                Console.WriteLine(
                    $"[DialogDesktopHider] Could not capture a hide-desktop id (hr=0x{hr:X8}) -- " +
                    "dialogs will NOT be moved. Make sure EdcBridge.exe was launched while the " +
                    "intended hide desktop (e.g. Desktop 3) was the active one.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DialogDesktopHider] Failed to init IVirtualDesktopManager: {ex.Message}");
        }
    }

    private void PollLoop(int pollIntervalMs)
    {
        while (!_stop)
        {
            Thread.Sleep(pollIntervalMs);
            if (_stop) return;
            if (_hideDesktopCaptured) SyncDialogs();
        }
    }

    private void SyncDialogs()
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
            if (_moved.Contains(hWnd)) return true;

            var handle = hWnd;
            _uiThread.Invoke(new Action(() => MoveToHideDesktop(handle)), null);

            return true;
        }, IntPtr.Zero);

        _moved.RemoveWhere(h => !IsWindow(h));
    }

    private void MoveToHideDesktop(IntPtr hWnd)
    {
        try
        {
            var manager = (IVirtualDesktopManager)new VirtualDesktopManagerCom();
            var hr = manager.MoveWindowToDesktop(hWnd, ref _hideDesktopId);
            if (hr == 0)
            {
                Console.WriteLine("[DialogDesktopHider] Moved dialog off the kiosk desktop (not clicking anything)");
                _moved.Add(hWnd);
            }
            else
            {
                Console.WriteLine($"[DialogDesktopHider] MoveWindowToDesktop failed (hr=0x{hr:X8})");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DialogDesktopHider] MoveWindowToDesktop threw: {ex.Message}");
        }
    }

    public void Dispose()
    {
        _stop = true;
    }

    [ComImport, Guid("AA509086-5CA9-4C25-8F95-589D3C07B48A")]
    private class VirtualDesktopManagerCom
    {
    }

    [ComImport]
    [Guid("A5CD92FF-29BE-454C-8D04-D82879FB3F1B")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IVirtualDesktopManager
    {
        [PreserveSig] int IsWindowOnCurrentVirtualDesktop(IntPtr topLevelWindow, out int onCurrentDesktop);
        [PreserveSig] int GetWindowDesktopId(IntPtr topLevelWindow, out Guid desktopId);
        [PreserveSig] int MoveWindowToDesktop(IntPtr topLevelWindow, ref Guid desktopId);
    }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr hWnd);
}
