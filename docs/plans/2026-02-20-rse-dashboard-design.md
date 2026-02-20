# Design Document — Dashboard RSE Fournisseurs

**Date :** 2026-02-20
**Statut :** Approuvé
**Auteur :** Blaise Ganhao

---

## 1. Contexte & Objectifs

### Problème
Accompagner des fournisseurs dans leur démarche RSE nécessite de visualiser clairement leur niveau de maturité, identifier les fournisseurs à accompagner en priorité, et présenter les performances à la direction de manière professionnelle.

### Sources de données
| Sheet | Nom | Langue | Statut | Colonnes | Lignes max |
|-------|-----|--------|--------|----------|------------|
| Sheet 1 | CSR Questionnaire FR V2 | FR | Vide (template) | 70 | 95 |
| Sheet 2 | CSR Questionnaire FR V2 | FR | Vide (template) | 70 | 95 |
| Sheet 3 | Questionnaire RSE - FR réponses | FR | **Actif** | 72 | ~106 |
| Sheet 4 | CSR Questionnaire - EN réponses | EN | **Actif** | 70 | ~102 |

Seuls les sheets 3 et 4 contiennent des réponses fournisseurs. Le questionnaire couvre **66 questions** actives regroupées en **6 piliers RSE**.

### Objectifs du dashboard
1. Visualiser le niveau RSE de chaque fournisseur de manière structurée et professionnelle
2. Identifier clairement les bons et mauvais élèves
3. Générer automatiquement des pistes d'accompagnement personnalisées
4. Permettre une présentation direction claire et impactante

---

## 2. Architecture Technique

### Approche retenue : Script local Python + GitHub Pages (statique)

```
[PC Blaise]
  └── scripts/update_data.py
        ├── Auth OAuth2 (client_secret existant)
        ├── Lecture Sheet 3 (FR) + Sheet 4 (EN) via Google Sheets API
        ├── Calcul scores RSE (6 piliers pondérés)
        ├── Génération public/data.json
        └── git add + commit + push
              └── [GitHub Pages]
                    └── index.html → lit data.json → Dashboard
```

**Flux de mise à jour :**
```bash
python scripts/update_data.py
# → ~30 secondes → dashboard mis à jour sur GitHub Pages
```

### Structure du repository
```
rse-dashboard/
├── index.html                    # Dashboard principal (SPA)
├── public/
│   └── data.json                 # Données générées (ne pas éditer manuellement)
├── scripts/
│   ├── update_data.py            # Script de mise à jour des données
│   └── token.json                # Token OAuth2 (gitignored)
├── requirements.txt              # gspread, google-auth-oauthlib
├── .gitignore                    # token.json, *.pyc, __pycache__
└── docs/
    └── plans/
        └── 2026-02-20-rse-dashboard-design.md
```

### Dépendances
- **Python** : `gspread`, `google-auth-oauthlib`, `google-auth-httplib2`
- **Frontend** : Tailwind CSS (CDN), Chart.js (CDN), Alpine.js (CDN), Lucide Icons (CDN)
- **Hébergement** : GitHub Pages (branche `main`, racine `/`)

---

## 3. Modèle de Scoring RSE

### Les 6 piliers et leur pondération

| # | Pilier | Questions clés | Pondération |
|---|--------|----------------|-------------|
| 1 | **Gouvernance RSE** | Démarche structurée, labellisation, rapport RSE, code de conduite, système d'alerte, personne dédiée | 20% |
| 2 | **Droits Humains & Conditions de travail** | Politique DH, domaines couverts (travail forcé, harcèlement, diversité...) | 15% |
| 3 | **Santé & Sécurité au Travail (SST)** | Politique SST, actions prévention, exemples concrets | 20% |
| 4 | **Éthique des affaires** | Politique éthique, domaines (anti-corruption, propriété intellectuelle...) | 15% |
| 5 | **Environnement** | Politique env., gestion déchets, énergie, eau, CO2, éco-conception | 20% |
| 6 | **Achats Responsables** | Exigences RSE fournisseurs, communication, formation collaborateurs | 10% |

### Règles de calcul
- Réponse **"Oui"** → 1 point
- Réponse **"Non"** → 0 point
- Réponse texte libre → 0.5 point (présence = engagement partiel)
- Réponse vide → 0 point
- Score pilier = (somme points) / (nb questions pilier) × 100
- Score global = somme pondérée des 6 piliers

### Niveaux de performance (traffic light)
| Niveau | Score | Badge | Action |
|--------|-------|-------|--------|
| 🟢 Bon élève | ≥ 67% | Vert | Valoriser, maintenir le cap |
| 🟡 En progression | 34–66% | Amber | Accompagnement ciblé |
| 🔴 Priorité | ≤ 33% | Rouge | Accompagnement intensif urgent |

---

## 4. Structure du Dashboard (5 vues)

### 4.1 Vue Direction (`#direction`)
**Objectif :** Lecture en 30 secondes, présentation direction.

**Composants :**
- **Bandeau KPIs** (5 cartes) :
  - Score RSE moyen global (ring gauge %)
  - Taux de participation (répondus / invités)
  - Nb fournisseurs 🟢 (≥ 67%)
  - Nb fournisseurs 🔴 (≤ 33%) — alerte prioritaire
  - Nb en attente de réponse — relance
- **Radar collectif** : Performance agrégée sur les 6 piliers (moyenne de tous les fournisseurs)
- **Forces & Lacunes collectives** : Top 3 questions bien répondues / top 3 lacunes
- **Top 5 performeurs** : Classement des meilleurs fournisseurs avec score + badge
- **5 Fournisseurs prioritaires** : Ceux qui nécessitent un accompagnement urgent

### 4.2 Vue Classement (`#classement`)
**Objectif :** Analyse comparative, trouver un fournisseur, trier/filtrer.

**Composants :**
- Barre de filtres : pilier, niveau (🟢🟡🔴), langue (FR/EN), recherche texte
- Tableau trié par score global (décroissant par défaut)
- Colonnes : Société | Score global | Gouvernance | DH | SST | Éthique | Env. | Achats | Niveau
- Mini progress bars colorées dans chaque cellule de score
- Ligne cliquable → ouvre la fiche fournisseur
- Boutons Export PDF et Export CSV

### 4.3 Fiche Fournisseur (`#fournisseur/{id}`)
**Objectif :** Deep dive complet + plan d'action personnalisé.

**Composants :**
- **Header** : Nom société, SIRET, contact RSE, date de réponse, score global + badge
- **Radar 6 piliers** : Visualisation force/faiblesse par pilier
- **Détail par pilier** : Liste des questions avec réponse Oui/Non + icône
- **Bloc Forces** : 3-5 points forts identifiés (réponses Oui sur questions stratégiques)
- **Bloc Lacunes** : 3-5 points faibles (réponses Non sur questions clés)
- **Plan d'accompagnement** : Recommandations auto-générées selon les lacunes :
  - Score Gouvernance < 50% → "Initier une démarche EcoVadis ou ISO 26000"
  - Pas de rapport RSE → "Publier un rapport RSE annuel (guide GRI disponible)"
  - CO2 non mesuré → "Réaliser un bilan carbone transport"
  - Pas d'éco-conception → "Explorer des gammes éco-conçues (analyse cycle de vie)"
  - Pas de labellisation → "Envisager une certification EcoVadis, B Corp ou ISO 14001"

### 4.4 Vue Comparaison (`#comparaison`)
**Objectif :** Comparer 2 à 4 fournisseurs côte à côte.

**Composants :**
- Multiselect jusqu'à 4 fournisseurs
- Radars côte à côte (Chart.js, même échelle)
- Tableau différentiel par pilier (quel fournisseur est meilleur sur quel axe)
- Bouton "Générer rapport comparatif"

### 4.5 Vue Analyse Collective (`#analyse`)
**Objectif :** Vision macro, tendances, pour orientation stratégique.

**Composants :**
- **Heatmap** : Fournisseurs (lignes) × Questions clés (colonnes), couleur par réponse
- **Bar chart horizontal** : % de "Oui" par question (classé du plus élevé au plus bas)
- **Donut** : Répartition FR vs EN (international)
- **Donut** : Répartition des niveaux 🟢🟡🔴
- **Section "En attente"** : Liste des fournisseurs n'ayant pas encore répondu

---

## 5. Charte Visuelle

### Palette de couleurs
| Rôle | Couleur | Hex |
|------|---------|-----|
| Primaire (bleu corporate) | ![#1B3F6E](https://placehold.co/15x15/1B3F6E/1B3F6E.png) | `#1B3F6E` |
| Accent RSE (vert) | ![#00A896](https://placehold.co/15x15/00A896/00A896.png) | `#00A896` |
| Alerte rouge | ![#E63946](https://placehold.co/15x15/E63946/E63946.png) | `#E63946` |
| Attention amber | ![#F4A261](https://placehold.co/15x15/F4A261/F4A261.png) | `#F4A261` |
| Fond page | | `#F8FAFC` |
| Fond carte | | `#FFFFFF` |
| Texte principal | | `#1A202C` |
| Texte secondaire | | `#718096` |

### Typographie
- **Titres & KPIs** : Inter 700 (Google Fonts CDN)
- **Corps** : Inter 400
- **Tailles** : KPI principal = 48px, titre section = 24px, label = 14px, détail = 12px

### Composants UI
- Cartes avec ombre légère `shadow-md`, border-radius `12px`
- Bento grid : `CSS Grid`, colonnes 12, gap `16px`
- Badges niveau : pill coloré (fond pâle + texte coloré)
- Progress bars : hauteur 6px, border-radius full

---

## 6. Format de `data.json`

```json
{
  "meta": {
    "last_updated": "2026-02-20T10:30:00",
    "total_invited": 50,
    "total_responded": 44,
    "pending": ["email1@domain.com", "email2@domain.com"]
  },
  "collective": {
    "avg_score": 67.3,
    "by_pillar": {
      "gouvernance": 61.2,
      "droits_humains": 94.1,
      "sst": 97.8,
      "ethique": 95.3,
      "environnement": 52.4,
      "achats": 78.9
    },
    "top_questions": [...],
    "weak_questions": [...]
  },
  "suppliers": [
    {
      "id": "igol-picardie",
      "name": "IGOL PICARDIE ILE DE FRANCE",
      "email": "eric.macleod@igol.com",
      "siret": "57172129900014",
      "address": "614 rue de Cagny - 80090 AMIENS",
      "contact_rse": "Mme Stéphanie CANTO — Responsable QSE",
      "responded_at": "2026-02-18T08:54:54",
      "language": "fr",
      "score_global": 82.1,
      "level": "green",
      "scores": {
        "gouvernance": 75.0,
        "droits_humains": 100.0,
        "sst": 100.0,
        "ethique": 87.5,
        "environnement": 58.3,
        "achats": 83.3
      },
      "strengths": ["Code de conduite", "Politique SST", "Personne RSE dédiée"],
      "weaknesses": ["Pas de rapport RSE", "Pas de labellisation", "CO2 non mesuré"],
      "recommendations": [
        "Publier un rapport RSE annuel (guide GRI)",
        "Initier une démarche EcoVadis ou ISO 26000",
        "Réaliser un bilan carbone transport"
      ],
      "raw_answers": { "Q1": "Oui", "Q2": "Oui", ... }
    }
  ]
}
```

---

## 7. Correspondance Questions → Piliers

### Pilier 1 : Gouvernance RSE (colonnes 10–19 du sheet FR)
- Col 10 : Démarche RSE structurée
- Col 11 : Labellisation RSE (EcoVadis, ISO 26000...)
- Col 13 : Personne RSE dédiée
- Col 17 : Rapport RSE publié
- Col 18 : Code de conduite interne
- Col 19 : Système d'alerte parties prenantes

### Pilier 2 : Droits Humains (colonnes 20–25)
- Col 20 : Politique Droits Humains formalisée
- Col 21 : Domaines couverts (multi-choix)

### Pilier 3 : SST (colonnes 26–28)
- Col 26 : Politique SST
- Col 27 : Actions prévention risques

### Pilier 4 : Éthique (colonnes 29–33)
- Col 29 : Politique éthique
- Col 30 : Domaines couverts (anti-corruption, IP...)

### Pilier 5 : Environnement (colonnes 34–64)
- Col 34 : Substances restreintes (REACH, RoHS)
- Col 44 : Indicateurs de base suivis
- Col 50 : Déchets mesurés
- Col 54 : Énergie mesurée
- Col 55 : Actions réduction énergie
- Col 57 : Eau mesurée
- Col 60 : Actions réduction CO2 transport
- Col 62 : Mesure CO2 transport
- Col 63 : Éco-conception

### Pilier 6 : Achats Responsables (colonnes 38–41)
- Col 38 : Exigences RSE fournisseurs
- Col 41 : Formation collaborateurs RSE

---

## 8. Décisions techniques

| Décision | Choix | Raison |
|----------|-------|--------|
| Hébergement | GitHub Pages | Statique, gratuit, versionné |
| Auth Google | OAuth2 PKCE (script local) | Credentials jamais exposés en ligne |
| Framework CSS | Tailwind CDN | Zéro build, classes utilitaires |
| Charts | Chart.js | Léger, CDN, radar + bar + doughnut |
| Interactivité | Alpine.js | Zéro build, réactif, minimal |
| Icônes | Lucide Icons CDN | Modernes, cohérents |
| Format données | JSON statique | Simple, versionné, lisible |
| Single Page App | Oui (hash routing) | Une seule page HTML, 5 vues via Alpine |

---

## 9. Hors scope (MVP)

- Authentification utilisateur sur le dashboard (pas nécessaire pour snapshot direction)
- Envoi automatique de relances email aux fournisseurs
- Historique temporel des scores (prévu pour v2)
- Notifications automatiques
- Édition des données depuis le dashboard
