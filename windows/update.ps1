# rse-dashboard/windows/update.ps1
# Met a jour le dashboard RSE depuis les Google Sheets
# Usage : double-clic sur update.bat

$REPO_DIR = "$env:USERPROFILE\Documents\rse-dashboard"
$VENV_PYTHON = "$REPO_DIR\venv\Scripts\python.exe"
$DASHBOARD_URL = "https://77darius77.github.io/rse-dashboard/"

function Write-Step { param($msg) Write-Host "`n> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "  OK $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "  XX $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "========================================" -ForegroundColor Blue
Write-Host "   Dashboard RSE - Mise a jour donnees  " -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue

# Verifier que le projet est installe
if (-not (Test-Path $VENV_PYTHON)) {
    Write-Host ""
    Write-Host "  XX Projet non installe." -ForegroundColor Red
    Write-Host "  -> Lancez d'abord install.ps1 (clic droit -> Executer avec PowerShell)" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entree pour fermer"
    exit 1
}

# Recuperer les derniers changements du repo
Write-Step "Mise a jour du code source..."
try {
    git -C $REPO_DIR pull --quiet
    Write-OK "Code source a jour"
} catch {
    Write-Host "  !! Impossible de recuperer les mises a jour git : $_" -ForegroundColor Yellow
}

# Lancer le script de mise a jour
Write-Step "Recuperation des donnees Google Sheets et calcul des scores..."
Write-Host ""
& $VENV_PYTHON "$REPO_DIR\scripts\update_data.py"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   Dashboard mis a jour avec succes !    " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Le dashboard sera visible dans ~2 minutes :" -ForegroundColor White
    Write-Host "  $DASHBOARD_URL" -ForegroundColor Cyan
    Write-Host ""

    # Ouvrir le dashboard dans le navigateur par defaut
    Start-Process $DASHBOARD_URL
} else {
    Write-Host ""
    Write-Fail "Une erreur s'est produite. Voir le message ci-dessus."
    Write-Host ""
    Write-Host "  Solutions courantes :" -ForegroundColor Yellow
    Write-Host "  . Token expire -> supprimez scripts\token.json et relancez" -ForegroundColor Yellow
    Write-Host "  . Pas de connexion internet -> verifiez le reseau" -ForegroundColor Yellow
    Write-Host "  . client_secret manquant -> copiez-le dans Documents\" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Appuyez sur Entree pour fermer"
