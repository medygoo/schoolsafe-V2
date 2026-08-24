$src = 'C:\Users\account\AppData\Local\Temp\supabase-sdk.js'
$dst = 'C:\Users\account\Videos\SchoolSafe V2\app\vendor\supabase-sdk.js'

try {
    $bytes = [System.IO.File]::ReadAllBytes($src)
    Write-Host "Read source: $($bytes.Length) bytes"

    $fs = [System.IO.File]::Open($dst, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
    Write-Host "Opened destination for write"

    $fs.Write($bytes, 0, $bytes.Length)
    $fs.SetLength($bytes.Length)
    $fs.Close()

    $len = (Get-Item $dst).Length
    Write-Host "Wrote OK, destination size $len"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
