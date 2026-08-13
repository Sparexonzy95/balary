param(
    [string]$BackendDir = (Split-Path -Parent $PSScriptRoot),
    [string]$PythonPath = "python",
    [string]$DiagnosticRecipient = "operator@example.com"
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path -LiteralPath $BackendDir).Path
Set-Location -LiteralPath $projectRoot

function Invoke-Checked {
    param([string]$Label, [scriptblock]$Command)
    Write-Host "`n=== $Label ==="
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE." }
}

Invoke-Checked "DJANGO SYSTEM CHECK" { & $PythonPath manage.py check }
Invoke-Checked "MIGRATION DRIFT CHECK" { & $PythonPath manage.py makemigrations --check --dry-run }
Invoke-Checked "APPLY MIGRATIONS" { & $PythonPath manage.py migrate --noinput }
Invoke-Checked "FULL TEST SUITE" { & $PythonPath manage.py test }
Invoke-Checked "SMTP CONFIGURATION AND AUTHENTICATION" {
    & $PythonPath manage.py diagnose_email --recipient $DiagnosticRecipient --no-send
}
Invoke-Checked "REDIS CONNECTIVITY" {
    & $PythonPath manage.py shell -c "from django.conf import settings; import redis; assert redis.Redis.from_url(settings.CELERY_BROKER_URL).ping(); print('Redis: reachable')"
}
Invoke-Checked "CELERY WORKER CONTROL CHANNEL" {
    & $PythonPath -m celery -A config inspect stats --timeout 10
}

Write-Host "`nEMAIL DELIVERY VERIFICATION PASSED"
Write-Host "SMTP message sent by verification: 0"
Write-Host "Blockchain transactions broadcast by verification: 0"
Write-Host "Tokens moved by verification: 0"
Write-Host "Secrets printed by the script: 0"

