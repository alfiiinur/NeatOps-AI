# Jalankan backend (FastAPI :8000) dan frontend (Vite :5173) bersamaan untuk uji end-to-end.
#   .\infra\scripts\dev.ps1            (dari root project)
# Backend: infra\.venv wajib ada (python -m venv .venv; pip install -r requirements.txt).
# Foto yang sudah pernah dianalisis dijawab dari cache (infra\.cache) tanpa memakai token.
# Tekan Ctrl+C untuk menghentikan keduanya.

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$infra = Join-Path $root "infra"
$site = Join-Path $root "website"
$py = Join-Path $infra ".venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
    Write-Error "Venv belum ada. Jalankan di folder infra: python -m venv .venv; .\.venv\Scripts\pip install -r requirements.txt"
}
if (-not (Test-Path (Join-Path $site "node_modules"))) {
    Write-Error "Dependensi frontend belum terpasang. Jalankan di folder website: npm install"
}
if (-not (Test-Path (Join-Path $root ".env"))) {
    Write-Warning "File .env di root belum ada: backend akan menjawab 503 sampai MODEL_API_KEY diisi (frontend jatuh ke simulasi)."
}

$backend = Start-Process -FilePath $py -ArgumentList "-m", "uvicorn", "app.api.main:app", "--port", "8000" `
    -WorkingDirectory $infra -PassThru -NoNewWindow
try {
    Write-Host "Backend  : http://localhost:8000/health"
    Write-Host "Frontend : http://localhost:5173  (Ctrl+C untuk berhenti)"
    Push-Location $site
    npm run dev
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    if ($backend -and -not $backend.HasExited) { Stop-Process -Id $backend.Id -Force }
}
