# Design — Installateur Windows + Wiki Projet RSE Dashboard

**Date :** 2026-02-20
**Statut :** Approuvé
**Auteur :** Blaise Ganhao

---

## 1. Contexte

Le dashboard RSE est opérationnel sur GitHub Pages. Blaise a besoin de :
1. Pouvoir mettre à jour les données depuis un PC Windows (poste de travail)
2. Disposer d'une documentation complète pour maintenir/modifier le projet sans risquer de le casser (modifications manuelles ou via agent IA)

---

## 2. Installateur Windows

### Approche retenue : PowerShell + winget

**Fichiers à créer :**
```
rse-dashboard/
└── windows/
    ├── install.ps1       # Installation complète (Python, Git, venv, dépendances)
    ├── update.ps1        # Mise à jour quotidienne des données (double-clic)
    ├── update.bat        # Lanceur bat qui appelle update.ps1 (pour les non-techniciens)
    └── README.txt        # Guide rapide en français
```

### install.ps1 — Comportement attendu

1. Vérifie si Python >= 3.10 est installé → sinon installe via `winget install Python.Python.3.12`
2. Vérifie si Git >= 2.x est installé → sinon installe via `winget install Git.Git`
3. Clone ou met à jour le repo depuis GitHub (`git clone` ou `git pull`)
4. Crée le venv dans `rse-dashboard\venv\`
5. Active le venv et installe `requirements.txt`
6. Copie `client_secret_rse_dashboard.json` depuis `%USERPROFILE%\Documents\` (l'utilisateur doit l'avoir copié là)
7. Vérifie que tout est en ordre
8. Affiche un message de succès avec les prochaines étapes

**Gestion d'erreurs :**
- Si winget absent → affiche URL de téléchargement manuel Python/Git
- Si client_secret absent → affiche où le trouver et comment le copier
- Chaque étape affiche un statut coloré (✅ vert / ❌ rouge)

### update.ps1 — Comportement attendu

1. Active le venv (`.\venv\Scripts\Activate.ps1`)
2. Lance `python scripts/update_data.py`
3. Si succès : affiche stats (nb fournisseurs, score moyen, répartition niveaux)
4. Ouvre automatiquement le dashboard dans le navigateur par défaut
5. Si erreur : affiche message d'aide clair

### update.bat

Simple lanceur qui appelle `update.ps1` avec les bons droits d'exécution :
```batch
powershell -ExecutionPolicy Bypass -File "%~dp0update.ps1"
pause
```

### README.txt

Guide en français, étapes numérotées :
1. Prérequis (copier le fichier client_secret dans Documents)
2. Lancer install.ps1 (clic droit → Exécuter avec PowerShell)
3. Utilisation quotidienne (double-clic sur update.bat)

---

## 3. Wiki Projet

### Fichier : `docs/WIKI.md`

**8 sections :**

### Section 1 — Architecture & flux de données
- Schéma ASCII du flux complet (Google Sheets → Python → JSON → GitHub Pages)
- Explication du modèle snapshot (mise à jour manuelle)

### Section 2 — Structure des fichiers
Tableau de chaque fichier avec : nom, rôle, modifier/ne pas modifier, dépendances

### Section 3 — Mettre à jour le dashboard
- Commandes Linux/Mac
- Commandes Windows (PowerShell)
- Ce qui se passe étape par étape

### Section 4 — Modifier le scoring RSE
- Comment changer les poids des piliers (PILLAR_WEIGHTS dans pillar_mapping.py)
- Comment ajouter/supprimer des questions d'un pilier (PILLAR_COLUMNS_FR/EN)
- Comment modifier les seuils traffic light (get_level dans scorer.py)
- Comment ajouter une recommandation automatique

### Section 5 — Personnaliser le dashboard
- Changer les couleurs (variables Tailwind dans index.html)
- Modifier les textes des piliers et labels
- Ajouter/supprimer une vue
- Modifier les KPIs de la vue Direction

### Section 6 — Gérer les fournisseurs
- Comment le script détecte les nouvelles réponses
- Colonnes importantes dans Google Sheets
- Que faire si un fournisseur change de nom

### Section 7 — Dépannage
Tableau erreur → cause → solution pour les erreurs fréquentes :
- `externally-managed-environment` → utiliser venv
- `403 Forbidden` → token expiré, supprimer token.json
- `SPREADSHEET_NOT_FOUND` → vérifier SHEET_IDS dans fetch_sheets.py
- `client_secret not found` → vérifier le chemin CLIENT_SECRET_PATH dans auth.py
- Dashboard vide / données obsolètes → re-lancer update_data.py

### Section 8 — Guide pour agent IA
Section spéciale pour Claude ou autre agent qui devrait modifier le projet :
- Stack technique complète
- Fichiers sensibles à ne jamais modifier / committer
- Points d'extension prévus (où ajouter des features)
- Conventions de code du projet
- Commandes de test
- Workflow de mise à jour

---

## 4. Décisions techniques

| Décision | Choix | Raison |
|----------|-------|--------|
| Scripting Windows | PowerShell | Intégré Windows 10/11, couleurs, winget |
| Lanceur non-technique | .bat | Double-clic sans configuration |
| Installation Python/Git | winget | Auto, silencieux, maintenu par Microsoft |
| Format wiki | Markdown (.md) | Lisible sur GitHub, par les humains et les IA |
| Chemin client_secret | `%USERPROFILE%\Documents\` | Même convention que Linux (`~/Documents/`) |
