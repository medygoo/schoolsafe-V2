$src = 'C:\Users\account\AppData\Local\Temp\supabase-sdk.js'
$dst = 'C:\Users\account\Videos\SchoolSafe V2\app\vendor\supabase-sdk.js'
try {
    Copy-Item -Path $src -Destination $dst -Force
    $len = (Get-Item $dst).Length
    Write-Host "Copied OK, size $len"
} catch {
    Write-Host $_.Exception.Message
}
