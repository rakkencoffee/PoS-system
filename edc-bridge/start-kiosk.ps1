# start-kiosk.ps1
#
# Launches EdcBridge.exe and the kiosk browser together on a single kiosk
# device. Simplified 2026-09-15: this used to also juggle Windows virtual
# desktops to hide EdcBridge's native EDC dialogs from the customer, but that
# approach was abandoned the same day -- some dialogs (e.g. "Error response
# from Host") block POS4CAT_Ctl.dll from accepting the next request until a
# human clicks OK, and hiding them meant nobody ever could, permanently
# wedging the terminal. Dialogs are now left to render normally (see
# daemon.config's HideDialogsOnDesktop, default false) -- staff/customers see
# and dismiss them directly, so there's no need to launch EdcBridge.exe on a
# different desktop than the kiosk browser anymore.
#
# Intended to run once per logon (Task Scheduler trigger "At log on", with
# Windows auto-login configured on the kiosk device -- see setup-autostart.ps1).

param(
    [string]$EdcBridgeExe = (Join-Path $PSScriptRoot 'EdcBridge.exe'),
    [string]$KioskUrl = 'https://menu.rakkencoffee.com/?device=A',
    [string]$ChromeExe = 'C:\Program Files\Google\Chrome\Application\chrome.exe',
    [int]$EdcBridgeWarmupMs = 3000
)

if (-not (Test-Path $EdcBridgeExe)) {
    Write-Error "EdcBridge.exe not found at '$EdcBridgeExe'. Pass -EdcBridgeExe or publish it first (dotnet publish -r win-x86 --self-contained true -c Release -o publish)."
    exit 1
}

Write-Host "[start-kiosk] Launching EdcBridge.exe..."
$edcBridgeDir = Split-Path $EdcBridgeExe -Parent
Start-Process -FilePath $EdcBridgeExe -WorkingDirectory $edcBridgeDir
Start-Sleep -Milliseconds $EdcBridgeWarmupMs

Write-Host "[start-kiosk] Launching kiosk browser..."
Start-Process -FilePath $ChromeExe -ArgumentList "--kiosk `"$KioskUrl`" --noerrdialogs --disable-session-crashed-bubble --incognito"

Write-Host "[start-kiosk] Done."
