Get-PnpDevice | Where-Object { $_.FriendlyName -match "Printer|Serial|COM" } | Select-Object FriendlyName, Status, Class | Format-Table -AutoSize
