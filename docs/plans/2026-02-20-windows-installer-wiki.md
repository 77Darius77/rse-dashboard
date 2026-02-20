# Windows Installer + Wiki — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Créer un dossier `windows/` avec 4 fichiers (install.ps1, update.ps1, update.bat, README.txt) permettant à Blaise de mettre à jour le dashboard RSE depuis un PC Windows, et un wiki complet `docs/WIKI.md` pour maintenir le projet sans risque.

**Architecture:** Scripts PowerShell autonomes qui vérifient/installent Python + Git via winget, créent le venv, et lancent `update_data.py`. Le wiki est un fichier Markdown avec 8 sections couvrant architecture, fichiers, scoring, UI, dépannage et guide IA.

**Tech Stack:** PowerShell 5.1+ | winget (Windows Package Manager) | Markdown

---

## Task 1 : Script d'installation Windows (`windows/install.ps1`)

**Files:**
- Create: `rse-dashboard/windows/install.ps1`

**Step 1 : Créer le fichier install.ps1**

```powershell
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
        Write-OK "Git installé avec succès"
    } catch {
        Write-Fail "Impossible d'installer Git automatiquement. Téléchargez-le : https://git-scm.com/download/win"
    }
}

# ── Étape 3 : Cloner ou mettre à jour le repo ─────────────────────────────
Write-Step "Récupération du code source..."
if (Test-Path "$REPO_DIR\.git") {
    Write-Warn "Dossier $REPO_DIR existe déjà. Mise à jour..."
    git -C $REPO_DIR pull
    Write-OK "Code source mis à jour"
} else {
    git clone $REPO_URL $REPO_DIR
    Write-OK "Code source cloné dans $REPO_DIR"
}

# ── Étape 4 : Créer l'environnement virtuel ───────────────────────────────
Write-Step "Création de l'environnement Python..."
$venvDir = "$REPO_DIR\venv"
if (-not (Test-Path $venvDir)) {
    & $pythonCmd -m venv $venvDir
    Write-OK "Environnement virtuel créé"
} else {
    Write-OK "Environnement virtuel déjà existant"
}

# ── Étape 5 : Installer les dépendances ──────────────────────────────────
Write-Step "Installation des dépendances Python..."
& "$venvDir\Scripts\pip.exe" install -r "$REPO_DIR\requirements.txt" --quiet
Write-OK "Dépendances installées (gspread, google-auth-oauthlib)"

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
```

**Step 2 : Vérifier manuellement la syntaxe**

Ouvrir PowerShell et exécuter :
```powershell
Get-Content rse-dashboard/windows/install.ps1 | Select-String "function Write-"
```
Expected: 4 lignes (Write-Step, Write-OK, Write-Fail, Write-Warn)

**Step 3 : Commit**

```bash
git -C /home/blaise/SuperPouvoirs/rse-dashboard add windows/install.ps1
git -C /home/blaise/SuperPouvoirs/rse-dashboard commit -m "feat: add Windows installation script (PowerShell + winget)"
```

---

## Task 2 : Scripts de mise à jour Windows (`update.ps1` + `update.bat`)

**Files:**
- Create: `rse-dashboard/windows/update.ps1`
- Create: `rse-dashboard/windows/update.bat`

**Step 1 : Créer update.ps1**

```powershell
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
git -C $REPO_DIR pull --quiet
Write-OK "Code source à jour"

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
```

**Step 2 : Créer update.bat**

```batch
@echo off
REM Dashboard RSE - Mise à jour (double-clic pour lancer)
REM Ce fichier lance update.ps1 avec les bons droits PowerShell

powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0update.ps1"
```

**Step 3 : Commit**

```bash
git -C /home/blaise/SuperPouvoirs/rse-dashboard add windows/update.ps1 windows/update.bat
git -C /home/blaise/SuperPouvoirs/rse-dashboard commit -m "feat: add Windows update scripts (PowerShell + bat launcher)"
```

---

## Task 3 : Guide rapide Windows (`windows/README.txt`)

**Files:**
- Create: `rse-dashboard/windows/README.txt`

**Step 1 : Créer README.txt**

```
═══════════════════════════════════════════════════════════════
   DASHBOARD RSE FOURNISSEURS — Guide d'utilisation Windows
═══════════════════════════════════════════════════════════════

PREMIÈRE INSTALLATION (une seule fois)
───────────────────────────────────────
1. Copiez le fichier "client_secret_rse_dashboard.json" dans :
   C:\Users\[VotreNom]\Documents\

   (Demandez ce fichier à Blaise si vous ne l'avez pas)

2. Clic droit sur "install.ps1"
   → Sélectionnez "Exécuter avec PowerShell"
   → Si demande de confirmation : tapez "O" puis Entrée

   Le script va automatiquement :
   ✅ Installer Python si nécessaire
   ✅ Installer Git si nécessaire
   ✅ Télécharger le code du dashboard
   ✅ Configurer l'environnement Python

3. À la fin de l'installation, vous verrez :
   "Installation terminée avec succès !"


MISE À JOUR DES DONNÉES (à faire avant chaque présentation)
─────────────────────────────────────────────────────────────
1. Double-cliquez sur "update.bat"

2. Si c'est la première fois, une fenêtre Google s'ouvre :
   → Connectez-vous avec votre compte Google professionnel
   → Cliquez "Autoriser"
   → La fenêtre se ferme automatiquement (c'est normal)

3. Le script affiche les résultats :
   🟢 X bons élèves (≥67%)
   🟡 X en progression (34-66%)
   🔴 X prioritaires (≤33%)

4. Le dashboard s'ouvre automatiquement dans votre navigateur
   URL : https://77darius77.github.io/rse-dashboard/

   Note : les données apparaissent en ~2 minutes après la mise à jour


PROBLÈMES COURANTS
──────────────────
❌ "La connexion a échoué" sur localhost:8080
   → C'est NORMAL après l'authentification Google.
     Fermez cet onglet et attendez que le script finisse.

❌ "client_secret non trouvé"
   → Vérifiez que le fichier est bien dans Documents\
     et qu'il s'appelle exactement : client_secret_rse_dashboard.json

❌ Erreur 403 ou token expiré
   → Supprimez le fichier : rse-dashboard\scripts\token.json
   → Relancez update.bat (une nouvelle authentification sera demandée)

❌ "winget n'est pas reconnu"
   → Votre Windows est peut-être trop ancien.
     Installez Python manuellement : https://www.python.org/downloads/
     Installez Git manuellement : https://git-scm.com/download/win
     Puis relancez install.ps1


FICHIERS IMPORTANTS
────────────────────
update.bat          → Lanceur principal (double-clic)
update.ps1          → Script PowerShell de mise à jour
install.ps1         → Installation initiale (une seule fois)
README.txt          → Ce fichier

Dossier du projet installé : C:\Users\[VotreNom]\Documents\rse-dashboard\


SUPPORT
────────
Dashboard live : https://77darius77.github.io/rse-dashboard/
Repository     : https://github.com/77Darius77/rse-dashboard
```

**Step 2 : Commit**

```bash
git -C /home/blaise/SuperPouvoirs/rse-dashboard add windows/README.txt
git -C /home/blaise/SuperPouvoirs/rse-dashboard commit -m "docs: add Windows quick start guide"
```

---

## Task 4 : Wiki projet (`docs/WIKI.md`)

**Files:**
- Create: `rse-dashboard/docs/WIKI.md`

**Step 1 : Créer docs/WIKI.md**

Contenu complet (8 sections) :

```markdown
# Wiki — Dashboard RSE Fournisseurs

> Documentation complète pour maintenir, modifier et comprendre le projet.
> Dernière mise à jour : 2026-02-20

---

## Table des matières

1. [Architecture & flux de données](#1-architecture--flux-de-données)
2. [Structure des fichiers](#2-structure-des-fichiers)
3. [Mettre à jour le dashboard](#3-mettre-à-jour-le-dashboard)
4. [Modifier le scoring RSE](#4-modifier-le-scoring-rse)
5. [Personnaliser le dashboard](#5-personnaliser-le-dashboard)
6. [Gérer les fournisseurs](#6-gérer-les-fournisseurs)
7. [Dépannage](#7-dépannage)
8. [Guide pour agent IA](#8-guide-pour-agent-ia)

---

## 1. Architecture & flux de données

```
[Google Sheets]          [PC Local]                  [Internet]
  Sheet 3 (FR)  ──┐
                   ├──▶ update_data.py ──▶ public/data.json ──▶ git push ──▶ GitHub Pages
  Sheet 4 (EN)  ──┘          │
                              └──▶ scripts/token.json (auth, local uniquement)
```

**Modèle snapshot :** Le dashboard n'est PAS temps réel. Blaise lance manuellement
`python scripts/update_data.py` (ou `update.bat` sur Windows) avant une présentation
ou une réunion. Le dashboard GitHub Pages affiche alors les données du dernier run.

**Flux complet :**
1. `update_data.py` appelle `fetch_sheets.py` → authentification OAuth2 Google
2. Lecture des Sheet 3 (FR) et Sheet 4 (EN) via API Google Sheets
3. Chaque ligne de réponse est scorée par `scorer.py` (6 piliers, score global)
4. Résultat écrit dans `public/data.json`
5. `git add public/data.json && git commit && git push`
6. GitHub Pages sert `index.html` + `public/data.json` (~2 min de délai)

---

## 2. Structure des fichiers

```
rse-dashboard/
├── index.html                    ⭐ Dashboard principal (ne pas modifier sans lire §5)
├── public/
│   └── data.json                 🔄 GÉNÉRÉ AUTOMATIQUEMENT — ne pas éditer manuellement
├── scripts/
│   ├── update_data.py            🚀 Script principal — point d'entrée
│   ├── fetch_sheets.py           📡 Lecture Google Sheets API
│   ├── scorer.py                 🧮 Moteur de calcul des scores
│   ├── pillar_mapping.py         🗂️  Mapping colonnes → piliers (modifier pour changer le scoring)
│   ├── auth.py                   🔐 Authentification OAuth2 Google
│   └── token.json                🔒 TOKEN SECRET — gitignored, ne jamais committer
├── tests/
│   └── test_scorer.py            🧪 Tests unitaires du moteur de scoring
├── windows/
│   ├── install.ps1               💻 Installation Windows (une seule fois)
│   ├── update.ps1                💻 Mise à jour Windows
│   ├── update.bat                💻 Lanceur double-clic
│   └── README.txt                📖 Guide utilisateur Windows
├── docs/
│   ├── WIKI.md                   📚 Ce fichier
│   └── plans/                    📋 Documents de conception (historique)
├── requirements.txt              📦 Dépendances Python
└── .gitignore                    🚫 Fichiers exclus de git (token, venv, __pycache__)
```

### Règle d'or
| Fichier | Action | Risque si mal modifié |
|---------|--------|----------------------|
| `public/data.json` | Jamais éditer manuellement | Écrasé au prochain run |
| `scripts/token.json` | Jamais committer | Expose l'accès Google |
| `scripts/pillar_mapping.py` | Modifier avec précaution (voir §4) | Scores incorrects |
| `scripts/scorer.py` | Modifier avec précaution (voir §4) | Calculs erronés |
| `index.html` | Modifier avec précaution (voir §5) | Dashboard cassé |

---

## 3. Mettre à jour le dashboard

### Sur Linux/Mac
```bash
cd /home/blaise/SuperPouvoirs/rse-dashboard
source venv/bin/activate
python scripts/update_data.py
```

### Sur Windows
Double-clic sur `windows/update.bat`

### Ce qui se passe
```
[1/4] Lecture des Google Sheets...
  Lecture Sheet FR (1Ds0deb4...)...  → X réponses trouvées
  Lecture Sheet EN (1hZidS72...)...  → Y réponses trouvées
[2/4] Calcul des scores RSE...
  Calcul scores pour X fournisseurs FR...
  Calcul scores pour Y fournisseurs EN...
  N fournisseurs traités, score moyen : Z%
[3/4] Génération de data.json...
  Sauvegardé : public/data.json (XX.X KB)
[4/4] Commit & Push GitHub...
  Push GitHub OK → dashboard mis à jour dans ~2 minutes
✅ Terminé !
```

### Première utilisation (auth Google)
Un onglet navigateur s'ouvre → connectez-vous → cliquez Autoriser →
l'onglet affiche "The authentication flow has completed" → fermez-le.
Le token est sauvegardé dans `scripts/token.json` pour les prochaines fois.

---

## 4. Modifier le scoring RSE

> ⚠️ Toute modification du scoring impacte tous les fournisseurs. Faites un commit avant.

### 4.1 Changer les poids des piliers

**Fichier :** `scripts/pillar_mapping.py`, lignes 17-24

```python
PILLAR_WEIGHTS = {
    'gouvernance':    0.20,  # ← Modifier ici (ex: 0.25)
    'droits_humains': 0.15,
    'sst':            0.20,
    'ethique':        0.15,
    'environnement':  0.20,
    'achats':         0.10,
}
```
**Contrainte :** La somme doit toujours être égale à **1.0**

### 4.2 Ajouter une question à un pilier

**Fichier :** `scripts/pillar_mapping.py`, lignes 37-54

Exemple — ajouter la colonne 65 au pilier Environnement (FR) :
```python
PILLAR_COLUMNS_FR = {
    ...
    'environnement': [33, 43, 49, 53, 54, 56, 59, 61, 62, 65],  # ← ajouter 65
    ...
}
```
**Comment trouver l'indice de colonne :** Les colonnes sont 0-based (A=0, B=1...).
Ouvrez le Google Sheet, comptez la colonne depuis la gauche, soustrayez 1.

### 4.3 Modifier les seuils traffic light

**Fichier :** `scripts/scorer.py`, lignes 27-33

```python
def get_level(score: float) -> str:
    if score >= 67:   # ← Seuil vert (modifier ici, ex: 70)
        return 'green'
    if score >= 34:   # ← Seuil amber (modifier ici, ex: 40)
        return 'amber'
    return 'red'
```

### 4.4 Ajouter une recommandation automatique

**Fichier :** `scripts/pillar_mapping.py`, lignes 57-66

```python
KEY_RECOMMENDATIONS_FR = {
    10: "Initier une démarche de labellisation RSE...",
    ...
    99: "Nouveau message si la colonne 99 a une réponse faible",  # ← ajouter
}
```

### 4.5 Tester après modification

```bash
cd /home/blaise/SuperPouvoirs/rse-dashboard
source venv/bin/activate
python -m pytest tests/ -v
```
Expected: 15/15 tests passent.

---

## 5. Personnaliser le dashboard

> **Fichier :** `index.html` — Une seule page (~1500 lignes)

### 5.1 Changer les couleurs

Chercher dans `index.html` le bloc Tailwind config (~ligne 20) :
```javascript
tailwind.config = {
    theme: {
        extend: {
            colors: {
                primary: '#1B3F6E',   // ← Bleu corporate
                accent: '#00A896',    // ← Vert RSE
                danger: '#E63946',    // ← Rouge alerte
                warning: '#F4A261',   // ← Orange amber
            }
        }
    }
}
```

### 5.2 Modifier les labels des piliers

**Fichier :** `scripts/pillar_mapping.py`, lignes 27-34
```python
PILLAR_LABELS = {
    'gouvernance':    'Gouvernance RSE',  # ← Changer le texte affiché
    ...
}
```
Ces labels sont écrits dans `data.json` à chaque update, puis lus par le dashboard.

> ⚠️ **Attention :** Les clés (`'gouvernance'`, etc.) ne doivent PAS être modifiées
> — elles sont référencées dans `index.html`, `scorer.py` et `pillar_mapping.py`.

### 5.3 Modifier les KPIs de la vue Direction

Dans `index.html`, chercher `<!-- VUE DIRECTION -->` (Alpine.js `x-show="view === 'direction'"`).
Les 5 cartes KPI sont dans un bloc `grid grid-cols-2 md:grid-cols-5`.

### 5.4 Ajouter une nouvelle vue

1. Ajouter un lien dans la navbar : `<a @click="view='mavue'" ...>Ma Vue</a>`
2. Ajouter le bloc HTML : `<div x-show="view === 'mavue'"> ... </div>`
3. Si besoin d'état réactif : ajouter les variables dans `app()` (chercher `function app()`)

---

## 6. Gérer les fournisseurs

### Comment les fournisseurs entrent dans le dashboard
Le script lit automatiquement **toutes les lignes** du Google Sheet (Sheet 3 FR, Sheet 4 EN)
sauf la ligne d'en-tête. Chaque nouvelle réponse soumise au formulaire Google Forms
apparaît dans le sheet et sera scorée au prochain run de `update_data.py`.

### Colonnes importantes dans le Google Sheet
(Indices 0-based, communs FR et EN)

| Index | Colonne | Contenu |
|-------|---------|---------|
| 0 | A | Horodateur de réponse |
| 1 | B | Email du répondant |
| 2 | C | Nom de la société ← **identifiant principal** |
| 3 | D | Adresse |
| 4 | E | SIRET |
| 5 | F | Nom du contact |
| 6 | G | Rôle du contact |
| 7 | H | Email du contact |
| 8 | I | Contact RSE dédié |
| 9+ | J+ | Questions RSE |

### Que faire si un fournisseur a plusieurs réponses ?
Le script traite chaque ligne indépendamment. Si un fournisseur a répondu deux fois,
il apparaîtra deux fois dans le dashboard (avec le même nom mais des scores différents).
**Solution temporaire :** Supprimer la ligne obsolète dans le Google Sheet.

### Que faire si un fournisseur change de nom ?
L'ID du fournisseur dans `data.json` est généré depuis le nom de la société.
Un changement de nom crée un nouveau fournisseur dans le dashboard.
Pas d'impact sur les données historiques (chaque run repart de zéro).

---

## 7. Dépannage

| Erreur | Cause probable | Solution |
|--------|----------------|----------|
| `externally-managed-environment` | pip sans venv | `python3 -m venv venv && source venv/bin/activate` |
| `ModuleNotFoundError: gspread` | Venv non activé | `source venv/bin/activate` (Linux) ou `update.bat` (Windows) |
| `FileNotFoundError: client_secret` | Mauvais chemin ou fichier manquant | Vérifier `CLIENT_SECRET_PATH` dans `scripts/auth.py` |
| `403 Forbidden` / `Token has been expired` | Token OAuth expiré | Supprimer `scripts/token.json` et relancer |
| `SPREADSHEET_NOT_FOUND` | ID Sheet incorrect | Vérifier `SHEET_IDS` dans `scripts/fetch_sheets.py` |
| `La connexion a échoué (localhost:8080)` | Comportement normal après auth | Fermer l'onglet, attendre que le script finisse |
| Dashboard vide ou données obsolètes | data.json pas mis à jour | Relancer `python scripts/update_data.py` |
| `Permission denied` sur git push | Token GitHub sans scope `repo` | Utiliser `gh auth refresh --scopes repo` ou push manuel |
| `nothing to commit` | Aucune nouvelle donnée | Normal — les sheets n'ont pas changé depuis le dernier run |
| Score global incohérent | Somme PILLAR_WEIGHTS ≠ 1.0 | Vérifier et corriger `pillar_mapping.py` |

---

## 8. Guide pour agent IA

> Section dédiée à Claude Code, Cursor, Copilot ou tout autre agent IA
> qui interviendrait pour modifier ou étendre ce projet.

### Stack technique complète
- **Python 3.10+** avec venv (dossier `venv/` gitignored)
- **gspread 6.1.2** pour lire Google Sheets
- **google-auth-oauthlib 1.2.0** pour OAuth2
- **HTML/JS pur** — pas de build step, pas de npm, pas de bundler
- **Tailwind CSS CDN** (pas installé localement)
- **Alpine.js CDN** pour la réactivité SPA
- **Chart.js CDN** pour les graphiques
- **GitHub Pages** pour l'hébergement (branche `main`, racine `/`)

### Fichiers SENSIBLES — ne jamais lire/committer/exposer
```
scripts/token.json          ← Token OAuth2 Google (régénérable)
client_secret_*.json        ← Clés OAuth2 (hors repo, dans ~/Documents/)
venv/                       ← Environnement Python local
```

### Fichier généré automatiquement — ne jamais éditer manuellement
```
public/data.json            ← Écrasé à chaque run de update_data.py
```

### Points d'extension prévus
| Feature | Où ajouter | Notes |
|---------|-----------|-------|
| Nouvelle vue dashboard | `index.html` | Ajouter nav link + div x-show |
| Nouveau pilier RSE | `pillar_mapping.py` + `index.html` | Ajouter clé dans PILLAR_WEIGHTS, LABELS, COLUMNS |
| Nouvelle recommandation | `pillar_mapping.py` KEY_RECOMMENDATIONS | Ajouter `{col_idx: "message"}` |
| Export PDF | `index.html` | Utiliser `window.print()` + CSS @media print |
| Historique temporel | Nouveau script + data structure | Stocker snapshots dans `public/history/` |

### Workflow de mise à jour standard
```bash
# 1. Modifier le(s) fichier(s) concerné(s)
# 2. Si scorer.py ou pillar_mapping.py modifié → lancer les tests
python -m pytest tests/ -v  # doit retourner 15/15 passed
# 3. Commit avec message conventionnel
git commit -m "feat|fix|docs|refactor: description courte"
# 4. Push (déclenche la mise à jour GitHub Pages)
git push
```

### Conventions de code
- Python : snake_case, docstrings courtes, pas de classes inutiles
- JS/HTML : Alpine.js `x-data`, `x-show`, `@click` — pas de jQuery, pas de framework
- Couleurs : toujours utiliser les variables Tailwind (`text-primary`, `bg-accent`, etc.)
- Commits : préfixes conventionnels (`feat:`, `fix:`, `docs:`, `data:`, `refactor:`)

### Architecture de `index.html`
```
<script> tailwind.config   ← Palette de couleurs
<style>                    ← Classes custom (.card, .badge-*, .nav-link)
<body x-data="app()">      ← Composant Alpine.js principal
  <nav>                    ← Navigation entre les 5 vues
  <main>
    div[direction]         ← Vue Direction (KPIs, radar collectif, top/prioritaires)
    div[classement]        ← Vue Classement (table filtrée, export CSV)
    div[analyse]           ← Vue Analyse Collective (donuts, bar chart)
    div[comparaison]       ← Vue Comparaison (multi-select, radars côte à côte)
    div[fournisseur]       ← Fiche Fournisseur (radar individuel, recommandations)
<script>
  function app()           ← État global Alpine.js (data, view, filtres...)
  function classementView() ← Logique de tri/filtrage
  function comparaisonView() ← Logique de comparaison multi-select
```

### Données disponibles dans `data.json`
```javascript
data.meta.last_updated      // ISO datetime du dernier update
data.meta.total_responded   // Nombre total de fournisseurs
data.meta.count_fr          // Fournisseurs FR
data.meta.count_en          // Fournisseurs EN
data.collective.avg_score   // Score moyen global
data.collective.by_pillar   // {gouvernance: 61.2, ...}
data.collective.count_green/amber/red
data.collective.top_pillar  // Pilier le plus fort
data.collective.weak_pillar // Pilier le plus faible
data.suppliers[]            // Tableau trié par score décroissant
  .id / .name / .email / .siret / .address
  .contact_name / .contact_role / .contact_email / .rse_contact
  .responded_at / .language
  .score_global / .level ('green'|'amber'|'red')
  .scores.{gouvernance|droits_humains|sst|ethique|environnement|achats}
  .strengths[]    // Piliers avec score >= 80
  .weaknesses[]   // Piliers avec score < 50
  .recommendations[] // Messages auto-générés (max 5)
```
```

**Step 2 : Commit**

```bash
git -C /home/blaise/SuperPouvoirs/rse-dashboard add docs/WIKI.md
git -C /home/blaise/SuperPouvoirs/rse-dashboard commit -m "docs: add comprehensive project wiki (8 sections)"
```

---

## Task 5 : Push final et vérification

**Step 1 : Vérifier tous les fichiers sont bien présents**

```bash
find /home/blaise/SuperPouvoirs/rse-dashboard/windows -type f | sort
# Expected:
# .../windows/install.ps1
# .../windows/update.bat
# .../windows/update.ps1
# .../windows/README.txt

ls /home/blaise/SuperPouvoirs/rse-dashboard/docs/WIKI.md
# Expected: fichier présent
```

**Step 2 : Vérifier le git log**

```bash
git -C /home/blaise/SuperPouvoirs/rse-dashboard log --oneline -6
# Expected: 4 nouveaux commits (install.ps1, update.ps1+bat, README.txt, WIKI.md)
```

**Step 3 : Push vers GitHub**

```bash
git -C /home/blaise/SuperPouvoirs/rse-dashboard push
```

**Step 4 : Vérifier sur GitHub**

```bash
gh api repos/77Darius77/rse-dashboard/contents/windows --jq '.[].name'
# Expected: install.ps1, update.bat, update.ps1, README.txt

gh api repos/77Darius77/rse-dashboard/contents/docs --jq '.[].name'
# Expected: WIKI.md, plans/
```

**Step 5 : Commit de design doc**

```bash
git -C /home/blaise/SuperPouvoirs add docs/plans/2026-02-20-windows-installer-wiki-design.md docs/plans/2026-02-20-windows-installer-wiki.md
git -C /home/blaise/SuperPouvoirs commit -m "docs: add Windows installer + wiki design docs"
```
