Get-Process | Where-Object { $_.ProcessName -match 'node|code|chrome|edge|explorer|notepad|schoolsafe|http|server|vite|webpack' } | Select-Object Id, ProcessName, StartTime | Format-Table -AutoSize
