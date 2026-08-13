$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $PSScriptRoot
$downloads = Join-Path $env:USERPROFILE "Downloads"
$backendReadyUrl = "http://127.0.0.1:8001/api/v1/health/ready/"
$frontendUrl = "http://127.0.0.1:5173"

Set-Location $projectDir

Write-Host "`n=== VERIFY MILESTONE 5.2 BACKEND ==="
try {
    $ready = Invoke-RestMethod -Uri $backendReadyUrl -Method Get -TimeoutSec 15
} catch {
    throw "The Milestone 5.2 backend is not reachable at $backendReadyUrl"
}
if (-not $ready.ready) {
    throw "The backend readiness endpoint returned ready=false."
}
Write-Host "Backend ready: True"

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}
Write-Host "Frontend environment ready: True"

Write-Host "`n=== PREPARE NODE DEPENDENCIES ==="
$viteCmd = Join-Path $projectDir "node_modules\.bin\vite.cmd"

if (-not (Test-Path $viteCmd)) {
    $sampleNodeCandidates = @(
        (Join-Path $downloads "balary_frontend_from_zalary\node_modules"),
        (Join-Path $downloads "samplefrontend\balary_frontend_from_zalary\node_modules"),
        (Join-Path $downloads "samplefrontend\node_modules")
    )

    $sampleNodeModules = $sampleNodeCandidates |
        Where-Object { Test-Path (Join-Path $_ ".bin\vite.cmd") } |
        Select-Object -First 1

    if (-not $sampleNodeModules) {
        $sampleZip = Get-ChildItem -Path $downloads -Filter "samplefrontend*.zip" -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1

        if ($sampleZip) {
            $temp = Join-Path $env:TEMP ("zalary-sample-node-" + [guid]::NewGuid().ToString("N"))
            New-Item -ItemType Directory -Path $temp -Force | Out-Null
            Expand-Archive -Path $sampleZip.FullName -DestinationPath $temp -Force
            $sampleNodeModules = Get-ChildItem -Path $temp -Directory -Recurse -Filter "node_modules" |
                Where-Object { Test-Path (Join-Path $_.FullName ".bin\vite.cmd") } |
                Select-Object -ExpandProperty FullName -First 1

            if ($sampleNodeModules) {
                robocopy $sampleNodeModules (Join-Path $projectDir "node_modules") /E /NFL /NDL /NJH /NJS /NP | Out-Null
                if ($LASTEXITCODE -gt 7) {
                    throw "Could not copy the sample frontend dependencies."
                }
            }
            Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
        }
    } else {
        robocopy $sampleNodeModules (Join-Path $projectDir "node_modules") /E /NFL /NDL /NJH /NJS /NP | Out-Null
        if ($LASTEXITCODE -gt 7) {
            throw "Could not copy the sample frontend dependencies."
        }
    }
}

if (-not (Test-Path $viteCmd)) {
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed."
    }
}
Write-Host "Node dependencies ready: True"

Write-Host "`n=== VERIFY LOCKED SAMPLE DESIGN ==="
npm run verify:integration
if ($LASTEXITCODE -ne 0) { throw "Integration verification failed." }

Write-Host "`n=== TYPESCRIPT CHECK ==="
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed." }

Write-Host "`n=== FRONTEND TESTS ==="
npm test
if ($LASTEXITCODE -ne 0) { throw "Frontend tests failed." }

Write-Host "`n=== PRODUCTION BUILD ==="
npm run build
if ($LASTEXITCODE -ne 0) { throw "Frontend production build failed." }

Write-Host "`n=== START ZALARY FRONTEND ==="
$command = @"
Set-Location -LiteralPath '$projectDir'
npm run dev -- --host 127.0.0.1 --port 5173
"@
Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command", $command
) | Out-Null

$started = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $started = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 2
    }
}
if (-not $started) {
    throw "The frontend did not become reachable at $frontendUrl"
}

Write-Host "`nZALARY FRONTEND READY"
Write-Host "Sample design unchanged: True"
Write-Host "Milestone 5.2 API integrated: True"
Write-Host "TypeScript passed: True"
Write-Host "Frontend tests passed: True"
Write-Host "Production build passed: True"
Write-Host "Frontend URL: $frontendUrl"
Write-Host "Backend URL: http://127.0.0.1:8001"
Write-Host "Blockchain transactions broadcast by setup: 0"
Write-Host "Tokens moved by setup: 0"
