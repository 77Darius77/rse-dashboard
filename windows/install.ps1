# rse-dashboard/windows/install.ps1
# Script d'installation du Dashboard RSE sur Windows
# Exécuter : clic droit → "Exécuter avec PowerShell" (en tant qu'administrateur)

$ErrorActionPreference = "Stop"
$REPO_URL = "https://github.com/77Darius77/rse-dashboard.git"
$REPO_DIR = "$env:USERPROFILE\Documents\rse-dashboard"
$CLIENT_SECRET_SRC = "$env:USERPROFILE\Documents\client_secret_rse_dashboard.json"
$MIN_PYTHON = [Version]"3.10"

function Write-Step { param($msg) Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "  ❌ $msg" -ForegroundColor Red; exit 1 }
function Write-Warn { param($msg) Write-Host "  ⚠️  $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Blue
Write-Host "   Dashboard RSE — Installation Windows  " -ForegroundColor Blue
Write-Host "════════════════════════════════════════" -ForegroundColor Blue

# ── Étape 1 : Vérifier / installer Python ──────────────────────────────────
Write-Step "Vérification de Python..."
$pythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($ver -match "Python (\d+\.\d+)") {
            $found = [Version]$Matches[1]
            if ($found -ge $MIN_PYTHON) {
                $pythonCmd = $cmd
                Write-OK "Python $found trouvé ($cmd)"
                break
            } else {
                Write-Warn "Python $found trop ancien (minimum $MIN_PYTHON requis)"
            }
        }
    } catch {}
}

if (-not $pythonCmd) {
    Write-Warn "Python $MIN_PYTHON+ non trouvé. Installation via winget..."
    try {
        winget install --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
        [Environment]::SetEnvironmentVariable("PATH", $env:PATH, "Process")
        $pythonCmd = "python"
        Write-OK "Python installé avec succès"
    } catch {
        Write-Fail "Impossible d'installer Python automatiquement. Téléchargez-le manuellement : https://www.python.org/downloads/"
    }
}

# ── Étape 2 : Vérifier / installer Git ────────────────────────────────────
Write-Step "Vérification de Git..."
try {
    $gitVer = git --version 2>&1
    Write-OK "Git trouvé : $gitVer"
} catch {
    Write-Warn "Git non trouvé. Installation via winget..."
    try {
        winget install --id Git.Git --silent --accept-package-agreements --accept-source-agreements
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
        [Environment]::SetEnvironmentVariable("PATH", $env:PATH, "Process")
        Write-OK "Git installé avec succès"
    } catch {
        Write-Fail "Impossible d'installer Git automatiquement. Téléchargez-le : https://git-scm.com/download/win"
    }
}

# ── Étape 3 : Cloner ou mettre à jour le repo ─────────────────────────────
Write-Step "Récupération du code source..."
if (Test-Path "$REPO_DIR\.git") {
    Write-Warn "Dossier $REPO_DIR existe déjà. Mise à jour..."
    try {
        git -C $REPO_DIR pull
        Write-OK "Code source mis à jour"
    } catch {
        Write-Fail "Erreur lors de la mise à jour du repo : $_"
    }
} else {
    try {
        git clone $REPO_URL $REPO_DIR
        Write-OK "Code source cloné dans $REPO_DIR"
    } catch {
        Write-Fail "Erreur lors du clonage du repo : $_"
    }
}

# ── Étape 4 : Créer l'environnement virtuel ───────────────────────────────
Write-Step "Création de l'environnement Python..."
$venvDir = "$REPO_DIR\venv"
if (-not (Test-Path $venvDir)) {
    try {
        & $pythonCmd -m venv $venvDir
        Write-OK "Environnement virtuel créé"
    } catch {
        Write-Fail "Erreur lors de la création du venv : $_"
    }
} else {
    Write-OK "Environnement virtuel déjà existant"
}

# ── Étape 5 : Installer les dépendances ──────────────────────────────────
Write-Step "Installation des dépendances Python..."
try {
    & "$venvDir\Scripts\pip.exe" install -r "$REPO_DIR\requirements.txt"
    Write-OK "Dépendances installées depuis requirements.txt"
} catch {
    Write-Fail "Erreur lors de l'installation des dépendances : $_"
}

# ── Étape 6 : Vérifier le fichier client_secret ───────────────────────────
Write-Step "Vérification du fichier d'authentification Google..."
$destSecret = "$env:USERPROFILE\Documents\client_secret_rse_dashboard.json"
if (Test-Path $destSecret) {
    Write-OK "Fichier client_secret_rse_dashboard.json trouvé dans Documents"
} else {
    Write-Warn "FICHIER MANQUANT : $destSecret"
    Write-Host ""
    Write-Host "  Action requise :" -ForegroundColor Yellow
    Write-Host "  1. Demandez à Blaise le fichier 'client_secret_rse_dashboard.json'" -ForegroundColor Yellow
    Write-Host "  2. Copiez-le dans : $env:USERPROFILE\Documents\" -ForegroundColor Yellow
    Write-Host "  3. Relancez update.bat pour commencer" -ForegroundColor Yellow
}

# ── Résumé ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Green
Write-Host "   Installation terminée avec succès !   " -ForegroundColor Green
Write-Host "════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Dossier du projet : $REPO_DIR" -ForegroundColor White
Write-Host ""
Write-Host "  Prochaine étape :" -ForegroundColor White
Write-Host "  → Double-cliquez sur 'update.bat' pour lancer la mise à jour" -ForegroundColor Cyan
Write-Host ""
Read-Host "Appuyez sur Entrée pour fermer"
