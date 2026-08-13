$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
python manage.py seed_coston2
Write-Host "Milestone 4 backend verification passed."
