param(
    [string]$OutputName = "zalary-backend-milestone-5.2-runtime-configured.zip",
    [string]$DestinationDirectory = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($DestinationDirectory)) {
    $DestinationDirectory = Split-Path -Parent $projectRoot
}

if (-not (Test-Path -LiteralPath $DestinationDirectory -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $DestinationDirectory | Out-Null
}

$zipPath = Join-Path $DestinationDirectory $OutputName
$snapshotFolderName = [System.IO.Path]::GetFileNameWithoutExtension($OutputName)
$stagingRoot = Join-Path $env:TEMP ("zalary-snapshot-" + [guid]::NewGuid().ToString("N"))
$stagingProject = Join-Path $stagingRoot $snapshotFolderName

New-Item -ItemType Directory -Force -Path $stagingProject | Out-Null
Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue

try {
    & robocopy.exe $projectRoot $stagingProject /E `
        /XD .git .venv venv __pycache__ .pytest_cache htmlcov node_modules staticfiles media `
        /XF .env db.sqlite3 *.sqlite3 *.pyc *.pyo *.log *.pid .coverage celerybeat-schedule* `
        /NFL /NDL /NJH /NJS /NP | Out-Null

    $robocopyCode = $LASTEXITCODE
    if ($robocopyCode -ge 8) {
        throw "Robocopy failed with exit code $robocopyCode."
    }

    Get-ChildItem -LiteralPath $stagingProject -Recurse -Force -File |
        Where-Object {
            ($_.Name -eq ".env") -or
            ($_.Name -like ".env.*" -and $_.Name -ne ".env.example") -or
            ($_.Name -like "celerybeat-schedule*") -or
            ($_.Extension -in @(".sqlite", ".sqlite3", ".db", ".log", ".pid", ".pyc", ".pyo"))
        } |
        Remove-Item -Force

    Get-ChildItem -LiteralPath $stagingProject -Recurse -Force -Directory |
        Where-Object {
            $_.Name -in @(".git", ".venv", "venv", "__pycache__", ".pytest_cache", "htmlcov", "node_modules", "staticfiles", "media")
        } |
        Sort-Object FullName -Descending |
        Remove-Item -Recurse -Force

    $forbiddenFiles = @(
        Get-ChildItem -LiteralPath $stagingProject -Recurse -Force -File |
        Where-Object {
            ($_.Name -eq ".env") -or
            ($_.Name -like ".env.*" -and $_.Name -ne ".env.example") -or
            ($_.Name -like "celerybeat-schedule*") -or
            ($_.Extension -in @(".sqlite", ".sqlite3", ".db", ".log", ".pid", ".pyc", ".pyo"))
        }
    )

    if ($forbiddenFiles.Count -gt 0) {
        throw "Forbidden runtime or secret files remained in staging."
    }

    Compress-Archive -Path $stagingProject -DestinationPath $zipPath -CompressionLevel Optimal -Force

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        $badEntries = @(
            $archive.Entries |
            Where-Object {
                $leaf = [System.IO.Path]::GetFileName($_.FullName)
                ($leaf -eq ".env") -or
                ($leaf -like ".env.*" -and $leaf -ne ".env.example") -or
                ($leaf -like "celerybeat-schedule*") -or
                ($leaf -match '\.(sqlite|sqlite3|db|log|pid|pyc|pyo)$') -or
                ($_.FullName -match '(^|/)(\.git|\.venv|venv|__pycache__|\.pytest_cache|htmlcov|node_modules|staticfiles|media)(/|$)')
            }
        )

        if ($badEntries.Count -gt 0) {
            throw "The generated ZIP contains forbidden entries."
        }
    }
    finally {
        $archive.Dispose()
    }

    $zipItem = Get-Item -LiteralPath $zipPath
    $hash = Get-FileHash -LiteralPath $zipPath -Algorithm SHA256
    $hashPath = "$zipPath.sha256"
    [System.IO.File]::WriteAllText(
        $hashPath,
        ($hash.Hash.ToLowerInvariant() + "  " + $zipItem.Name + [Environment]::NewLine),
        (New-Object System.Text.UTF8Encoding($false))
    )

    Write-Host "Snapshot created: $($zipItem.FullName)"
    Write-Host "Snapshot size:    $($zipItem.Length) bytes"
    Write-Host "SHA256:           $($hash.Hash.ToLowerInvariant())"
    Write-Host "Secret env files included: False"
    Write-Host "SQLite included:          False"
    Write-Host "Celery schedule included: False"

    [pscustomobject]@{
        FullName = $zipItem.FullName
        Length = $zipItem.Length
        LastWriteTime = $zipItem.LastWriteTime
        SHA256 = $hash.Hash.ToLowerInvariant()
        SHA256File = $hashPath
    }
}
finally {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
}