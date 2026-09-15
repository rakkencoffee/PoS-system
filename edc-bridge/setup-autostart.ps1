# setup-autostart.ps1
#
# One-time, per-device setup: configures Windows auto-login and registers a
# Task Scheduler entry that runs start-kiosk.ps1 automatically at logon --
# so this PC boots straight into the kiosk (EdcBridge + Chrome kiosk, both on
# the same desktop -- see start-kiosk.ps1) with zero human interaction, even
# after a power cut or unattended restart.
#
# RUN THIS ONLY ON THE ACTUAL PHYSICAL KIOSK PC -- never on a developer
# laptop. It changes how the WHOLE machine logs in (auto-login, no password
# prompt at boot) and makes it auto-launch the kiosk browser + EdcBridge on
# every startup from now on.
#
# Must be run as Administrator (writes to HKLM + registers an elevated
# scheduled task). Run it ONCE, then reboot to verify.
#
# SECURITY NOTE: Windows' built-in auto-login mechanism stores the account
# password in the registry (HKLM\...\Winlogon\DefaultPassword) in a form any
# local administrator on this PC can read back in plain text. This is a
# well-known, accepted trade-off for unattended kiosk devices -- it is only
# acceptable because the account used here should be a LOW-PRIVILEGE,
# kiosk-only Windows account with nothing sensitive on it (no saved
# documents, no other logins, ideally not a Microsoft/admin account),
# physically secured behind the counter. Do NOT point this at a personal or
# admin Windows account.

#Requires -RunAsAdministrator

param(
    [Parameter(Mandatory = $true)]
    [string]$Username,

    # Local account's "domain" is just this PC's own hostname -- only change
    # this if the kiosk PC is actually joined to a Windows domain.
    [string]$Domain = $env:COMPUTERNAME,

    [string]$StartKioskScript,

    [string]$TaskName = 'EdcBridge Kiosk Startup'
)

# $PSScriptRoot can come back empty when evaluated inside a param() default
# value on a script that also has #Requires -RunAsAdministrator (confirmed
# live 2026-09-15 on a real device -- start-kiosk.ps1, which has no #Requires
# line, resolved the identical $PSScriptRoot pattern fine on the same
# machine). Resolving it here in the script body instead avoids that.
if (-not $StartKioskScript) {
    $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $StartKioskScript = Join-Path $scriptDir 'start-kiosk.ps1'
}

if (-not (Test-Path $StartKioskScript)) {
    Write-Error "start-kiosk.ps1 not found at '$StartKioskScript'. Pass -StartKioskScript or run this from the same folder it's in."
    exit 1
}

Write-Host "This configures Windows to auto-login as '$Domain\$Username' and"
Write-Host "auto-launch the kiosk on every boot. Use a dedicated, low-privilege"
Write-Host "kiosk account only -- never a personal or admin account."
Write-Host ""

$securePassword = Read-Host -Prompt "Windows password for $Username" -AsSecureString
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
    # Zero the unmanaged copy immediately -- the managed $plainPassword string
    # itself can't be scrubbed from memory (.NET strings are immutable), but
    # this at least avoids leaving a second, longer-lived copy behind.
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

# --- 1. Windows auto-login ---
$winlogonPath = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
Set-ItemProperty -Path $winlogonPath -Name AutoAdminLogon -Value '1' -Type String
Set-ItemProperty -Path $winlogonPath -Name DefaultUserName -Value $Username -Type String
Set-ItemProperty -Path $winlogonPath -Name DefaultDomainName -Value $Domain -Type String
Set-ItemProperty -Path $winlogonPath -Name DefaultPassword -Value $plainPassword -Type String
Remove-Variable plainPassword
Write-Host "[setup-autostart] Auto-login configured for $Domain\$Username."

# --- 2. Scheduled Task: run start-kiosk.ps1 at logon ---
# RunLevel Highest is safe to always set: for an admin account it avoids the
# reduced/filtered UAC token a normal logon gets; for a standard account it's
# a no-op (nothing to elevate to). Task Scheduler never shows an interactive
# UAC consent prompt for an AtLogOn-triggered task either way, so this can't
# stall an unattended boot.
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$StartKioskScript`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$Domain\$Username"
$principal = New-ScheduledTaskPrincipal -UserId "$Domain\$Username" -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null

Write-Host "[setup-autostart] Scheduled task '$TaskName' registered (runs at logon)."
Write-Host ""
Write-Host "Setup done. Reboot this PC to verify: it should log in automatically and"
Write-Host "land on the kiosk browser, with EdcBridge running hidden on Desktop 3."
Write-Host "If it doesn't, open Task Scheduler and check '$TaskName' > History for errors."
