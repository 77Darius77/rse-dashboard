# Dashboard RSE Fournisseurs — Plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Construire un dashboard GitHub Pages statique qui lit les réponses RSE fournisseurs depuis Google Sheets, calcule des scores par pilier, et affiche 5 vues professionnelles pour la direction.

**Architecture:** Script Python local (`update_data.py`) qui lit les Sheets 3 & 4 via OAuth2, calcule les scores, génère `public/data.json`, puis commit/push sur GitHub. Dashboard `index.html` pur statique qui lit ce JSON et affiche 5 vues via Alpine.js + Chart.js.

**Tech Stack:** Python 3 + gspread + google-auth-oauthlib | HTML + Tailwind CSS CDN + Alpine.js CDN + Chart.js CDN | GitHub Pages

**Design doc:** `docs/plans/2026-02-20-rse-dashboard-design.md`

---

## Task 1 : Structure du projet & configuration de base

**Files:**
- Create: `rse-dashboard/.gitignore`
- Create: `rse-dashboard/requirements.txt`
- Create: `rse-dashboard/public/.gitkeep`
- Create: `rse-dashboard/scripts/.gitkeep`

**Step 1 : Créer le dossier projet**

```bash
mkdir -p rse-dashboard/public rse-dashboard/scripts rse-dashboard/docs/plans
cd rse-dashboard
git init
```

**Step 2 : Créer `.gitignore`**

```
# Secrets OAuth2 - NE JAMAIS COMMITTER
scripts/token.json
client_secret*.json

# Python
__pycache__/
*.pyc
*.pyo
.env
venv/
.venv/

# OS
.DS_Store
Thumbs.db
```

**Step 3 : Créer `requirements.txt`**

```
gspread==6.1.2
google-auth-oauthlib==1.2.0
google-auth-httplib2==0.2.0
```

**Step 4 : Créer l'environnement virtuel et installer**

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
Expected: `Successfully installed gspread-6.1.2 ...`

**Step 5 : Commit initial**

```bash
git add .gitignore requirements.txt
git commit -m "chore: init project structure"
```

---

## Task 2 : Authentification Google Sheets (OAuth2)

**Files:**
- Create: `scripts/auth.py`
- Copy: `~/Documents/client_secret_*.json` → à côté du projet (hors repo)

**Context:** Le fichier `client_secret_639409032602-...json` existe déjà dans `/home/blaise/Documents/`. Il est configuré pour une app web (projet `n8n-2026-482918`). On doit ajouter `http://localhost` comme redirect URI autorisé dans Google Cloud Console pour le flux OAuth local.

**Step 1 : Ajouter le redirect URI localhost dans Google Cloud Console**

1. Aller sur https://console.cloud.google.com/apis/credentials
2. Sélectionner le projet `n8n-2026-482918`
3. Cliquer sur le client OAuth2 `639409032602-3am2fo7a905h842k3j39tto3rium91vm`
4. Dans "Authorized redirect URIs", ajouter : `http://localhost:8080/`
5. Sauvegarder

**Step 2 : Activer l'API Google Sheets sur le projet**

1. Aller sur https://console.cloud.google.com/apis/library
2. Chercher "Google Sheets API"
3. Cliquer "Enable" si pas déjà activé

**Step 3 : Créer `scripts/auth.py`**

```python
"""Authentification OAuth2 Google pour Google Sheets API."""

import os
import json
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
TOKEN_PATH = os.path.join(os.path.dirname(__file__), 'token.json')

# Chemin vers le fichier client_secret (hors repo, à adapter)
CLIENT_SECRET_PATH = os.path.expanduser(
    '~/Documents/client_secret_639409032602-3am2fo7a905h842k3j39tto3rium91vm.apps.googleusercontent.com.json'
)


def get_credentials():
    """Retourne des credentials valides, en rafraîchissant ou en demandant une auth si nécessaire."""
    creds = None

    # Réutiliser le token existant si valide
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

    # Si pas de credentials ou expirés, lancer le flux OAuth
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_PATH, SCOPES)
            creds = flow.run_local_server(port=8080)

        # Sauvegarder le token pour la prochaine fois
        with open(TOKEN_PATH, 'w') as token_file:
            token_file.write(creds.to_json())

    return creds
```

**Step 4 : Tester l'authentification**

```bash
cd rse-dashboard
python3 -c "
import sys; sys.path.insert(0, 'scripts')
from auth import get_credentials
creds = get_credentials()
print('Auth OK, token valide:', creds.valid)
"
```
Expected: Un navigateur s'ouvre → connexion Google → `Auth OK, token valide: True`

Si erreur `redirect_uri_mismatch` : retourner step 1 et vérifier le redirect URI.

**Step 5 : Commit**

```bash
git add scripts/auth.py
git commit -m "feat: add Google OAuth2 authentication module"
```

---

## Task 3 : Mapping questions → piliers RSE

**Files:**
- Create: `scripts/pillar_mapping.py`

**Context:** Les sheets FR (Sheet 3) et EN (Sheet 4) ont la même structure logique mais des intitulés différents. On mappe les **indices de colonnes** (0-based) aux piliers. Les colonnes 0-8 sont des métadonnées (nom, email, SIRET...). Les questions RSE commencent à la colonne 9.

**Step 1 : Créer `scripts/pillar_mapping.py`**

```python
"""
Mapping des colonnes des Google Sheets vers les 6 piliers RSE.
Les indices sont 0-based (colonne A = index 0).

Structure commune aux sheets FR et EN :
- Cols 0-8  : Métadonnées (horodateur, email, société, adresse, SIRET, contact...)
- Cols 9+   : Questions RSE

Règles de scoring :
- "Oui" / "Yes" → 1.0 point
- "Non" / "No"  → 0.0 point
- Texte libre non vide → 0.5 point (engagement partiel)
- Vide           → 0.0 point
"""

# Pondération des piliers (doit sommer à 1.0)
PILLAR_WEIGHTS = {
    'gouvernance':    0.20,
    'droits_humains': 0.15,
    'sst':            0.20,
    'ethique':        0.15,
    'environnement':  0.20,
    'achats':         0.10,
}

# Noms d'affichage des piliers
PILLAR_LABELS = {
    'gouvernance':    'Gouvernance RSE',
    'droits_humains': 'Droits Humains',
    'sst':            'Santé & Sécurité',
    'ethique':        'Éthique',
    'environnement':  'Environnement',
    'achats':         'Achats Responsables',
}

# Mapping colonnes → pilier pour le sheet FR (Sheet 3, indices 0-based)
# Col 9  = Q1 : Démarche RSE structurée
# Col 10 = Q1 : Labellisation RSE
# Col 12 = Q2 : Signataire engagement volontaire
# Col 13 = Q3 : Personne RSE dédiée
# Col 16 = Q4 : Rapport RSE publié
# Col 17 = Q5 : Code de conduite
# Col 18 = Q6 : Système d'alerte
PILLAR_COLUMNS_FR = {
    'gouvernance':    [9, 10, 12, 13, 16, 17, 18],
    'droits_humains': [19, 20],
    'sst':            [25, 26],
    'ethique':        [28, 29],
    'environnement':  [33, 43, 49, 53, 54, 56, 59, 61, 62],
    'achats':         [37, 40],
}

# Mapping colonnes → pilier pour le sheet EN (Sheet 4, indices 0-based)
# Structure identique au FR, même ordre logique
PILLAR_COLUMNS_EN = {
    'gouvernance':    [9, 10, 12, 13, 16, 17, 18],
    'droits_humains': [19, 20],
    'sst':            [25, 26],
    'ethique':        [28, 29],
    'environnement':  [33, 43, 49, 53, 54, 56, 59, 61, 62],
    'achats':         [37, 40],
}

# Questions clés pour les recommandations (col index → message si Non)
KEY_RECOMMENDATIONS_FR = {
    10: "Initier une démarche de labellisation RSE (EcoVadis, ISO 26000, B Corp...)",
    16: "Publier un rapport RSE ou développement durable annuel (guide GRI disponible)",
    61: "Mesurer les émissions CO2 liées au transport des marchandises (bilan carbone)",
    62: "Mettre en place des actions de réduction de l'empreinte carbone transport",
    43: "Suivre des indicateurs environnementaux de base (énergie, eau, déchets, CO2)",
    49: "Mettre en place un suivi et une réduction des déchets",
    18: "Créer un système de remontée d'alertes pour les parties prenantes",
    40: "Former les collaborateurs aux enjeux RSE (éthique, environnement, social)",
}

# Mêmes recommandations pour EN (même logique)
KEY_RECOMMENDATIONS_EN = {
    10: "Pursue third-party RSE labelling (EcoVadis, ISO 26000, B Corp...)",
    16: "Publish an annual CSR/sustainability report (GRI guidelines available)",
    61: "Measure CO2 emissions related to goods transport (carbon footprint)",
    62: "Implement actions to reduce transport-related carbon footprint",
    43: "Track basic environmental indicators (energy, water, waste, CO2)",
    49: "Set up waste monitoring and reduction processes",
    18: "Establish a stakeholder concern reporting system",
    40: "Train employees on CSR topics (ethics, environment, social, OHS)",
}

# Indices des colonnes métadonnées (communes FR et EN)
META_COLUMNS = {
    'timestamp':    0,
    'email':        1,
    'name':         2,
    'address':      3,
    'siret':        4,
    'contact_name': 5,
    'contact_role': 6,
    'contact_email':7,
    'rse_contact':  8,
}
```

**Step 2 : Vérifier que les pondérations somment à 1.0**

```bash
python3 -c "
import sys; sys.path.insert(0, 'scripts')
from pillar_mapping import PILLAR_WEIGHTS
total = sum(PILLAR_WEIGHTS.values())
assert abs(total - 1.0) < 0.001, f'Pondérations incorrectes: {total}'
print('Pondérations OK:', total)
"
```
Expected: `Pondérations OK: 1.0`

**Step 3 : Commit**

```bash
git add scripts/pillar_mapping.py
git commit -m "feat: add RSE pillar mapping and scoring configuration"
```

---

## Task 4 : Moteur de scoring RSE

**Files:**
- Create: `scripts/scorer.py`
- Create: `tests/test_scorer.py`

**Step 1 : Créer `tests/test_scorer.py`**

```python
"""Tests pour le moteur de scoring RSE."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from scorer import score_answer, score_pillar, score_supplier, get_level


def test_score_answer_oui():
    assert score_answer("Oui") == 1.0

def test_score_answer_yes():
    assert score_answer("Yes") == 1.0

def test_score_answer_non():
    assert score_answer("Non") == 0.0

def test_score_answer_no():
    assert score_answer("No") == 0.0

def test_score_answer_text():
    assert score_answer("Nous utilisons des panneaux solaires") == 0.5

def test_score_answer_empty():
    assert score_answer("") == 0.0

def test_score_answer_none():
    assert score_answer(None) == 0.0

def test_score_pillar_all_oui():
    row = [""] * 70
    row[9] = "Oui"
    row[10] = "Oui"
    score = score_pillar(row, [9, 10])
    assert score == 100.0

def test_score_pillar_mixed():
    row = [""] * 70
    row[9] = "Oui"
    row[10] = "Non"
    score = score_pillar(row, [9, 10])
    assert score == 50.0

def test_score_pillar_empty_cols():
    row = [""] * 70
    score = score_pillar(row, [9, 10])
    assert score == 0.0

def test_get_level_green():
    assert get_level(80) == "green"

def test_get_level_amber():
    assert get_level(50) == "amber"

def test_get_level_red():
    assert get_level(20) == "red"

def test_get_level_boundary_green():
    assert get_level(67) == "green"

def test_get_level_boundary_red():
    assert get_level(33) == "red"
```

**Step 2 : Lancer les tests — ils doivent échouer**

```bash
python3 -m pytest tests/test_scorer.py -v 2>&1 | head -20
```
Expected: `ModuleNotFoundError: No module named 'scorer'`

**Step 3 : Créer `scripts/scorer.py`**

```python
"""Moteur de calcul des scores RSE par pilier et global."""

from pillar_mapping import PILLAR_WEIGHTS, PILLAR_COLUMNS_FR, PILLAR_COLUMNS_EN
from pillar_mapping import KEY_RECOMMENDATIONS_FR, KEY_RECOMMENDATIONS_EN, META_COLUMNS


def score_answer(value: str | None) -> float:
    """Convertit une réponse brute en score numérique 0.0 à 1.0."""
    if not value or not str(value).strip():
        return 0.0
    v = str(value).strip().lower()
    if v in ('oui', 'yes'):
        return 1.0
    if v in ('non', 'no'):
        return 0.0
    # Texte libre non vide = engagement partiel
    return 0.5


def score_pillar(row: list, col_indices: list) -> float:
    """Calcule le score d'un pilier (0-100) pour une ligne de données."""
    if not col_indices:
        return 0.0
    total = sum(score_answer(row[i] if i < len(row) else None) for i in col_indices)
    return round((total / len(col_indices)) * 100, 1)


def score_supplier(row: list, language: str = 'fr') -> dict:
    """
    Calcule tous les scores et métadonnées pour un fournisseur.

    Args:
        row: Liste des valeurs de la ligne Google Sheets (0-based)
        language: 'fr' ou 'en'

    Returns:
        Dictionnaire complet du fournisseur prêt pour data.json
    """
    pillar_cols = PILLAR_COLUMNS_FR if language == 'fr' else PILLAR_COLUMNS_EN
    reco_map = KEY_RECOMMENDATIONS_FR if language == 'fr' else KEY_RECOMMENDATIONS_EN

    # Calcul scores par pilier
    pillar_scores = {
        pillar: score_pillar(row, cols)
        for pillar, cols in pillar_cols.items()
    }

    # Score global pondéré
    global_score = round(sum(
        pillar_scores[p] * w for p, w in PILLAR_WEIGHTS.items()
    ), 1)

    # Niveau traffic light
    level = get_level(global_score)

    # Forces : piliers avec score >= 80
    strengths = [p for p, s in pillar_scores.items() if s >= 80]

    # Lacunes : piliers avec score < 50
    weaknesses = [p for p, s in pillar_scores.items() if s < 50]

    # Recommandations basées sur les réponses Non aux questions clés
    recommendations = []
    for col_idx, message in reco_map.items():
        if col_idx < len(row) and score_answer(row[col_idx]) < 0.5:
            recommendations.append(message)

    # Métadonnées
    def get_meta(key):
        idx = META_COLUMNS.get(key, -1)
        return row[idx].strip() if idx >= 0 and idx < len(row) and row[idx] else ''

    # ID slug depuis le nom de la société
    name = get_meta('name')
    supplier_id = name.lower().replace(' ', '-').replace('/', '-')[:50]

    return {
        'id': supplier_id,
        'name': name,
        'email': get_meta('email'),
        'siret': get_meta('siret'),
        'address': get_meta('address'),
        'contact_name': get_meta('contact_name'),
        'contact_role': get_meta('contact_role'),
        'contact_email': get_meta('contact_email'),
        'rse_contact': get_meta('rse_contact'),
        'responded_at': get_meta('timestamp'),
        'language': language,
        'score_global': global_score,
        'level': level,
        'scores': pillar_scores,
        'strengths': strengths,
        'weaknesses': weaknesses,
        'recommendations': recommendations[:5],  # Max 5 recommandations
    }


def get_level(score: float) -> str:
    """Retourne le niveau traffic light selon le score."""
    if score >= 67:
        return 'green'
    if score >= 34:
        return 'amber'
    return 'red'


def compute_collective_stats(suppliers: list) -> dict:
    """Calcule les statistiques agrégées de tous les fournisseurs."""
    if not suppliers:
        return {}

    scores_by_pillar = {p: [] for p in PILLAR_WEIGHTS.keys()}
    all_scores = []

    for s in suppliers:
        all_scores.append(s['score_global'])
        for pillar, score in s['scores'].items():
            scores_by_pillar[pillar].append(score)

    avg_by_pillar = {
        p: round(sum(scores) / len(scores), 1) if scores else 0
        for p, scores in scores_by_pillar.items()
    }

    levels = [s['level'] for s in suppliers]

    return {
        'avg_score': round(sum(all_scores) / len(all_scores), 1) if all_scores else 0,
        'by_pillar': avg_by_pillar,
        'count_green': levels.count('green'),
        'count_amber': levels.count('amber'),
        'count_red': levels.count('red'),
        'top_pillar': max(avg_by_pillar, key=avg_by_pillar.get),
        'weak_pillar': min(avg_by_pillar, key=avg_by_pillar.get),
    }
```

**Step 4 : Lancer les tests — ils doivent passer**

```bash
python3 -m pytest tests/test_scorer.py -v
```
Expected: `15 passed`

**Step 5 : Commit**

```bash
git add scripts/scorer.py tests/test_scorer.py
git commit -m "feat: add RSE scoring engine with tests"
```

---

## Task 5 : Lecture des Google Sheets et génération de data.json

**Files:**
- Create: `scripts/fetch_sheets.py`
- Create: `scripts/update_data.py`

**Step 1 : Créer `scripts/fetch_sheets.py`**

```python
"""Lecture des Google Sheets via l'API et extraction des données brutes."""

import gspread
from auth import get_credentials

# IDs des Google Sheets (extraits des URLs partagées)
SHEET_IDS = {
    'fr': '1Ds0deb4YfVSFjEEKSevwC-OdU_V-dAzaOGEFtzejlfk',  # Sheet 3 FR - Actif
    'en': '1hZidS721UzcFBFIRi6nwJiqX92QGc3tzvXHGqIZwXns',  # Sheet 4 EN - Actif
}

# Nom de l'onglet contenant les réponses
TAB_NAME = 'Réponses au formulaire 1'


def fetch_sheet_data(sheet_id: str, tab_name: str = TAB_NAME) -> list[list]:
    """
    Lit toutes les données d'un onglet Google Sheets.

    Returns:
        Liste de listes : [headers, row1, row2, ...]
        Les lignes vides sont filtrées.
    """
    creds = get_credentials()
    gc = gspread.authorize(creds)

    sheet = gc.open_by_key(sheet_id)
    worksheet = sheet.worksheet(tab_name)

    # Récupérer toutes les valeurs (incluant les vides)
    all_values = worksheet.get_all_values()

    # Filtrer les lignes entièrement vides (sauf la première = headers)
    if len(all_values) <= 1:
        return all_values

    headers = all_values[0]
    data_rows = [row for row in all_values[1:] if any(cell.strip() for cell in row)]

    return [headers] + data_rows


def fetch_all_sheets() -> dict:
    """
    Lit les deux sheets actifs (FR et EN).

    Returns:
        {'fr': [headers, row1, ...], 'en': [headers, row1, ...]}
    """
    result = {}
    for lang, sheet_id in SHEET_IDS.items():
        print(f"  Lecture Sheet {lang.upper()} ({sheet_id[:20]}...)...")
        data = fetch_sheet_data(sheet_id)
        nb_responses = max(0, len(data) - 1)
        print(f"  → {nb_responses} réponses trouvées")
        result[lang] = data
    return result
```

**Step 2 : Créer `scripts/update_data.py`**

```python
#!/usr/bin/env python3
"""
Script principal de mise à jour du dashboard RSE.

Usage:
    python scripts/update_data.py

Lit les Google Sheets FR et EN, calcule les scores RSE,
génère public/data.json, puis commit et push sur GitHub.
"""

import json
import os
import subprocess
import sys
from datetime import datetime

# Ajouter le dossier scripts au path
sys.path.insert(0, os.path.dirname(__file__))

from fetch_sheets import fetch_all_sheets
from scorer import score_supplier, compute_collective_stats

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'data.json')


def build_data_json(sheets_data: dict) -> dict:
    """Construit le dictionnaire complet pour data.json."""
    all_suppliers = []

    for lang, sheet_rows in sheets_data.items():
        if len(sheet_rows) <= 1:
            print(f"  Aucune donnée pour {lang.upper()}, skip.")
            continue

        data_rows = sheet_rows[1:]  # Exclure la ligne d'headers
        print(f"  Calcul scores pour {len(data_rows)} fournisseurs {lang.upper()}...")

        for row in data_rows:
            if not row or not row[2].strip():  # Ignorer si pas de nom de société
                continue
            supplier = score_supplier(row, language=lang)
            all_suppliers.append(supplier)

    # Trier par score décroissant
    all_suppliers.sort(key=lambda s: s['score_global'], reverse=True)

    # Statistiques collectives
    collective = compute_collective_stats(all_suppliers)

    return {
        'meta': {
            'last_updated': datetime.now().isoformat(),
            'total_responded': len(all_suppliers),
            'count_fr': sum(1 for s in all_suppliers if s['language'] == 'fr'),
            'count_en': sum(1 for s in all_suppliers if s['language'] == 'en'),
        },
        'collective': collective,
        'suppliers': all_suppliers,
    }


def save_json(data: dict, path: str) -> None:
    """Sauvegarde data.json avec indentation lisible."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    size_kb = os.path.getsize(path) / 1024
    print(f"  Sauvegardé : {path} ({size_kb:.1f} KB)")


def git_commit_push(message: str) -> None:
    """Commit et push les changements sur GitHub."""
    repo_root = os.path.join(os.path.dirname(__file__), '..')
    cmds = [
        ['git', 'add', 'public/data.json'],
        ['git', 'commit', '-m', message],
        ['git', 'push'],
    ]
    for cmd in cmds:
        result = subprocess.run(cmd, cwd=repo_root, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"  Erreur git: {result.stderr}")
            return
    print("  Push GitHub OK → dashboard mis à jour dans ~2 minutes")


def main():
    print("=" * 50)
    print("Dashboard RSE — Mise à jour des données")
    print("=" * 50)

    print("\n[1/4] Lecture des Google Sheets...")
    sheets_data = fetch_all_sheets()

    print("\n[2/4] Calcul des scores RSE...")
    data = build_data_json(sheets_data)
    total = data['meta']['total_responded']
    avg = data['collective'].get('avg_score', 0)
    print(f"  {total} fournisseurs traités, score moyen : {avg}%")

    print("\n[3/4] Génération de data.json...")
    save_json(data, OUTPUT_PATH)

    print("\n[4/4] Commit & Push GitHub...")
    now = datetime.now().strftime('%Y-%m-%d %H:%M')
    git_commit_push(f"data: update RSE scores {now} ({total} suppliers)")

    print("\n✅ Terminé ! Le dashboard sera mis à jour dans ~2 minutes.")
    print(f"   Score moyen global : {avg}%")
    print(f"   🟢 {data['collective'].get('count_green', 0)} bons élèves")
    print(f"   🟡 {data['collective'].get('count_amber', 0)} en progression")
    print(f"   🔴 {data['collective'].get('count_red', 0)} prioritaires")


if __name__ == '__main__':
    main()
```

**Step 3 : Tester le script en mode dry-run (sans git push)**

```bash
cd rse-dashboard
source venv/bin/activate
python3 scripts/update_data.py
```
Expected:
```
[1/4] Lecture des Google Sheets...
  Lecture Sheet FR...
  → N réponses trouvées
  Lecture Sheet EN...
  → 2 réponses trouvées
[2/4] Calcul des scores RSE...
[3/4] Génération de data.json...
  Sauvegardé : public/data.json (X KB)
```

Si erreur auth : vérifier que `token.json` n'existe pas encore (première exécution = ouverture navigateur).

**Step 4 : Vérifier le JSON généré**

```bash
python3 -c "
import json
with open('public/data.json') as f:
    d = json.load(f)
print('Fournisseurs:', d['meta']['total_responded'])
print('Score moyen:', d['collective']['avg_score'])
print('Premier:', d['suppliers'][0]['name'], d['suppliers'][0]['score_global'])
"
```
Expected: Affiche le nombre de fournisseurs et le premier avec son score.

**Step 5 : Commit**

```bash
git add scripts/fetch_sheets.py scripts/update_data.py public/data.json
git commit -m "feat: add Google Sheets fetcher and data.json generator"
```

---

## Task 6 : HTML de base — SPA avec navigation

**Files:**
- Create: `index.html`

**Step 1 : Créer la structure HTML de base avec Alpine.js et navigation**

Créer `index.html` :

```html
<!DOCTYPE html>
<html lang="fr" x-data="app()" x-init="init()">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard RSE Fournisseurs</title>

  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Alpine.js -->
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>

  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#1B3F6E',
            accent:  '#00A896',
            danger:  '#E63946',
            warning: '#F4A261',
          },
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
          }
        }
      }
    }
  </script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    [x-cloak] { display: none !important; }
    .card { @apply bg-white rounded-xl shadow-sm border border-gray-100 p-5; }
    .badge-green  { @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800; }
    .badge-amber  { @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800; }
    .badge-red    { @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800; }
    .progress-bar { @apply h-1.5 rounded-full; }
    .nav-link { @apply px-4 py-2 rounded-lg text-sm font-medium transition-colors; }
    .nav-link.active { @apply bg-primary text-white; }
    .nav-link:not(.active) { @apply text-gray-600 hover:bg-gray-100; }
  </style>
</head>
<body class="bg-gray-50 font-sans text-gray-900 min-h-screen">

  <!-- Navbar -->
  <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo + titre -->
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span class="text-white text-xs font-bold">RSE</span>
          </div>
          <div>
            <div class="font-bold text-primary text-sm leading-tight">Dashboard RSE</div>
            <div class="text-xs text-gray-400 leading-tight">Suivi Fournisseurs</div>
          </div>
        </div>

        <!-- Navigation -->
        <div class="flex items-center gap-1">
          <button @click="view='direction'"
            :class="view==='direction' ? 'active' : ''"
            class="nav-link">Direction</button>
          <button @click="view='classement'"
            :class="view==='classement' ? 'active' : ''"
            class="nav-link">Classement</button>
          <button @click="view='analyse'"
            :class="view==='analyse' ? 'active' : ''"
            class="nav-link">Analyse</button>
          <button @click="view='comparaison'"
            :class="view==='comparaison' ? 'active' : ''"
            class="nav-link">Comparaison</button>
        </div>

        <!-- Dernière MAJ -->
        <div class="text-xs text-gray-400" x-text="lastUpdated"></div>
      </div>
    </div>
  </nav>

  <!-- Contenu principal -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

    <!-- Loading state -->
    <div x-show="loading" x-cloak class="flex items-center justify-center h-64">
      <div class="text-gray-400 text-sm">Chargement des données...</div>
    </div>

    <!-- Error state -->
    <div x-show="error && !loading" x-cloak class="card text-center py-12">
      <p class="text-red-500 text-sm" x-text="error"></p>
    </div>

    <!-- Vues -->
    <div x-show="!loading && !error" x-cloak>
      <div x-show="view === 'direction'"   x-component="direction-view"></div>
      <div x-show="view === 'classement'"  x-component="classement-view"></div>
      <div x-show="view === 'analyse'"     x-component="analyse-view"></div>
      <div x-show="view === 'comparaison'" x-component="comparaison-view"></div>
      <div x-show="view === 'fournisseur'" x-component="fournisseur-view"></div>
    </div>
  </main>

  <script>
    function app() {
      return {
        view: 'direction',
        loading: true,
        error: null,
        data: null,
        selectedSupplier: null,
        lastUpdated: '',

        async init() {
          try {
            const res = await fetch('public/data.json');
            if (!res.ok) throw new Error('Impossible de charger les données');
            this.data = await res.json();
            this.lastUpdated = 'Mis à jour : ' + new Date(this.data.meta.last_updated)
              .toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            this.loading = false;
            this.$nextTick(() => lucide.createIcons());
          } catch (e) {
            this.error = 'Erreur de chargement : ' + e.message;
            this.loading = false;
          }
        },

        openSupplier(supplier) {
          this.selectedSupplier = supplier;
          this.view = 'fournisseur';
        },

        getLevelClass(level) {
          return level === 'green' ? 'badge-green' : level === 'amber' ? 'badge-amber' : 'badge-red';
        },

        getLevelLabel(level) {
          return level === 'green' ? '🟢 Bon élève' : level === 'amber' ? '🟡 En progression' : '🔴 Prioritaire';
        },

        getPillarLabel(key) {
          const labels = {
            gouvernance: 'Gouvernance RSE', droits_humains: 'Droits Humains',
            sst: 'Santé & Sécurité', ethique: 'Éthique',
            environnement: 'Environnement', achats: 'Achats Responsables'
          };
          return labels[key] || key;
        },

        getScoreColor(score) {
          if (score >= 67) return 'bg-green-500';
          if (score >= 34) return 'bg-amber-400';
          return 'bg-red-500';
        }
      }
    }
  </script>
</body>
</html>
```

**Step 2 : Tester l'ouverture dans le navigateur (avec un data.json de test)**

```bash
# Créer un data.json minimal de test
cat > public/data.json << 'EOF'
{"meta":{"last_updated":"2026-02-20T10:00:00","total_responded":2,"count_fr":1,"count_en":1},"collective":{"avg_score":65.0,"by_pillar":{"gouvernance":60,"droits_humains":90,"sst":95,"ethique":88,"environnement":50,"achats":75},"count_green":1,"count_amber":1,"count_red":0},"suppliers":[{"id":"test-fr","name":"Fournisseur Test FR","language":"fr","score_global":75.0,"level":"green","scores":{"gouvernance":70,"droits_humains":100,"sst":100,"ethique":90,"environnement":55,"achats":80},"strengths":["sst","ethique"],"weaknesses":["environnement"],"recommendations":["Initier une labellisation RSE"]},{"id":"test-en","name":"Test Supplier EN","language":"en","score_global":55.0,"level":"amber","scores":{"gouvernance":50,"droits_humains":80,"sst":90,"ethique":85,"environnement":30,"achats":65},"strengths":["sst"],"weaknesses":["environnement","gouvernance"],"recommendations":["Publish CSR report","Measure CO2"]}]}
EOF

# Ouvrir dans le navigateur (Python serveur local)
python3 -m http.server 3000
```

Ouvrir http://localhost:3000 → La navbar doit s'afficher, "Chargement des données..." puis disparaître.

**Step 3 : Commit**

```bash
git add index.html public/data.json
git commit -m "feat: add SPA base structure with navigation and Alpine.js"
```

---

## Task 7 : Vue Direction — KPIs et radar collectif

**Files:**
- Modify: `index.html` — ajouter la vue Direction dans le `<main>`

**Step 1 : Remplacer le placeholder `x-component="direction-view"` par le HTML réel**

Trouver `<div x-show="view === 'direction'"   x-component="direction-view"></div>` et remplacer par :

```html
<div x-show="view === 'direction'">
  <h1 class="text-2xl font-bold text-primary mb-6">Vue Direction</h1>

  <!-- KPI Cards -->
  <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
    <!-- Score moyen global -->
    <div class="card text-center col-span-2 md:col-span-1">
      <div class="text-4xl font-bold text-accent" x-text="data.collective.avg_score + '%'"></div>
      <div class="text-xs text-gray-500 mt-1">Score RSE Moyen</div>
    </div>
    <!-- Taux de participation -->
    <div class="card text-center">
      <div class="text-3xl font-bold text-primary" x-text="data.meta.total_responded"></div>
      <div class="text-xs text-gray-500 mt-1">Ont répondu</div>
    </div>
    <!-- Bons élèves -->
    <div class="card text-center">
      <div class="text-3xl font-bold text-green-600" x-text="data.collective.count_green"></div>
      <div class="text-xs text-gray-500 mt-1">🟢 Bons élèves</div>
    </div>
    <!-- En progression -->
    <div class="card text-center">
      <div class="text-3xl font-bold text-amber-500" x-text="data.collective.count_amber"></div>
      <div class="text-xs text-gray-500 mt-1">🟡 En progression</div>
    </div>
    <!-- Prioritaires -->
    <div class="card text-center">
      <div class="text-3xl font-bold text-red-600" x-text="data.collective.count_red"></div>
      <div class="text-xs text-gray-500 mt-1">🔴 Prioritaires</div>
    </div>
  </div>

  <!-- Radar collectif + Forces/Lacunes -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
    <!-- Radar -->
    <div class="card">
      <h2 class="text-base font-semibold text-gray-700 mb-4">Performance collective — 6 piliers</h2>
      <canvas id="radarCollectif" height="280"></canvas>
    </div>

    <!-- Forces & Lacunes -->
    <div class="card flex flex-col gap-4">
      <div>
        <h2 class="text-base font-semibold text-gray-700 mb-3">✅ Points forts collectifs</h2>
        <div class="space-y-2">
          <template x-for="[pillar, score] in topPillars()" :key="pillar">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600" x-text="getPillarLabel(pillar)"></span>
              <div class="flex items-center gap-2">
                <div class="w-24 bg-gray-100 rounded-full h-1.5">
                  <div class="progress-bar bg-green-500" :style="'width:' + score + '%'"></div>
                </div>
                <span class="text-xs font-semibold text-green-700 w-8 text-right" x-text="score + '%'"></span>
              </div>
            </div>
          </template>
        </div>
      </div>
      <hr class="border-gray-100">
      <div>
        <h2 class="text-base font-semibold text-gray-700 mb-3">⚠️ Lacunes prioritaires</h2>
        <div class="space-y-2">
          <template x-for="[pillar, score] in weakPillars()" :key="pillar">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600" x-text="getPillarLabel(pillar)"></span>
              <div class="flex items-center gap-2">
                <div class="w-24 bg-gray-100 rounded-full h-1.5">
                  <div class="progress-bar bg-red-500" :style="'width:' + score + '%'"></div>
                </div>
                <span class="text-xs font-semibold text-red-600 w-8 text-right" x-text="score + '%'"></span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- Top 5 & Prioritaires -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- Top 5 performeurs -->
    <div class="card">
      <h2 class="text-base font-semibold text-gray-700 mb-4">🏆 Top 5 performeurs</h2>
      <div class="space-y-3">
        <template x-for="(s, i) in data.suppliers.slice(0, 5)" :key="s.id">
          <div class="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg p-1 -m-1"
               @click="openSupplier(s)">
            <span class="text-lg font-bold text-gray-300 w-6" x-text="i+1"></span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate" x-text="s.name"></div>
            </div>
            <span :class="getLevelClass(s.level)" x-text="s.score_global + '%'"></span>
          </div>
        </template>
      </div>
    </div>

    <!-- Fournisseurs prioritaires -->
    <div class="card">
      <h2 class="text-base font-semibold text-gray-700 mb-4">🆘 Accompagnement prioritaire</h2>
      <div class="space-y-3">
        <template x-for="s in prioritySuppliers()" :key="s.id">
          <div class="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg p-1 -m-1"
               @click="openSupplier(s)">
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate" x-text="s.name"></div>
              <div class="text-xs text-gray-400" x-text="s.recommendations[0] || ''"></div>
            </div>
            <span :class="getLevelClass(s.level)" x-text="s.score_global + '%'"></span>
          </div>
        </template>
        <div x-show="prioritySuppliers().length === 0" class="text-sm text-gray-400 text-center py-4">
          Aucun fournisseur en zone rouge 🎉
        </div>
      </div>
    </div>
  </div>
</div>
```

**Step 2 : Ajouter les méthodes Alpine dans `app()`**

Dans la fonction `app()`, après `getScoreColor`, ajouter :

```javascript
topPillars() {
  if (!this.data) return [];
  return Object.entries(this.data.collective.by_pillar)
    .sort(([,a],[,b]) => b - a).slice(0, 3);
},

weakPillars() {
  if (!this.data) return [];
  return Object.entries(this.data.collective.by_pillar)
    .sort(([,a],[,b]) => a - b).slice(0, 3);
},

prioritySuppliers() {
  if (!this.data) return [];
  return this.data.suppliers.filter(s => s.level === 'red').slice(0, 5);
},
```

**Step 3 : Initialiser le radar avec Chart.js après le chargement des données**

Dans `init()`, après `this.loading = false;`, ajouter :

```javascript
this.$nextTick(() => {
  this.initRadarChart();
  lucide.createIcons();
});
```

Ajouter la méthode `initRadarChart()` dans `app()` :

```javascript
initRadarChart() {
  const canvas = document.getElementById('radarCollectif');
  if (!canvas || !this.data) return;
  const pillarData = this.data.collective.by_pillar;
  new Chart(canvas, {
    type: 'radar',
    data: {
      labels: ['Gouvernance RSE', 'Droits Humains', 'Santé & Sécurité', 'Éthique', 'Environnement', 'Achats Responsables'],
      datasets: [{
        label: 'Score moyen (%)',
        data: [
          pillarData.gouvernance, pillarData.droits_humains, pillarData.sst,
          pillarData.ethique, pillarData.environnement, pillarData.achats
        ],
        backgroundColor: 'rgba(0, 168, 150, 0.15)',
        borderColor: '#00A896',
        pointBackgroundColor: '#1B3F6E',
        pointRadius: 4,
        borderWidth: 2,
      }]
    },
    options: {
      scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, font: { size: 10 } } } },
      plugins: { legend: { display: false } },
      responsive: true,
    }
  });
},
```

**Step 4 : Vérifier visuellement dans le navigateur**

```bash
python3 -m http.server 3000
```
Ouvrir http://localhost:3000 → Vue Direction doit afficher : 5 KPI cards + radar + forces/lacunes + top 5 + prioritaires.

**Step 5 : Commit**

```bash
git add index.html
git commit -m "feat: add direction view with KPI cards and collective radar chart"
```

---

## Task 8 : Vue Classement — Tableau filtrable

**Step 1 : Remplacer le placeholder `classement-view`**

Dans `index.html`, remplacer `<div x-show="view === 'classement'" x-component="classement-view"></div>` par :

```html
<div x-show="view === 'classement'" x-data="classementView()">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-primary">Classement Fournisseurs</h1>
    <button @click="exportCSV()" class="text-xs text-gray-500 hover:text-primary border rounded-lg px-3 py-1.5">
      📥 Export CSV
    </button>
  </div>

  <!-- Filtres -->
  <div class="card mb-6">
    <div class="flex flex-wrap gap-3">
      <input x-model="search" type="text" placeholder="🔍 Rechercher un fournisseur..."
             class="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-accent">
      <select x-model="filterLevel" class="border rounded-lg px-3 py-1.5 text-sm">
        <option value="">Tous les niveaux</option>
        <option value="green">🟢 Bons élèves</option>
        <option value="amber">🟡 En progression</option>
        <option value="red">🔴 Prioritaires</option>
      </select>
      <select x-model="filterLang" class="border rounded-lg px-3 py-1.5 text-sm">
        <option value="">FR + EN</option>
        <option value="fr">🇫🇷 FR seulement</option>
        <option value="en">🇬🇧 EN seulement</option>
      </select>
      <span class="text-xs text-gray-400 self-center" x-text="filteredSuppliers().length + ' fournisseur(s)'"></span>
    </div>
  </div>

  <!-- Tableau -->
  <div class="card overflow-hidden p-0">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Société</th>
            <th class="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-primary" @click="sortBy('score_global')">Score ↕</th>
            <th class="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Gouv.</th>
            <th class="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">DH</th>
            <th class="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">SST</th>
            <th class="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Éthique</th>
            <th class="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Env.</th>
            <th class="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase hidden xl:table-cell">Achats</th>
            <th class="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Niveau</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <template x-for="s in filteredSuppliers()" :key="s.id">
            <tr class="hover:bg-gray-50 cursor-pointer transition-colors" @click="$root.openSupplier(s)">
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900 truncate max-w-48" x-text="s.name"></div>
                <div class="text-xs text-gray-400" x-text="s.language === 'fr' ? '🇫🇷' : '🇬🇧'"></div>
              </td>
              <td class="px-3 py-3 text-center">
                <div class="font-bold" :class="s.level === 'green' ? 'text-green-600' : s.level === 'amber' ? 'text-amber-500' : 'text-red-600'"
                     x-text="s.score_global + '%'"></div>
              </td>
              <template x-for="pillar in ['gouvernance','droits_humains','sst','ethique','environnement','achats']" :key="pillar">
                <td class="px-3 py-3 text-center hidden" :class="{'md:table-cell': ['gouvernance','droits_humains'].includes(pillar), 'lg:table-cell': ['sst','ethique','environnement'].includes(pillar), 'xl:table-cell': pillar === 'achats'}">
                  <div class="flex flex-col items-center gap-1">
                    <span class="text-xs" x-text="s.scores[pillar] + '%'"></span>
                    <div class="w-12 bg-gray-100 rounded-full h-1">
                      <div class="h-1 rounded-full" :class="$root.getScoreColor(s.scores[pillar])" :style="'width:' + s.scores[pillar] + '%'"></div>
                    </div>
                  </div>
                </td>
              </template>
              <td class="px-3 py-3 text-center">
                <span :class="$root.getLevelClass(s.level)" x-text="s.level === 'green' ? '🟢' : s.level === 'amber' ? '🟡' : '🔴'"></span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</div>
```

**Step 2 : Ajouter la fonction `classementView()` dans le script**

```javascript
function classementView() {
  return {
    search: '',
    filterLevel: '',
    filterLang: '',
    sortKey: 'score_global',
    sortDir: -1,

    filteredSuppliers() {
      const suppliers = this.$root.data?.suppliers || [];
      return suppliers
        .filter(s => {
          const matchSearch = !this.search || s.name.toLowerCase().includes(this.search.toLowerCase());
          const matchLevel = !this.filterLevel || s.level === this.filterLevel;
          const matchLang = !this.filterLang || s.language === this.filterLang;
          return matchSearch && matchLevel && matchLang;
        })
        .sort((a, b) => (a[this.sortKey] - b[this.sortKey]) * this.sortDir);
    },

    sortBy(key) {
      if (this.sortKey === key) this.sortDir *= -1;
      else { this.sortKey = key; this.sortDir = -1; }
    },

    exportCSV() {
      const suppliers = this.filteredSuppliers();
      const headers = ['Société', 'Score Global', 'Gouvernance', 'Droits Humains', 'SST', 'Éthique', 'Environnement', 'Achats', 'Niveau', 'Langue'];
      const rows = suppliers.map(s => [
        s.name, s.score_global,
        s.scores.gouvernance, s.scores.droits_humains, s.scores.sst,
        s.scores.ethique, s.scores.environnement, s.scores.achats,
        s.level === 'green' ? 'Bon élève' : s.level === 'amber' ? 'En progression' : 'Prioritaire',
        s.language.toUpperCase()
      ]);
      const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = 'rse-fournisseurs.csv'; a.click();
    }
  }
}
```

**Step 3 : Vérifier le tableau dans le navigateur**

Ouvrir http://localhost:3000, cliquer "Classement" → tableau avec filtres, tri par score, export CSV.

**Step 4 : Commit**

```bash
git add index.html
git commit -m "feat: add classement view with filters, sort and CSV export"
```

---

## Task 9 : Fiche Fournisseur — Radar individuel + plan d'action

**Step 1 : Remplacer le placeholder `fournisseur-view`**

Trouver `<div x-show="view === 'fournisseur'" x-component="fournisseur-view"></div>` et remplacer par :

```html
<div x-show="view === 'fournisseur'" x-show="selectedSupplier">
  <template x-if="selectedSupplier">
    <div>
      <!-- Breadcrumb -->
      <button @click="view='classement'" class="text-sm text-gray-400 hover:text-primary mb-4 flex items-center gap-1">
        ← Retour au classement
      </button>

      <!-- Header fournisseur -->
      <div class="card mb-6">
        <div class="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 class="text-xl font-bold text-primary" x-text="selectedSupplier.name"></h1>
            <div class="text-sm text-gray-500 mt-1 space-y-0.5">
              <div x-show="selectedSupplier.siret" x-text="'SIRET : ' + selectedSupplier.siret"></div>
              <div x-show="selectedSupplier.address" x-text="selectedSupplier.address"></div>
              <div x-show="selectedSupplier.contact_name" x-text="selectedSupplier.contact_name + (selectedSupplier.contact_role ? ' — ' + selectedSupplier.contact_role : '')"></div>
              <div x-show="selectedSupplier.rse_contact" class="text-accent" x-text="'Contact RSE : ' + selectedSupplier.rse_contact"></div>
            </div>
          </div>
          <div class="text-center">
            <div class="text-5xl font-bold" :class="selectedSupplier.level === 'green' ? 'text-green-600' : selectedSupplier.level === 'amber' ? 'text-amber-500' : 'text-red-600'"
                 x-text="selectedSupplier.score_global + '%'"></div>
            <span :class="getLevelClass(selectedSupplier.level)" x-text="getLevelLabel(selectedSupplier.level)" class="mt-1"></span>
            <div class="text-xs text-gray-400 mt-1" x-text="selectedSupplier.language === 'fr' ? '🇫🇷 Questionnaire FR' : '🇬🇧 Questionnaire EN'"></div>
          </div>
        </div>
      </div>

      <!-- Radar + Points forts/faibles -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="card">
          <h2 class="text-base font-semibold text-gray-700 mb-4">Performance par pilier</h2>
          <canvas :id="'radar-' + selectedSupplier.id" height="260"></canvas>
        </div>
        <div class="card flex flex-col gap-4">
          <div>
            <h3 class="font-semibold text-gray-700 mb-2">✅ Points forts</h3>
            <div class="space-y-1">
              <template x-for="pillar in selectedSupplier.strengths" :key="pillar">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-700" x-text="getPillarLabel(pillar)"></span>
                  <span class="font-semibold text-green-600" x-text="selectedSupplier.scores[pillar] + '%'"></span>
                </div>
              </template>
              <div x-show="selectedSupplier.strengths.length === 0" class="text-sm text-gray-400">Aucun point fort identifié</div>
            </div>
          </div>
          <hr>
          <div>
            <h3 class="font-semibold text-gray-700 mb-2">⚠️ Lacunes identifiées</h3>
            <div class="space-y-1">
              <template x-for="pillar in selectedSupplier.weaknesses" :key="pillar">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-700" x-text="getPillarLabel(pillar)"></span>
                  <span class="font-semibold text-red-600" x-text="selectedSupplier.scores[pillar] + '%'"></span>
                </div>
              </template>
              <div x-show="selectedSupplier.weaknesses.length === 0" class="text-sm text-gray-400 italic">Aucune lacune majeure 🎉</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Scores par pilier détaillés -->
      <div class="card mb-6">
        <h2 class="text-base font-semibold text-gray-700 mb-4">Détail des scores par pilier</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
          <template x-for="[pillar, score] in Object.entries(selectedSupplier.scores)" :key="pillar">
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600" x-text="getPillarLabel(pillar)"></span>
                <span class="font-semibold" :class="score >= 67 ? 'text-green-600' : score >= 34 ? 'text-amber-500' : 'text-red-600'" x-text="score + '%'"></span>
              </div>
              <div class="w-full bg-gray-100 rounded-full h-2">
                <div class="h-2 rounded-full transition-all" :class="getScoreColor(score)" :style="'width:' + score + '%'"></div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Plan d'accompagnement -->
      <div class="card border-l-4 border-accent" x-show="selectedSupplier.recommendations.length > 0">
        <h2 class="text-base font-semibold text-gray-700 mb-3">📋 Plan d'accompagnement recommandé</h2>
        <ul class="space-y-2">
          <template x-for="(rec, i) in selectedSupplier.recommendations" :key="i">
            <li class="flex items-start gap-2 text-sm text-gray-700">
              <span class="text-accent font-bold mt-0.5 shrink-0" x-text="(i+1) + '.'"></span>
              <span x-text="rec"></span>
            </li>
          </template>
        </ul>
      </div>
    </div>
  </template>
</div>
```

**Step 2 : Initialiser le radar individuel lors de l'ouverture d'un fournisseur**

Modifier la méthode `openSupplier()` dans `app()` :

```javascript
openSupplier(supplier) {
  this.selectedSupplier = supplier;
  this.view = 'fournisseur';
  this.$nextTick(() => {
    const canvasId = 'radar-' + supplier.id;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    // Détruire chart existant si besoin
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    const scores = supplier.scores;
    new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['Gouvernance', 'Droits Humains', 'SST', 'Éthique', 'Environnement', 'Achats'],
        datasets: [{
          label: supplier.name,
          data: [scores.gouvernance, scores.droits_humains, scores.sst, scores.ethique, scores.environnement, scores.achats],
          backgroundColor: 'rgba(27, 63, 110, 0.15)',
          borderColor: '#1B3F6E',
          pointBackgroundColor: '#00A896',
          pointRadius: 4,
          borderWidth: 2,
        }]
      },
      options: {
        scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, font: { size: 10 } } } },
        plugins: { legend: { display: false } },
        responsive: true,
      }
    });
  });
},
```

**Step 3 : Vérifier la fiche dans le navigateur**

Cliquer sur un fournisseur dans le classement → Fiche avec radar individuel + plan d'accompagnement.

**Step 4 : Commit**

```bash
git add index.html
git commit -m "feat: add supplier detail view with individual radar and action plan"
```

---

## Task 10 : Vue Analyse Collective + Vue Comparaison

**Step 1 : Remplacer `analyse-view`**

Trouver `<div x-show="view === 'analyse'" x-component="analyse-view"></div>` et remplacer par :

```html
<div x-show="view === 'analyse'">
  <h1 class="text-2xl font-bold text-primary mb-6">Analyse Collective</h1>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
    <!-- Donut niveaux -->
    <div class="card">
      <h2 class="text-base font-semibold text-gray-700 mb-4">Répartition des niveaux RSE</h2>
      <canvas id="donutLevels" height="220"></canvas>
    </div>
    <!-- Donut FR/EN -->
    <div class="card">
      <h2 class="text-base font-semibold text-gray-700 mb-4">Répartition géographique</h2>
      <canvas id="donutLangs" height="220"></canvas>
    </div>
  </div>
  <!-- Bar chart scores par pilier -->
  <div class="card mb-6">
    <h2 class="text-base font-semibold text-gray-700 mb-4">Score moyen par pilier (tous fournisseurs)</h2>
    <canvas id="barPillars" height="120"></canvas>
  </div>
</div>
```

**Step 2 : Remplacer `comparaison-view`**

```html
<div x-show="view === 'comparaison'" x-data="comparaisonView()">
  <h1 class="text-2xl font-bold text-primary mb-6">Comparaison Fournisseurs</h1>
  <!-- Sélection -->
  <div class="card mb-6">
    <p class="text-sm text-gray-600 mb-3">Sélectionner 2 à 4 fournisseurs à comparer :</p>
    <div class="flex flex-wrap gap-2">
      <template x-for="s in $root.data?.suppliers || []" :key="s.id">
        <button @click="toggleSupplier(s)"
          :class="isSelected(s) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
          class="px-3 py-1 rounded-full text-xs font-medium transition-colors"
          :disabled="!isSelected(s) && selected.length >= 4"
          x-text="s.name.substring(0, 25) + (s.name.length > 25 ? '...' : '')">
        </button>
      </template>
    </div>
  </div>
  <!-- Radars côte à côte -->
  <div x-show="selected.length >= 2" class="grid gap-4" :class="'grid-cols-' + Math.min(selected.length, 2)">
    <template x-for="s in selected" :key="s.id">
      <div class="card">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-sm font-semibold truncate" x-text="s.name"></h3>
          <span :class="$root.getLevelClass(s.level)" x-text="s.score_global + '%'"></span>
        </div>
        <canvas :id="'comp-radar-' + s.id" height="200" x-init="$nextTick(() => drawCompRadar(s))"></canvas>
      </div>
    </template>
  </div>
  <div x-show="selected.length < 2" class="card text-center py-12 text-gray-400 text-sm">
    Sélectionnez au moins 2 fournisseurs pour comparer
  </div>
</div>
```

**Step 3 : Ajouter `comparaisonView()` dans le script**

```javascript
function comparaisonView() {
  return {
    selected: [],
    isSelected(s) { return this.selected.some(x => x.id === s.id); },
    toggleSupplier(s) {
      if (this.isSelected(s)) this.selected = this.selected.filter(x => x.id !== s.id);
      else if (this.selected.length < 4) {
        this.selected.push(s);
        this.$nextTick(() => this.drawCompRadar(s));
      }
    },
    drawCompRadar(s) {
      const canvas = document.getElementById('comp-radar-' + s.id);
      if (!canvas) return;
      const existing = Chart.getChart(canvas); if (existing) existing.destroy();
      const sc = s.scores;
      new Chart(canvas, {
        type: 'radar',
        data: {
          labels: ['Gouv.', 'DH', 'SST', 'Éthique', 'Env.', 'Achats'],
          datasets: [{ label: s.name,
            data: [sc.gouvernance, sc.droits_humains, sc.sst, sc.ethique, sc.environnement, sc.achats],
            backgroundColor: 'rgba(0,168,150,0.1)', borderColor: '#00A896',
            pointBackgroundColor: '#1B3F6E', pointRadius: 3, borderWidth: 2
          }]
        },
        options: { scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, font: { size: 9 } } } },
          plugins: { legend: { display: false } }, responsive: true }
      });
    }
  }
}
```

**Step 4 : Initialiser les donuts et bar chart dans `initRadarChart()` → renommer en `initCharts()`**

```javascript
initCharts() {
  if (!this.data) return;
  this.initRadarChart();

  // Donut niveaux
  const c = this.data.collective;
  new Chart(document.getElementById('donutLevels'), {
    type: 'doughnut',
    data: {
      labels: ['Bons élèves 🟢', 'En progression 🟡', 'Prioritaires 🔴'],
      datasets: [{ data: [c.count_green, c.count_amber, c.count_red],
        backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'], borderWidth: 0 }]
    },
    options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, responsive: true }
  });

  // Donut langues
  new Chart(document.getElementById('donutLangs'), {
    type: 'doughnut',
    data: {
      labels: ['Fournisseurs FR 🇫🇷', 'Fournisseurs EN 🇬🇧'],
      datasets: [{ data: [this.data.meta.count_fr, this.data.meta.count_en],
        backgroundColor: ['#1B3F6E', '#00A896'], borderWidth: 0 }]
    },
    options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, responsive: true }
  });

  // Bar chart piliers
  const pillarData = c.by_pillar;
  new Chart(document.getElementById('barPillars'), {
    type: 'bar',
    data: {
      labels: ['Gouvernance RSE', 'Droits Humains', 'Santé & Sécurité', 'Éthique', 'Environnement', 'Achats'],
      datasets: [{ label: 'Score moyen (%)',
        data: [pillarData.gouvernance, pillarData.droits_humains, pillarData.sst, pillarData.ethique, pillarData.environnement, pillarData.achats],
        backgroundColor: ['#1B3F6E','#00A896','#22c55e','#3b82f6','#10b981','#f59e0b'],
        borderRadius: 6, borderWidth: 0
      }]
    },
    options: {
      indexAxis: 'y', responsive: true,
      scales: { x: { min: 0, max: 100, ticks: { callback: v => v + '%' } } },
      plugins: { legend: { display: false } }
    }
  });
},
```

Remplacer l'appel `this.initRadarChart()` par `this.initCharts()` dans `init()`.

**Step 5 : Vérifier les vues Analyse et Comparaison**

Ouvrir http://localhost:3000, tester les 2 vues.

**Step 6 : Commit**

```bash
git add index.html
git commit -m "feat: add analyse collective and comparaison views"
```

---

## Task 11 : Déploiement sur GitHub Pages

**Step 1 : Créer le repository GitHub**

```bash
# Depuis GitHub.com : créer un nouveau repo public nommé "rse-dashboard"
# Puis :
git remote add origin git@github.com:TON_USERNAME/rse-dashboard.git
git branch -M main
git push -u origin main
```

**Step 2 : Activer GitHub Pages**

1. Aller dans Settings > Pages du repository
2. Source : Deploy from a branch
3. Branch : `main` / `/ (root)`
4. Cliquer Save

**Step 3 : Vérifier le déploiement**

```bash
# Attendre ~2 minutes puis ouvrir :
# https://TON_USERNAME.github.io/rse-dashboard/
```
Expected: Le dashboard s'affiche avec les données de `public/data.json`.

**Step 4 : Test complet du script update_data.py**

```bash
cd rse-dashboard
source venv/bin/activate
python3 scripts/update_data.py
```
Expected:
```
✅ Terminé ! Le dashboard sera mis à jour dans ~2 minutes.
   Score moyen global : XX%
   🟢 X bons élèves
   🟡 X en progression
   🔴 X prioritaires
```

**Step 5 : Commit final**

```bash
git add .
git commit -m "feat: complete RSE dashboard MVP - ready for production"
git push
```

---

## Récapitulatif des commandes utiles

```bash
# Mise à jour des données (à lancer avant chaque présentation direction)
cd rse-dashboard && source venv/bin/activate && python3 scripts/update_data.py

# Développement local
python3 -m http.server 3000  # Ouvrir http://localhost:3000

# Lancer les tests
python3 -m pytest tests/ -v
```

## Fichiers sensibles (NE JAMAIS committer)

- `scripts/token.json` — token OAuth2 Google (régénérable)
- `client_secret_*.json` — clé OAuth2 (déjà dans `/home/blaise/Documents/`, hors repo)
