# Design : Code de Conduite Fournisseurs

**Date :** 2026-06-26  
**Statut :** Approuvé

---

## 1. Contexte et objectif

Ajouter une vue "Code de Conduite" dans le dashboard RSE permettant de suivre quels fournisseurs ont signé le Code de Conduite Fournisseurs LACME. La source de vérité est un Google Sheet dédié (ID : `1snLQRLAaoJGs7tPbm4Hlae9Qq3uENRy2k6pVNQSdKcg`) contenant 47 fournisseurs avec leurs contacts et leur statut de signature.

---

## 2. Architecture

### Source de données

Le Google Sheet "Code de Conduite" contient les colonnes :
`Fournisseur | Contact | Email | Code de conduite | Questionnaire | Commentaire`

La colonne **"Code de conduite"** contient `ok` (signé), `?` (en cours), ou vide (non signé).

Le dashboard (`data.json`) contient 40 fournisseurs avec scores RSE. ~38 ont un équivalent dans le Sheet (noms légèrement différents). 7-9 fournisseurs sont dans le Sheet uniquement (ont signé mais n'ont pas répondu au questionnaire RSE).

### Flux de données

```
[Browser]  ──GET──▶  [Apps Script Web App]  ──▶  [Google Sheet]
           ◀──JSON──                         ◀──
[Browser]  ──POST──▶ [Apps Script Web App]  ──▶  [Google Sheet] (col. D)
```

- **Lecture au démarrage** : `fetch(APPS_SCRIPT_URL)` → JSON avec les 47 lignes, headers CORS inclus
- **Écriture sur changement de checkbox** : `fetch(APPS_SCRIPT_URL, {method:'POST', body: JSON.stringify({row, value})})` → Apps Script met à jour la colonne D ("Code de conduite")
- **Cache localStorage** : snapshot local pour affichage instantané entre les visites ; invalidé et remplacé à chaque fetch réussi

### Correspondance Sheet ↔ data.json

Algorithme de matching par **nom normalisé** :
- Minuscules, suppression des accents, des caractères spéciaux, espaces multiples
- Exemples : "ArcelorMittal Bissen&Bettembourg SA" → "arcelormittal" ; "ArcelorMittal" → "arcelormittal" → match ✓
- Stocké dans une `Map` calculée une fois au chargement
- Les fournisseurs du Sheet sans match data.json s'affichent sans score RSE (colonne vide)

---

## 3. Google Apps Script

Script à déployer dans le Google Sheet (Extensions → Apps Script) en tant que **Web App** :
- Exécuté en tant que : compte propriétaire
- Accès : "Tout le monde" (Anyone, even anonymous)

```javascript
const SHEET_ID = '1snLQRLAaoJGs7tPbm4Hlae9Qq3uENRy2k6pVNQSdKcg';
const SHEET_NAME = 'Feuille 1'; // à ajuster selon le nom de l'onglet

function doGet() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const data = rows.slice(1).map((row, i) => ({
    row: i + 2,
    fournisseur: row[0],
    contact: row[1],
    email: row[2],
    code_conduite: row[3],
    questionnaire: row[4],
    commentaire: row[5]
  }));
  return ContentService
    .createTextOutput(JSON.stringify({ data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  sheet.getRange(params.row, 4).setValue(params.value); // colonne D
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

L'URL de déploiement sera stockée dans une constante `CODE_CONDUITE_SCRIPT_URL` dans `public/app.js`.

---

## 4. Vue "Code de Conduite" — Interface

### Navigation

Bouton ajouté dans la navbar entre "Comparaison" et le sélecteur de thème :
```html
<button @click="view='code-conduite'" :class="view==='code-conduite' ? 'active' : ''" class="nav-link">
  Code de Conduite
</button>
```

### Layout de la vue

```
┌─────────────────────────────────────────────────────────┐
│ Code de Conduite Fournisseurs            [38/47 signés] │
│ Suivi des engagements au Code de Conduite               │
├─────────────────────────────────────────────────────────┤
│ [Tous ▼] [🔍 Rechercher…]         ● Sync en cours...   │
├──────────────────────┬──────────────┬───────┬───────────┤
│ Fournisseur          │ Contact      │ Email │ ✓ Code CC │
├──────────────────────┼──────────────┼───────┼───────────┤
│ A.S.T.R.A...         │ L. Vuerich   │ ...   │   [✓]    │
│ a3multimédia         │ J. Godard    │ ...   │   [✓]    │
│ ADP 85               │ —            │ —     │   [ ]    │
└──────────────────────┴──────────────┴───────┴───────────┘
```

### Colonnes du tableau

| Colonne | Source | Notes |
|---|---|---|
| Fournisseur | Sheet col. A | Tri alphabétique par défaut |
| Contact | Sheet col. B | Peut être vide |
| Email | Sheet col. C | Lien `mailto:` si présent |
| Code de Conduite | Sheet col. D | Checkbox : coché si `ok`, vide sinon |
| Commentaire | Sheet col. F | Texte court, tronqué |

La colonne "Score RSE" n'est **pas** affichée dans cette vue (hors périmètre).

### Comportement des checkboxes

- **Coche → `ok`** / **Décoche → `""`** dans le Sheet
- Mise à jour localStorage immédiate (affichage optimiste)
- Requête POST asynchrone vers l'Apps Script
- En cas d'erreur réseau : rollback visuel + message d'erreur discret

### Filtres

- Dropdown : "Tous" / "Signés" / "Non signés"
- Champ de recherche textuelle sur le nom du fournisseur

### Indicateur de synchronisation

- Icône de sync animée pendant les requêtes en cours
- "Dernière sync : HH:MM" après succès
- Icône d'avertissement en cas d'erreur

---

## 5. Composant Alpine.js

Nouveau composant `codeConduiteView()` dans `public/app.js`, suivant le même pattern que `classementView()` et `comparaisonView()` :

```javascript
function codeConduiteView() {
  return {
    entries: [],          // données du Sheet
    loading: false,
    syncError: null,
    lastSync: null,
    search: '',
    filterStatus: '',     // '' | 'signed' | 'unsigned'
    pendingRequests: 0,

    async init() { ... },        // fetch Apps Script + merge localStorage
    filteredEntries() { ... },   // filtre + tri
    async toggleSignature(entry) { ... },  // optimistic update + POST
    signedCount() { ... },
  };
}
```

---

## 6. Configuration

URL de l'Apps Script stockée dans une constante en haut de `public/app.js` :

```javascript
const CODE_CONDUITE_SCRIPT_URL = 'https://script.google.com/macros/s/XXXXX/exec';
```

Cette constante est vide par défaut. Si vide, la vue affiche un message de configuration avec les instructions de setup.

---

## 7. Setup utilisateur (une seule fois)

1. Ouvrir le Google Sheet → **Extensions → Apps Script**
2. Coller le code du §3, vérifier le nom de l'onglet (`SHEET_NAME`)
3. **Déployer → Nouveau déploiement** → Type : Web App → Accès : Anyone
4. Copier l'URL générée
5. Dans `public/app.js`, renseigner `CODE_CONDUITE_SCRIPT_URL`
6. Commiter et pousser

---

## 8. Ce qui n'est pas dans le périmètre

- Import/export CSV du Code de Conduite
- Colonne "Score RSE" dans la vue Code de Conduite
- Authentification OAuth côté browser
- Notifications email lors d'une signature
