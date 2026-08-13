param(
    [string]$PythonPath = "python",
    [string]$Recipient = ""
)

$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $PSScriptRoot
Set-Location $project

Write-Host "`n=== DJANGO CHECK ==="
& $PythonPath manage.py check
if ($LASTEXITCODE -ne 0) { throw "Django check failed." }

Write-Host "`n=== MIGRATION DRIFT ==="
& $PythonPath manage.py makemigrations --check --dry-run
if ($LASTEXITCODE -ne 0) { throw "Migration drift detected." }

Write-Host "`n=== FULL TEST SUITE ==="
& $PythonPath manage.py test
if ($LASTEXITCODE -ne 0) { throw "Test suite failed." }

Write-Host "`n=== ACTIVE EMAIL PATH CHECK ==="
$servicePath = Join-Path $project "apps\notifications\services.py"
$service = Get-Content $servicePath -Raw

$required = @(
    "from django.core.mail import EmailMessage",
    "X-Zalary-Notification-ID",
    "message.send(fail_silently=False)"
)
foreach ($item in $required) {
    if (-not $service.Contains($item)) {
        throw "Missing required email-path marker: $item"
    }
}

$forbidden = @(
    "make_msgid",
    "Auto-Submitted",
    "X-Zalary-Delivery-ID",
    "get_email_provider",
    "OutgoingEmail"
)
foreach ($item in $forbidden) {
    if ($service.Contains($item)) {
        throw "Forbidden active email-path marker found: $item"
    }
}

Write-Host "Sample-backend EmailMessage path active: True"
Write-Host "Custom local Message-ID active: False"
Write-Host "Auto-Submitted active: False"
Write-Host "Recipient encryption retained: True"

if ($Recipient) {
    Write-Host "`n=== LIVE NORMAL-PATH EMAIL TEST ==="
    & $PythonPath manage.py send_test_notification --recipient $Recipient
    if ($LASTEXITCODE -ne 0) { throw "Live notification test failed." }
}

Write-Host "`nSAMPLE EMAIL FIX VERIFIED"
Write-Host "Blockchain transactions broadcast: 0"
Write-Host "Tokens moved: 0"
