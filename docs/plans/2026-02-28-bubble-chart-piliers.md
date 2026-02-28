# Bubble Chart Matrice Performance × Importance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remplacer le Bar Chart "Score moyen par pilier" par un Bubble Chart "Matrice performance × importance", et déplacer "Détail par pilier" à la position du Bar Chart.

**Architecture:** Modifications purement frontend dans `index.html`. Le HTML est réorganisé (suppression du bloc Bar Chart, déplacement de "Détail par pilier", ajout du bloc Bubble Chart). Le JS remplace `drawBarPillars()` par `drawBubblePillars()`. Le plugin `chartjs-plugin-datalabels` est ajouté via CDN pour afficher les noms des piliers sur les bulles.

**Tech Stack:** Chart.js 4.4.0, chartjs-plugin-datalabels, Alpine.js, Tailwind CSS

---

### Task 1 : Ajouter le plugin datalabels via CDN

**Files:**
- Modify: `index.html:13`

**Step 1 : Ajouter la balise script datalabels après Chart.js**

Après la ligne 13 (`<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>`), ajouter :

```html
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>
```

**Step 2 : Enregistrer le plugin globalement**

Chercher dans le JS la zone d'initialisation globale (avant `function app()`). Ajouter :

```javascript
Chart.register(ChartDataLabels);
```

---

### Task 2 : Réorganiser le HTML de la section Analyse

**Files:**
- Modify: `index.html:630-665`

**Step 1 : Supprimer le bloc Bar Chart (lignes 630-639)**

Supprimer entièrement :
```html
<!-- Bar chart horizontal -->
<div class="card">
  <h2 class="section-title flex items-center gap-2">
    <i data-lucide="bar-chart-horizontal" class="w-4 h-4 text-accent"></i>
    Score moyen par pilier
  </h2>
  <div style="position:relative; height:280px;">
    <canvas id="barPillars"></canvas>
  </div>
</div>
```

**Step 2 : Ajouter le bloc Bubble Chart après "Détail par pilier"**

Après le bloc `<!-- Tableau piliers détaillé -->` (après la fermeture `</div>` du card), ajouter :

```html
<!-- Matrice performance × importance -->
<div class="card">
  <h2 class="section-title flex items-center gap-2">
    <i data-lucide="target" class="w-4 h-4 text-accent"></i>
    Matrice performance × importance
  </h2>
  <p class="text-xs text-gray-400 mb-3">Taille des bulles = nombre de fournisseurs en rouge sur ce pilier</p>
  <div style="position:relative; height:320px;">
    <canvas id="bubblePillars"></canvas>
  </div>
</div>
```

---

### Task 3 : Remplacer drawBarPillars() par drawBubblePillars()

**Files:**
- Modify: `index.html:1140-1284`

**Step 1 : Mettre à jour initAnalyseCharts()**

Remplacer `this.drawBarPillars()` par `this.drawBubblePillars()`.

**Step 2 : Remplacer la fonction drawBarPillars() entière par drawBubblePillars()**

```javascript
drawBubblePillars() {
  destroyChart('bubblePillars');
  const canvas = document.getElementById('bubblePillars');
  if (!canvas) return;

  const PILLAR_WEIGHTS = {
    gouvernance: 20,
    droits_humains: 15,
    sst: 20,
    ethique: 15,
    environnement: 20,
    achats: 10
  };

  const suppliers = this.data.suppliers || [];
  const pillars = Object.keys(this.data.collective.by_pillar);

  const datasets = pillars.map(pillar => {
    const score = this.data.collective.by_pillar[pillar];
    const weight = PILLAR_WEIGHTS[pillar] || 10;
    const redCount = suppliers.filter(s => s.scores && s.scores[pillar] < 50).length;
    const color = score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#E63946';

    return {
      label: PILLAR_LABELS[pillar] || pillar,
      data: [{ x: score, y: weight, r: Math.max(12, redCount * 4) }],
      backgroundColor: color + 'bb',
      borderColor: color,
      borderWidth: 2,
      redCount
    };
  });

  new Chart(canvas, {
    type: 'bubble',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const ds = datasets[ctx.datasetIndex];
              return [
                ds.label,
                'Score moyen : ' + ctx.raw.x.toFixed(1) + '%',
                'Importance : ' + ctx.raw.y + '%',
                'Fournisseurs en rouge : ' + ds.redCount
              ];
            }
          }
        },
        datalabels: {
          color: '#374151',
          font: { size: 11, weight: '600' },
          formatter: (val, ctx) => datasets[ctx.datasetIndex].label,
          anchor: 'end',
          align: 'top',
          offset: 4
        }
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          title: { display: true, text: 'Score moyen (%)', font: { size: 11 }, color: '#6b7280' },
          ticks: { callback: v => v + '%', font: { size: 11 } },
          grid: { color: '#f3f4f6' }
        },
        y: {
          min: 5,
          max: 25,
          title: { display: true, text: 'Importance (%)', font: { size: 11 }, color: '#6b7280' },
          ticks: { callback: v => v + '%', font: { size: 11 }, stepSize: 5 },
          grid: { color: '#f3f4f6' }
        }
      }
    }
  });
}
```

---

### Task 4 : Vérification visuelle

**Step 1 : Ouvrir index.html dans le navigateur**

```bash
cd /home/blaise/SuperPouvoirs/rse-dashboard && python3 -m http.server 8080
```

Ouvrir : http://localhost:8080

**Step 2 : Naviguer vers Analyse Globale**

Vérifier :
- "Détail par pilier" apparaît en premier (avant le bubble chart)
- Le Bubble Chart "Matrice performance × importance" s'affiche en dessous
- Les 6 bulles sont visibles avec leurs labels
- Les tooltips fonctionnent
- Plus de Bar Chart "Score moyen par pilier"
