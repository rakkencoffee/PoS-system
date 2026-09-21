# start-kiosk.ps1
#
# Launches EdcBridge.exe and the kiosk browser together on a single kiosk
# device. Simplified 2026-09-15: this used to also juggle Windows virtual
# desktops to hide EdcBridge's native EDC dialogs from the customer, but that
# approach was abandoned the same day -- some dialogs (e.g. "Error response
# from Host") block POS4CAT_Ctl.dll from accepting the next request until a
# human clicks OK, and hiding them meant nobody ever could, permanently
# wedging the terminal. Dialogs are now left to render normally -- staff/
# customers see and dismiss them directly, so there's no need to launch
# EdcBridge.exe on a different desktop than the kiosk browser anymore.
#
# Intended to run once per logon (Task Scheduler trigger "At log on", with
# Windows auto-login configured on the kiosk device -- see setup-autostart.ps1).

param(
    [string]$EdcBridgeExe = (Join-Path $PSScriptRoot 'EdcBridge.exe'),
    [string]$KioskUrl = 'https://menu.rakkencoffee.com/?device=A',
    [string]$ChromeExe = 'C:\Program Files\Google\Chrome\Application\chrome.exe',
    [string]$ChromeProfileDir = (Join-Path $PSScriptRoot 'chrome-profile'),
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
# Deliberately NOT --incognito: the kiosk's receipt printer is paired over Web
# Bluetooth (see useBlePrinter.ts), and Chrome only remembers that pairing
# permission for the profile's lifetime -- incognito's profile is thrown away
# on close, so every restart forced staff to re-pair the printer from
# scratch (confirmed live 2026-09-2x). A normal (non-incognito) profile
# persists the pairing across restarts, matching how the physical EDC
# terminal itself already "just stays connected" -- no ongoing downside here
# since this Chrome window only ever loads the one kiosk URL.
#
# A normal profile means Chrome's regular first-run experience applies too,
# though -- confirmed live 2026-09-2x this popped its "Choose your search
# engine" tab on top of the kiosk URL after dropping --incognito (which used
# to skip first-run entirely). The three flags below suppress that and the
# rest of first-run (welcome tour, default-browser nag) without touching
# whether the profile itself persists.
#
# --user-data-dir points at a folder dedicated to this kiosk instead of
# Windows' shared default Chrome profile -- confirmed live 2026-09-2x that
# profile had accumulated a "restore previous session" state (kiosk PCs get
# power-cut/hard-reset far more often than a normal PC, which Chrome treats
# as an unclean exit), so every relaunch opened BOTH a restored blank tab AND
# the kiosk URL as a second tab (matches Chromium issue 517177). A dedicated
# profile starts clean; the exit_type patch below keeps it that way even
# after a future unclean shutdown, by telling Chrome the last exit was
# already normal before it gets the chance to think otherwise.
if (-not (Test-Path $ChromeProfileDir)) {
    New-Item -ItemType Directory -Path $ChromeProfileDir | Out-Null
}
$prefsPath = Join-Path $ChromeProfileDir 'Default\Preferences'
if (Test-Path $prefsPath) {
    try {
        $prefs = Get-Content -LiteralPath $prefsPath -Raw | ConvertFrom-Json
        if ($prefs.profile) {
            $prefs.profile.exit_type = 'Normal'
            $prefs | ConvertTo-Json -Depth 100 -Compress | Set-Content -LiteralPath $prefsPath -NoNewline
            Write-Host "[start-kiosk] Marked previous Chrome profile exit as Normal (skips session-restore prompt)."
        }
    } catch {
        Write-Host "[start-kiosk] Could not patch Chrome Preferences exit_type (non-fatal): $_"
    }
}

Start-Process -FilePath $ChromeExe -ArgumentList "--kiosk `"$KioskUrl`" --user-data-dir=`"$ChromeProfileDir`" --noerrdialogs --disable-session-crashed-bubble --no-first-run --no-default-browser-check --disable-search-engine-choice-screen"

Write-Host "[start-kiosk] Done."
