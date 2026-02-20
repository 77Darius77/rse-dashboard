# rse-dashboard/windows/update.ps1
# Met à jour le dashboard RSE depuis les Google Sheets
# Usage : double-clic sur update.bat

$REPO_DIR = "$env:USERPROFILE\Documents\rse-dashboard"
$VENV_PYTHON = "$REPO_DIR\venv\Scripts\python.exe"
$DASHBOARD_URL = "https://77darius77.github.io/rse-dashboard/"

function Write-Step { param($msg) Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "  ❌ $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Blue
Write-Host "   Dashboard RSE — Mise à jour données   " -ForegroundColor Blue
Write-Host "════════════════════════════════════════" -ForegroundColor Blue

# Vérifier que le projet est installé
if (-not (Test-Path $VENV_PYTHON)) {
    Write-Host ""
    Write-Host "  ❌ Projet non installé." -ForegroundColor Red
    Write-Host "  → Lancez d'abord install.ps1 (clic droit → Exécuter avec PowerShell)" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entrée pour fermer"
    exit 1
}

# Récupérer les derniers changements du repo
Write-Step "Mise à jour du code source..."
try {
    git -C $REPO_DIR pull --quiet
    Write-OK "Code source à jour"
} catch {
    Write-Host "  ⚠️  Impossible de récupérer les mises à jour git : $_" -ForegroundColor Yellow
}

# Lancer le script de mise à jour
Write-Step "Récupération des données Google Sheets et calcul des scores..."
Write-Host ""
& $VENV_PYTHON "$REPO_DIR\scripts\update_data.py"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "════════════════════════════════════════" -ForegroundColor Green
    Write-Host "   Dashboard mis à jour avec succès !    " -ForegroundColor Green
    Write-Host "════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Le dashboard sera visible dans ~2 minutes :" -ForegroundColor White
    Write-Host "  $DASHBOARD_URL" -ForegroundColor Cyan
    Write-Host ""

    # Ouvrir le dashboard dans le navigateur par défaut
    Start-Process $DASHBOARD_URL
} else {
    Write-Host ""
    Write-Fail "Une erreur s'est produite. Voir le message ci-dessus."
    Write-Host ""
    Write-Host "  Solutions courantes :" -ForegroundColor Yellow
    Write-Host "  • Token expiré → supprimez scripts\token.json et relancez" -ForegroundColor Yellow
    Write-Host "  • Pas de connexion internet → vérifiez le réseau" -ForegroundColor Yellow
    Write-Host "  • client_secret manquant → copiez-le dans Documents\" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Appuyez sur Entrée pour fermer"
