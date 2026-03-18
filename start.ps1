$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ROOT

Write-Host ""
Write-Host "  DocFlow - starting up" -ForegroundColor Cyan
Write-Host ""

# ── Check runtimes ──────────────────────────────────────────────────────────

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

$SYS_PYTHON = $null
foreach ($cmd in @("python", "python3", "py")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        $SYS_PYTHON = $cmd
        break
    }
}
if (-not $SYS_PYTHON) {
    Write-Host "ERROR: Python not found. Install from https://python.org" -ForegroundColor Red
    exit 1
}

Write-Host "OK  Node $(node -v)   $(& $SYS_PYTHON --version 2>&1)" -ForegroundColor Green

# ── Virtual environment ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "Checking virtual environment..." -ForegroundColor Yellow

$VENV = "$ROOT\.venv"
if (-not (Test-Path "$VENV\Scripts\python.exe")) {
    Write-Host "  Creating .venv..."
    & $SYS_PYTHON -m venv $VENV
}

$PYTHON = "$VENV\Scripts\python.exe"
Write-Host "OK  Using $PYTHON" -ForegroundColor Green

# ── Node dependencies ───────────────────────────────────────────────────────

Write-Host ""
Write-Host "Checking Node dependencies..." -ForegroundColor Yellow

if (-not (Test-Path "$ROOT\node_modules"))         { npm install --prefix "$ROOT" -s }
if (-not (Test-Path "$ROOT\backend\node_modules")) { npm install --prefix "$ROOT\backend" -s; Write-Host "  backend installed" }
if (-not (Test-Path "$ROOT\frontend\node_modules")) { npm install --prefix "$ROOT\frontend" -s; Write-Host "  frontend installed" }

Write-Host "OK  Node dependencies ready" -ForegroundColor Green

# ── Python dependencies ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "Checking Python dependencies..." -ForegroundColor Yellow
& $PYTHON -m pip install -r "$ROOT\requirements.txt" -q --disable-pip-version-check
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: pip install failed. Delete .venv and run npm start again." -ForegroundColor Red
    exit 1
}
Write-Host "OK  Python dependencies ready" -ForegroundColor Green

# ── Optional: warn about Tesseract ──────────────────────────────────────────

# Check Tesseract via PATH or TESSERACT_PATH in .env
$tesseractFound = Get-Command tesseract -ErrorAction SilentlyContinue
if (-not $tesseractFound) {
    $envFile = "$ROOT\.env"
    if (Test-Path $envFile) {
        $tesseractLine = Get-Content $envFile | Where-Object { $_ -match '^TESSERACT_PATH=' }
        if ($tesseractLine) {
            $tesseractExe = $tesseractLine -replace '^TESSERACT_PATH=', ''
            if (Test-Path $tesseractExe) { $tesseractFound = $true }
        }
    }
}
if (-not $tesseractFound) {
    Write-Host ""
    Write-Host "WARN: Tesseract not found - OCR may not work." -ForegroundColor Yellow
    Write-Host "      Set TESSERACT_PATH in .env to the tesseract.exe location."
} else {
    Write-Host "OK  Tesseract found" -ForegroundColor Green
}

# ── Start all services ──────────────────────────────────────────────────────

Write-Host ""
Write-Host "Starting all services..." -ForegroundColor Green
Write-Host "  BACKEND  -> http://localhost:3001"
Write-Host "  FRONTEND -> http://localhost:3000"
Write-Host "  OCR      -> http://localhost:5001"
Write-Host "  NER      -> http://localhost:5002"
Write-Host ""

$concurrentlyArgs = @(
    "--names", "BACKEND,FRONTEND,OCR,NER",
    "--prefix-colors", "cyan,magenta,yellow,green",
    "--kill-others-on-fail",
    "npm run dev --prefix backend",
    "npm run dev --prefix frontend",
    "cd ocr-service && `"$PYTHON`" app.py",
    "cd services/ner-service && `"$PYTHON`" -m uvicorn app.main:app --host 0.0.0.0 --port 5002"
)

npx concurrently @concurrentlyArgs
