$path = 'C:\Users\account\Videos\SchoolSafe V2\app\vendor\supabase-sdk.js'
$tmp = 'C:\Users\account\AppData\Local\Temp\supabase-sdk.js'

try {
    $item = Get-Item $path -Force
    Write-Host "Attributes: $($item.Attributes)"
    Write-Host "IsReadOnly: $($item.IsReadOnly)"
} catch {
    Write-Host "Get-Item error: $($_.Exception.Message)"
}

try {
    Move-Item $path ($path + '.old') -Force
    Write-Host "Renamed OK"
} catch {
    Write-Host "Rename error: $($_.Exception.Message)"
}

try {
    Copy-Item $tmp $path -Force
    Write-Host "Copy OK, size $((Get-Item $path).Length)"
} catch {
    Write-Host "Copy error: $($_.Exception.Message)"
}
