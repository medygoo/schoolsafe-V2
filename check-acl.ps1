$dir = 'C:\Users\account\Videos\SchoolSafe V2'
$acl = Get-Acl $dir
Write-Host "Owner: $($acl.Owner)"
foreach ($rule in $acl.Access) {
    Write-Host "$($rule.IdentityReference) : $($rule.FileSystemRights) : $($rule.AccessControlType)"
}

$path = 'C:\Users\account\Videos\SchoolSafe V2\app\vendor\supabase-sdk.js'
try {
    $fs = [System.IO.File]::Open($path, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
    Write-Host "OpenOrCreate Write Read-share OK"
    $fs.Close()
} catch {
    Write-Host "OpenOrCreate error: $($_.Exception.Message)"
}

try {
    $fs = [System.IO.File]::Open($path, [System.IO.FileMode]::Truncate, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    Write-Host "Truncate OK"
    $fs.Close()
} catch {
    Write-Host "Truncate error: $($_.Exception.Message)"
}
