# build.ps1 — Build all CPU scheduling WASM modules (Windows PowerShell)
# Usage: .\build.ps1
# Prerequisite: Emscripten SDK activated (emsdk_env.ps1 or emsdk_env.bat run first)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

# ── Colors ──────────────────────────────────────────────────
function Write-Step  { param($msg) Write-Host "  ▶  $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "  ✓  $msg" -ForegroundColor Green }
function Write-Fail  { param($msg) Write-Host "  ✗  $msg" -ForegroundColor Red }
function Write-Info  { param($msg) Write-Host "     $msg" -ForegroundColor Gray }

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "  CPU Scheduling Simulator — WASM Build Script  " -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host ""

# ── Check emcc ───────────────────────────────────────────────
Write-Step "Checking Emscripten (emcc)..."
try {
    $emccVersion = & emcc --version 2>&1 | Select-Object -First 1
    Write-Ok "Found: $emccVersion"
} catch {
    Write-Fail "emcc not found on PATH."
    Write-Info "Please install Emscripten SDK:"
    Write-Info "  https://emscripten.org/docs/getting_started/downloads.html"
    Write-Info "Then run: emsdk activate latest && emsdk_env.bat"
    exit 1
}

# ── Fetch nlohmann/json if missing ───────────────────────────
$JsonHeader = Join-Path $ProjectRoot "third_party\nlohmann\json.hpp"
if (-not (Test-Path $JsonHeader)) {
    Write-Step "Downloading nlohmann/json single header..."
    New-Item -ItemType Directory -Force -Path (Split-Path $JsonHeader) | Out-Null
    $url = "https://github.com/nlohmann/json/releases/download/v3.11.3/json.hpp"
    try {
        Invoke-WebRequest -Uri $url -OutFile $JsonHeader -UseBasicParsing
        Write-Ok "nlohmann/json downloaded to third_party\nlohmann\json.hpp"
    } catch {
        Write-Fail "Failed to download nlohmann/json: $($_.Exception.Message)"
        Write-Info "Download manually from: $url"
        exit 1
    }
} else {
    Write-Ok "nlohmann/json already present."
}

$IncludePath = Join-Path $ProjectRoot "third_party"
$AlgorithmsDir = Join-Path $ProjectRoot "algorithms"

# ── Algorithm Build Definitions ──────────────────────────────
$algorithms = @(
    @{ Name = "fcfs";        Dir = "fcfs";        Source = "fcfs.cpp";        ExportName = "FCFSModule" },
    @{ Name = "sjf";         Dir = "sjf";         Source = "sjf.cpp";         ExportName = "SJFModule" },
    @{ Name = "srtf";        Dir = "srtf";        Source = "srtf.cpp";        ExportName = "SRTFModule" },
    @{ Name = "round_robin"; Dir = "round_robin"; Source = "round_robin.cpp"; ExportName = "RoundRobinModule" },
    @{ Name = "priority";    Dir = "priority";    Source = "priority.cpp";    ExportName = "PriorityModule" }
)

$success = 0
$failed  = 0

Write-Host ""
Write-Host "Building algorithms..." -ForegroundColor Yellow
Write-Host ""

foreach ($algo in $algorithms) {
    $algoDir = Join-Path $AlgorithmsDir $algo.Dir
    $sourceFile = Join-Path $algoDir $algo.Source
    $outputJs   = Join-Path $algoDir "$($algo.Dir).js"

    Write-Step "Compiling $($algo.Name) ($($algo.Source))..."

    if (-not (Test-Path $sourceFile)) {
        Write-Fail "Source not found: $sourceFile"
        $failed++
        continue
    }

    # Emscripten compile command
    $emccArgs = @(
        $sourceFile,
        "-o", $outputJs,
        "-s", "MODULARIZE=1",
        "-s", "EXPORT_NAME=`"$($algo.ExportName)`"",
        "-s", "EXPORTED_RUNTIME_METHODS=[`"ccall`",`"cwrap`"]",
        "-s", "ENVIRONMENT=web",
        "-s", "ALLOW_MEMORY_GROWTH=1",
        "-I", $IncludePath,
        "-std=c++17",
        "-O2"
    )

    try {
        $proc = Start-Process -FilePath "emcc" -ArgumentList $emccArgs `
            -WorkingDirectory $algoDir -Wait -PassThru -NoNewWindow
        if ($proc.ExitCode -eq 0) {
            Write-Ok "$($algo.Name) → $($algo.Dir).js + $($algo.Dir).wasm"
            $success++
        } else {
            Write-Fail "$($algo.Name) compilation failed (exit code $($proc.ExitCode))"
            $failed++
        }
    } catch {
        Write-Fail "emcc error for $($algo.Name): $($_.Exception.Message)"
        $failed++
    }
}

# ── Summary ──────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "  Build Summary: $success succeeded, $failed failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host ""

if ($success -gt 0 -and $failed -eq 0) {
    Write-Host "  All modules compiled! Serve the project with:" -ForegroundColor Green
    Write-Host "    python -m http.server 8080" -ForegroundColor Cyan
    Write-Host "  Then open: http://localhost:8080" -ForegroundColor Cyan
    Write-Host ""
}

if ($failed -gt 0) { exit 1 }
