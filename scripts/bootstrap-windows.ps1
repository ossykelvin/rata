$ErrorActionPreference = "Stop"

Write-Host "Rata Office Assistant MVP" -ForegroundColor Cyan
Write-Host "Checking Node.js..."

$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue

if (-not $node -or -not $npm) {
    Write-Host "Node.js 22.12+ is required for development. Install Node.js, then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install

Write-Host "Running agent regression tests..." -ForegroundColor Cyan
npm test

Write-Host "Starting Rata..." -ForegroundColor Green
npm run dev
