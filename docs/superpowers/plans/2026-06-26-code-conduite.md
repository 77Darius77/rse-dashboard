# Code de Conduite Fournisseurs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une vue "Code de Conduite" dans le dashboard RSE permettant de suivre et mettre à jour l'engagement des 47 fournisseurs au Code de Conduite, avec persistance dans un Google Sheet via Google Apps Script.

**Architecture:** Un Google Apps Script déployé comme Web App agit de pont R/W entre le browser et le Google Sheet. Toutes les opérations (lecture + écriture) passent par des requêtes GET pour éviter les problèmes CORS de preflight. Un cache localStorage assure l'affichage instantané entre les visites.

**Tech Stack:** Alpine.js 3, Tailwind CSS, Lucide Icons, Google Apps Script (Web App), localStorage

---

## File Map

| Fichier | Action | Responsabilité |
|---|---|---|
| `docs/apps-script/code-conduite.gs` | **Create** | Script complet à coller dans Google Apps Script |
| `public/app.js` | **Modify** | Ajouter constante `CODE_CONDUITE_SCRIPT_URL` + composant `codeConduiteView()` |
| `index.html` | **Modify** | Ajouter bouton nav + section vue complète |

---

## Task 1 : Créer le fichier Google Apps Script

**Files:**
- Create: `docs/apps-script/code-conduite.gs`

- [ ] **Step 1 : Créer le fichier Apps Script**

Créer `docs/apps-script/code-conduite.gs` avec ce contenu exact :

```javascript
// Dashboard RSE LACME — Code de Conduite Fournisseurs
// Déployer comme Web App : Extensions → Apps Script → Déployer → Nouveau déploiement
// Type : Web App | Exécuter en tant que : Moi | Accès : Tout le monde (Anyone)

const SHEET_ID   = '1snLQRLAaoJGs7tPbm4Hlae9Qq3uENRy2k6pVNQSdKcg';
const SHEET_NAME = 'Fournisseurs';

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};

  // Opération d'écriture via GET (évite le preflight CORS des requêtes POST)
  if (params.action === 'update') {
    const row   = parseInt(params.row);
    const field = params.field;   // 'code_conduite' ou 'commentaire'
    const value = params.value !== undefined ? params.value : '';

    if (!row || row < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Numéro de ligne invalide' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    // code_conduite = colonne D (4), commentaire = colonne F (6)
    const col   = field === 'commentaire' ? 6 : 4;
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    sheet.getRange(row, col).setValue(value);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Lecture par défaut : retourne toutes les lignes non vides
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const rows  = sheet.getDataRange().getValues();
  const data  = rows.slice(1)
    .filter(row => row[0] && row[0].toString().trim())
    .map((row, i) => ({
      row:          i + 2,          // numéro de ligne Google Sheets (1-indexé, ligne 1 = en-tête)
      fournisseur:  row[0] || '',
      contact:      row[1] || '',
      email:        row[2] || '',
      code_conduite: row[3] || '',  // 'ok' | '' | '?'
      questionnaire: row[4] || '',
      commentaire:  row[5] || ''
    }));

  return ContentService
    .createTextOutput(JSON.stringify({ data }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 2 : Déployer le script dans Google Sheets**

1. Ouvrir [le Google Sheet](https://docs.google.com/spreadsheets/d/1snLQRLAaoJGs7tPbm4Hlae9Qq3uENRy2k6pVNQSdKcg/)
2. **Extensions → Apps Script**
3. Supprimer le contenu par défaut, coller le code ci-dessus
4. **Déployer → Nouveau déploiement**
5. Type : **Application Web**
6. Exécuter en tant que : **Moi**
7. Personnes ayant accès : **Tout le monde**
8. Cliquer **Déployer** → autoriser les permissions → copier l'URL générée

L'URL ressemble à : `https://script.google.com/macros/s/AKfycb.../exec`

- [ ] **Step 3 : Tester l'URL manuellement**

Coller l'URL dans le navigateur. Résultat attendu : JSON avec `{"data": [...]}` contenant 47 entrées.

- [ ] **Step 4 : Commiter**

```bash
git add docs/apps-script/code-conduite.gs
git commit -m "docs: ajouter script Google Apps Script Code de Conduite"
```

---

## Task 2 : Ajouter la constante et le composant dans app.js

**Files:**
- Modify: `public/app.js` — ajouter après la ligne 16 (après `PILLAR_COLORS`) et à la fin avant les event listeners (ligne ~676)

- [ ] **Step 1 : Ajouter la constante `CODE_CONDUITE_SCRIPT_URL`**

Dans `public/app.js`, après le bloc `PILLAR_COLORS` (ligne 16), ajouter :

```javascript
// URL du Google Apps Script déployé pour le Code de Conduite
// Laisser vide '' si non configuré — la vue affichera les instructions de setup
const CODE_CONDUITE_SCRIPT_URL = '';
```

- [ ] **Step 2 : Ajouter le composant `codeConduiteView()`**

Dans `public/app.js`, avant le bloc `// POST-RENDER: Reinitialize Lucide icons` (dernière section), ajouter le composant complet :

```javascript
// =====================================================================
// CODE DE CONDUITE VIEW COMPONENT
// =====================================================================
function codeConduiteView() {
  const CACHE_KEY = 'rse-code-conduite-cache';

  return {
    entries:            [],
    loading:            false,
    syncError:          null,
    lastSync:           null,
    search:             '',
    filterStatus:       '',           // '' | 'signed' | 'unsigned'
    sortKey:            'name_asc',   // 'name_asc' | 'name_desc' | 'signed_first' | 'unsigned_first' | 'sheet_order'
    pendingRequests:    0,
    editingCommentaire: null,         // entry.row en cours d'édition, ou null

    async init() {
      // Affichage instantané depuis le cache localStorage
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try { this.entries = JSON.parse(cached); } catch (_) {}
      }

      if (!CODE_CONDUITE_SCRIPT_URL) return;

      this.loading = true;
      try {
        const res = await fetch(CODE_CONDUITE_SCRIPT_URL);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        this.entries = json.data || [];
        localStorage.setItem(CACHE_KEY, JSON.stringify(this.entries));
        this.lastSync = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        this.syncError = null;
      } catch (e) {
        this.syncError = e.message;
      } finally {
        this.loading = false;
      }
    },

    filteredEntries() {
      let list = [...this.entries];

      if (this.search.trim()) {
        const q = this.search.toLowerCase().trim();
        list = list.filter(e => e.fournisseur.toLowerCase().includes(q));
      }

      if (this.filterStatus === 'signed')
        list = list.filter(e => e.code_conduite === 'ok');
      else if (this.filterStatus === 'unsigned')
        list = list.filter(e => e.code_conduite !== 'ok');

      switch (this.sortKey) {
        case 'name_asc':
          list.sort((a, b) => a.fournisseur.localeCompare(b.fournisseur, 'fr'));
          break;
        case 'name_desc':
          list.sort((a, b) => b.fournisseur.localeCompare(a.fournisseur, 'fr'));
          break;
        case 'signed_first':
          list.sort((a, b) => {
            const da = a.code_conduite === 'ok' ? 0 : 1;
            const db = b.code_conduite === 'ok' ? 0 : 1;
            return da - db || a.fournisseur.localeCompare(b.fournisseur, 'fr');
          });
          break;
        case 'unsigned_first':
          list.sort((a, b) => {
            const da = a.code_conduite === 'ok' ? 1 : 0;
            const db = b.code_conduite === 'ok' ? 1 : 0;
            return da - db || a.fournisseur.localeCompare(b.fournisseur, 'fr');
          });
          break;
        case 'sheet_order':
          list.sort((a, b) => a.row - b.row);
          break;
      }
      return list;
    },

    async toggleSignature(entry) {
      const newVal = entry.code_conduite === 'ok' ? '' : 'ok';
      const oldVal = entry.code_conduite;

      // Mise à jour optimiste
      entry.code_conduite = newVal;
      this._saveCache();

      if (!CODE_CONDUITE_SCRIPT_URL) return;

      this.pendingRequests++;
      try {
        const url = CODE_CONDUITE_SCRIPT_URL
          + '?action=update&row=' + entry.row
          + '&field=code_conduite&value=' + encodeURIComponent(newVal);
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        this.lastSync  = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        this.syncError = null;
      } catch (e) {
        // Rollback
        entry.code_conduite = oldVal;
        this._saveCache();
        this.syncError = 'Erreur de synchronisation';
      } finally {
        this.pendingRequests--;
      }
    },

    async saveCommentaire(entry, val) {
      const oldVal = entry.commentaire;
      if (val === oldVal) { this.editingCommentaire = null; return; }

      // Mise à jour optimiste
      entry.commentaire      = val;
      this.editingCommentaire = null;
      this._saveCache();

      if (!CODE_CONDUITE_SCRIPT_URL) return;

      this.pendingRequests++;
      try {
        const url = CODE_CONDUITE_SCRIPT_URL
          + '?action=update&row=' + entry.row
          + '&field=commentaire&value=' + encodeURIComponent(val);
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        this.lastSync  = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        this.syncError = null;
      } catch (e) {
        entry.commentaire = oldVal;
        this._saveCache();
        this.syncError = 'Erreur de synchronisation';
      } finally {
        this.pendingRequests--;
      }
    },

    _saveCache() {
      localStorage.setItem(CACHE_KEY, JSON.stringify(this.entries));
    },

    signedCount() {
      return this.entries.filter(e => e.code_conduite === 'ok').length;
    },

    isConfigured() {
      return !!CODE_CONDUITE_SCRIPT_URL;
    }
  };
}
```

- [ ] **Step 3 : Vérifier qu'il n'y a pas d'erreurs JS**

Ouvrir `index.html` dans le navigateur → F12 → Console. Résultat attendu : aucune erreur.

- [ ] **Step 4 : Commiter**

```bash
git add public/app.js
git commit -m "feat: ajouter composant codeConduiteView() et constante CODE_CONDUITE_SCRIPT_URL"
```

---

## Task 3 : Ajouter le bouton de navigation dans index.html

**Files:**
- Modify: `index.html` — section navbar, après le bouton "Comparaison" (ligne ~112)

- [ ] **Step 1 : Ajouter le bouton "Code de Conduite" dans la navbar**

Dans `index.html`, localiser le bloc navigation (autour de la ligne 110-113) :

```html
            <button @click="view='comparaison'" :class="view==='comparaison' ? 'active' : ''" class="nav-link">
              Comparaison
            </button>
          </div>
```

Le remplacer par :

```html
            <button @click="view='comparaison'" :class="view==='comparaison' ? 'active' : ''" class="nav-link">
              Comparaison
            </button>
            <button @click="view='code-conduite'; $nextTick(() => lucide.createIcons())" :class="view==='code-conduite' ? 'active' : ''" class="nav-link">
              Code de Conduite
            </button>
          </div>
```

- [ ] **Step 2 : Vérifier l'affichage du bouton**

Ouvrir le dashboard dans le navigateur. Résultat attendu : bouton "Code de Conduite" visible dans la navbar après "Comparaison". Cliquer dessus ne doit pas provoquer d'erreur (la vue n'existe pas encore — la page sera simplement vide dans le `<main>`).

- [ ] **Step 3 : Commiter**

```bash
git add index.html
git commit -m "feat: ajouter bouton Code de Conduite dans la navbar"
```

---

## Task 4 : Ajouter la vue complète dans index.html

**Files:**
- Modify: `index.html` — section `<main>`, après `</div><!-- /comparaison -->` (ligne ~683)

- [ ] **Step 1 : Insérer la vue Code de Conduite**

Dans `index.html`, après `</div><!-- /comparaison -->` et avant `</main>`, insérer le bloc suivant :

```html

      <!-- ==================== VUE CODE DE CONDUITE ==================== -->
      <div x-show="view==='code-conduite'" class="fade-in" x-data="codeConduiteView()" x-init="init()">

        <!-- En-tête -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 class="text-xl font-bold text-gray-900">Code de Conduite Fournisseurs</h1>
            <p class="text-sm text-gray-500 mt-0.5">Suivi des engagements au Code de Conduite</p>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <!-- Badge compteur -->
            <div class="flex items-center gap-2 px-4 py-2 bg-accent/10 rounded-lg">
              <i data-lucide="shield-check" class="w-4 h-4 text-accent"></i>
              <span class="text-sm font-semibold text-accent">
                <span x-text="signedCount()"></span> / <span x-text="entries.length"></span> ont signé
              </span>
            </div>
            <!-- Indicateur de synchronisation -->
            <div class="flex items-center gap-1.5 text-xs min-w-[120px]">
              <i data-lucide="loader-2" class="w-3.5 h-3.5 text-accent" x-show="pendingRequests > 0"
                style="display:none; animation: spin 1s linear infinite;"></i>
              <i data-lucide="check-circle" class="w-3.5 h-3.5 text-green-500"
                x-show="pendingRequests === 0 && lastSync && !syncError" style="display:none"></i>
              <i data-lucide="alert-circle" class="w-3.5 h-3.5 text-danger"
                x-show="syncError" style="display:none"></i>
              <span x-show="pendingRequests > 0" class="text-gray-400">Sync…</span>
              <span x-show="pendingRequests === 0 && lastSync && !syncError" class="text-gray-400"
                x-text="'Sync : ' + lastSync"></span>
              <span x-show="syncError" class="text-danger text-xs" x-text="syncError"></span>
            </div>
          </div>
        </div>

        <!-- Message de configuration si URL non renseignée -->
        <div x-show="!isConfigured()" class="card border border-amber-200 bg-amber-50/50 mb-6" style="display:none">
          <div class="flex items-start gap-3">
            <i data-lucide="settings" class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"></i>
            <div>
              <h3 class="font-semibold text-amber-800 mb-1">Configuration requise</h3>
              <p class="text-sm text-amber-700 mb-3">
                Renseignez <code class="font-mono bg-amber-100 px-1 rounded">CODE_CONDUITE_SCRIPT_URL</code> dans
                <code class="font-mono bg-amber-100 px-1 rounded">public/app.js</code> avec l'URL du Google Apps Script déployé.
              </p>
              <ol class="text-sm text-amber-700 space-y-1 list-decimal list-inside">
                <li>Google Sheet → <strong>Extensions → Apps Script</strong></li>
                <li>Coller le script de <code class="font-mono bg-amber-100 px-1 rounded">docs/apps-script/code-conduite.gs</code></li>
                <li><strong>Déployer → Nouvelle déploiement</strong> → Web App → Accès : Tout le monde</li>
                <li>Copier l'URL et la coller dans <code class="font-mono bg-amber-100 px-1 rounded">CODE_CONDUITE_SCRIPT_URL</code></li>
              </ol>
            </div>
          </div>
        </div>

        <!-- Filtres et tri -->
        <div class="card mb-4">
          <div class="flex flex-col sm:flex-row gap-3">
            <!-- Recherche -->
            <div class="relative flex-1">
              <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"></i>
              <input type="text" x-model="search" placeholder="Rechercher un fournisseur…"
                class="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
            </div>
            <!-- Filtre statut -->
            <select x-model="filterStatus"
              class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent bg-white">
              <option value="">Tous les fournisseurs</option>
              <option value="signed">✅ Signés</option>
              <option value="unsigned">⬜ Non signés</option>
            </select>
            <!-- Tri -->
            <select x-model="sortKey"
              class="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent bg-white">
              <option value="name_asc">Tri : A → Z</option>
              <option value="name_desc">Tri : Z → A</option>
              <option value="signed_first">Signés en premier</option>
              <option value="unsigned_first">Non signés en premier</option>
              <option value="sheet_order">Ordre du tableau</option>
            </select>
          </div>
        </div>

        <!-- État de chargement initial -->
        <div x-show="loading && entries.length === 0" class="card flex items-center justify-center py-12 gap-3">
          <div class="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
          <span class="text-sm text-gray-500">Chargement depuis Google Sheets…</span>
        </div>

        <!-- Tableau -->
        <div class="card overflow-x-auto p-0" x-show="entries.length > 0 || (!loading && isConfigured())">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 bg-gray-50/80">
                <th class="text-left px-4 py-3 font-semibold text-gray-600 w-1/4">Fournisseur</th>
                <th class="text-left px-3 py-3 font-semibold text-gray-600 hide-mobile">Contact</th>
                <th class="text-left px-3 py-3 font-semibold text-gray-600 hide-mobile">Email</th>
                <th class="text-center px-3 py-3 font-semibold text-gray-600 w-36">Code de Conduite</th>
                <th class="text-left px-3 py-3 font-semibold text-gray-600">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              <template x-for="entry in filteredEntries()" :key="entry.row">
                <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">

                  <!-- Fournisseur -->
                  <td class="px-4 py-3">
                    <div class="font-medium text-gray-800 truncate max-w-[200px]" x-text="entry.fournisseur"></div>
                  </td>

                  <!-- Contact -->
                  <td class="px-3 py-3 hide-mobile">
                    <div class="text-sm text-gray-600 truncate max-w-[140px]" x-text="entry.contact || '—'"></div>
                  </td>

                  <!-- Email -->
                  <td class="px-3 py-3 hide-mobile">
                    <a x-show="entry.email" :href="'mailto:' + entry.email"
                      class="text-accent hover:underline text-xs truncate block max-w-[180px]"
                      x-text="entry.email" style="display:none"></a>
                    <span x-show="!entry.email" class="text-gray-400 text-xs">—</span>
                  </td>

                  <!-- Code de Conduite — checkbox stylisée -->
                  <td class="px-3 py-3 text-center">
                    <button @click="toggleSignature(entry)"
                      class="w-6 h-6 rounded border-2 flex items-center justify-center mx-auto transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent/40"
                      :class="entry.code_conduite === 'ok'
                        ? 'bg-accent border-accent hover:bg-accent/80'
                        : 'border-gray-300 hover:border-accent bg-white'"
                      :title="entry.code_conduite === 'ok' ? 'Signé — cliquer pour retirer' : 'Non signé — cliquer pour valider'">
                      <span x-show="entry.code_conduite === 'ok'"
                        class="text-white font-bold leading-none" style="font-size:13px; display:none">✓</span>
                    </button>
                  </td>

                  <!-- Commentaire éditable inline -->
                  <td class="px-3 py-3" @click.stop>
                    <div class="relative">
                      <div
                        x-show="editingCommentaire !== entry.row"
                        @click="editingCommentaire = entry.row; $nextTick(() => $el.parentElement.querySelector('input').focus())"
                        class="text-sm text-gray-600 cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 min-h-[1.75rem] min-w-[80px] truncate max-w-[220px] flex items-center"
                        :title="entry.commentaire ? entry.commentaire : 'Cliquer pour ajouter un commentaire'"
                        :class="entry.commentaire ? '' : 'text-gray-300 italic'"
                        x-text="entry.commentaire || 'Ajouter…'"
                      ></div>
                      <input
                        type="text"
                        x-show="editingCommentaire === entry.row"
                        style="display:none"
                        :value="entry.commentaire"
                        @blur="saveCommentaire(entry, $event.target.value)"
                        @keydown.enter.prevent="saveCommentaire(entry, $event.target.value)"
                        @keydown.escape="editingCommentaire = null"
                        class="w-full px-2 py-1 border border-accent rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 min-w-[120px]"
                      />
                    </div>
                  </td>

                </tr>
              </template>

              <!-- Aucun résultat -->
              <tr x-show="filteredEntries().length === 0 && !loading">
                <td colspan="5" class="px-4 py-8 text-center text-gray-400 text-sm">
                  Aucun fournisseur ne correspond aux critères.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div><!-- /code-conduite -->
```

- [ ] **Step 2 : Tester la vue sans URL configurée**

Ouvrir le dashboard → cliquer "Code de Conduite". Résultats attendus :
- Message de configuration affiché avec les instructions
- Aucune erreur console
- Filtres et tri visibles (même sans données)

- [ ] **Step 3 : Configurer `CODE_CONDUITE_SCRIPT_URL` et tester le flux complet**

Dans `public/app.js`, remplacer :
```javascript
const CODE_CONDUITE_SCRIPT_URL = '';
```
par l'URL obtenue à la Task 1 :
```javascript
const CODE_CONDUITE_SCRIPT_URL = 'https://script.google.com/macros/s/TON_URL_ICI/exec';
```

Recharger le dashboard → naviguer vers "Code de Conduite". Résultats attendus :
- Spinner de chargement brièvement visible
- 47 fournisseurs s'affichent
- Indicateur "Sync : HH:MM" apparaît
- Badges signés/non signés correctement colorés

- [ ] **Step 4 : Tester les interactions**

**Checkbox :**
1. Cocher un fournisseur non signé → `✓` apparaît, indicateur "Sync…" s'affiche puis "Sync : HH:MM"
2. Ouvrir le Google Sheet → vérifier que la colonne D est maintenant "ok" pour ce fournisseur
3. Décocher → vérifier que la colonne D devient vide dans le Sheet

**Commentaire :**
1. Cliquer sur la cellule commentaire d'un fournisseur → input apparaît avec le texte existant
2. Modifier le texte → appuyer Entrée → texte mis à jour, input disparaît
3. Vérifier la colonne F dans le Google Sheet
4. Cliquer, modifier → appuyer Échap → texte revient à l'ancienne valeur (pas de save)

**Filtres :**
1. Sélectionner "✅ Signés" → seuls les fournisseurs avec `ok` apparaissent
2. Sélectionner "⬜ Non signés" → seuls ceux sans `ok` apparaissent
3. Taper un nom dans la recherche → filtrage en temps réel

**Tris :**
1. "Signés en premier" → fournisseurs avec `ok` en haut
2. "Non signés en premier" → inverse
3. "Z → A" → ordre alphabétique inverse
4. "Ordre du tableau" → ordre du Google Sheet (ligne 2, 3, 4…)

**Cache localStorage :**
1. Fermer et rouvrir le navigateur → naviguer vers Code de Conduite → les données s'affichent instantanément avant même que le fetch se termine

- [ ] **Step 5 : Commiter**

```bash
git add index.html public/app.js
git commit -m "feat: ajouter vue Code de Conduite avec sync Google Sheets"
```

---

## Task 5 : Push final vers GitHub

- [ ] **Step 1 : Vérifier l'état git**

```bash
git status
git log --oneline -5
```

Résultat attendu : branche propre, 4 commits depuis le dernier push.

- [ ] **Step 2 : Pousser vers GitHub**

```bash
git push origin main
```

- [ ] **Step 3 : Vérifier le déploiement GitHub Pages**

Attendre ~2 minutes puis ouvrir `https://77darius77.github.io/rse-dashboard/`. Résultat attendu : bouton "Code de Conduite" visible dans la navbar.
