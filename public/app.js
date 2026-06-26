// =====================================================================
// PILLAR LABELS
// =====================================================================
const PILLAR_LABELS = {
  gouvernance: 'Gouvernance',
  droits_humains: 'Droits humains',
  sst: 'Santé & Sécurité',
  ethique: 'Éthique',
  environnement: 'Environnement',
  achats: 'Achats responsables'
};

// Chart color palette for pillars
const PILLAR_COLORS = [
  '#1B3F6E', '#00A896', '#F4A261', '#E63946', '#6366f1', '#10b981'
];

// URL du Google Apps Script déployé pour le Code de Conduite
// Laisser vide '' si non configuré — la vue affichera les instructions de setup
const CODE_CONDUITE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbysN66yaGPgbuWS5i4pLRBvPxDQ6v-P1LXaByd23mpzszTjI8HTD8iAjPpZwHCiZvrW/exec';

// =====================================================================
// CHART HELPERS
// =====================================================================
function destroyChart(id) {
  const existing = Chart.getChart(id);
  if (existing) existing.destroy();
}

function themeColors() {
  const dark = document.documentElement.classList.contains('dark');
  return {
    grid: dark ? '#334155' : '#e5e7eb',
    gridLight: dark ? '#334155' : '#f3f4f6',
    ticks: dark ? '#94a3b8' : '#9ca3af',
    labels: dark ? '#cbd5e1' : '#111827',
    axisTitle: dark ? '#94a3b8' : '#6b7280',
    datalabels: dark ? '#e2e8f0' : '#374151',
    border: dark ? '#1e293b' : '#ffffff',
  };
}

function radarDefaults(labels, values, label, color) {
  return {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label,
        data: values,
        backgroundColor: color + '20',
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      layout: { padding: { left: 30, right: 30, top: 10, bottom: 10 } },
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { stepSize: 25, font: { size: 12 }, color: themeColors().ticks, backdropColor: 'transparent' },
          grid: { color: themeColors().grid },
          angleLines: { color: themeColors().grid },
          pointLabels: { font: { size: 13 }, color: themeColors().labels }
        }
      }
    }
  };
}

// =====================================================================
// MAIN APP
// =====================================================================
Chart.register(ChartDataLabels);
Chart.defaults.plugins.datalabels.display = false;

function app() {
  return {
    view: 'direction',
    data: {},
    selectedSupplier: null,
    loading: true,
    error: null,
    lastUpdated: '',
    colorTheme: localStorage.getItem('rse-theme') || 'system',
    navList: [],
    analyseFilterLevel: '',
    analyseFilterLang: '',

    async init() {
      this.applyTheme();
      try {
        this.loading = true;
        this.error = null;
        const res = await fetch('public/data.json?t=' + new Date().getTime());
        if (!res.ok) throw new Error('Impossible de charger les données (HTTP ' + res.status + ')');
        this.data = await res.json();

        // Format last updated
        if (this.data.meta && this.data.meta.last_updated) {
          const d = new Date(this.data.meta.last_updated);
          this.lastUpdated = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        this.loading = false;

        // Initialize icons + charts
        await this.$nextTick();
        lucide.createIcons();
        this.initCharts();

      } catch (e) {
        this.error = e.message;
        this.loading = false;
      }
    },

    openSupplier(s, list = null) {
      this.selectedSupplier = s;
      this.navList = list && list.length ? list : (this.data?.suppliers || []);
      this.view = 'fournisseur';
      this.$nextTick(() => {
        lucide.createIcons();
        this.drawSupplierRadar(s);
      });
    },

    currentSupplierIndex() {
      if (!this.navList.length || !this.selectedSupplier) return -1;
      return this.navList.findIndex(s => s.id === this.selectedSupplier.id);
    },
    hasPrevSupplier() {
      return this.currentSupplierIndex() > 0;
    },
    hasNextSupplier() {
      const idx = this.currentSupplierIndex();
      return idx >= 0 && idx < this.navList.length - 1;
    },
    prevSupplier() {
      const idx = this.currentSupplierIndex();
      if (idx > 0) this.openSupplier(this.navList[idx - 1], this.navList);
    },
    nextSupplier() {
      const idx = this.currentSupplierIndex();
      if (idx < this.navList.length - 1) this.openSupplier(this.navList[idx + 1], this.navList);
    },

    getLevelClass(level) {
      if (level === 'green') return 'badge-green';
      if (level === 'amber') return 'badge-amber';
      return 'badge-red';
    },

    getLevelLabel(level) {
      if (level === 'green') return '🟢 Bon élève';
      if (level === 'amber') return '🟡 En progression';
      return '🔴 Prioritaire';
    },

    getPillarLabel(key) {
      return PILLAR_LABELS[key] || key;
    },

    extractEmail(val) {
      if (!val) return '';
      const m = val.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      return m ? m[0] : val;
    },

    applyTheme() {
      const isDark = this.colorTheme === 'dark' ||
        (this.colorTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
      localStorage.setItem('rse-theme', this.colorTheme);
      this.reinitCharts();
      window.dispatchEvent(new CustomEvent('rse-theme-changed'));
    },

    reinitCharts() {
      if (!this.data || !this.data.collective) return;
      this.$nextTick(() => {
        if (this.view === 'direction') {
          this.drawCollectiveRadar();
        } else if (this.view === 'analyse') {
          this.drawDonutLevels();
          this.drawDonutLangs();
          this.drawBubblePillars();
        } else if (this.view === 'fournisseur' && this.selectedSupplier) {
          this.drawSupplierRadar(this.selectedSupplier);
        }
      });
    },

    cycleTheme() {
      const modes = ['system', 'light', 'dark'];
      this.colorTheme = modes[(modes.indexOf(this.colorTheme) + 1) % 3];
      this.applyTheme();
    },

    themeIcon() {
      return this.colorTheme === 'light' ? 'sun' : this.colorTheme === 'dark' ? 'moon' : 'monitor';
    },

    themeLabel() {
      return this.colorTheme === 'light' ? 'Mode jour' : this.colorTheme === 'dark' ? 'Mode nuit' : 'Système';
    },

    async printFiche() {
      const wasDark = document.documentElement.classList.contains('dark');
      if (wasDark) {
        // Passer en mode clair pour l'impression
        document.documentElement.classList.remove('dark');
        // Redessiner le radar en couleurs claires
        if (this.selectedSupplier) this.drawSupplierRadar(this.selectedSupplier);
        // Attendre 2 cycles rAF pour que Chart.js ait le temps de rendre
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
      window.print();
      // Restaurer le thème original après l'impression
      window.addEventListener('afterprint', () => {
        if (wasDark) {
          document.documentElement.classList.add('dark');
          if (this.selectedSupplier) this.drawSupplierRadar(this.selectedSupplier);
        }
      }, { once: true });
    },

    getScoreColor(score) {
      if (score >= 70) return 'bg-green-500';
      if (score >= 50) return 'bg-amber-400';
      return 'bg-red-500';
    },

    topPillars() {
      if (!this.data.collective) return [];
      return Object.entries(this.data.collective.by_pillar)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key, val]) => ({ key, val }));
    },

    weakPillars() {
      if (!this.data.collective) return [];
      return Object.entries(this.data.collective.by_pillar)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 3)
        .map(([key, val]) => ({ key, val }));
    },

    prioritySuppliers() {
      if (!this.data.suppliers) return [];
      return this.data.suppliers
        .filter(s => s.level === 'red')
        .sort((a, b) => a.score_global - b.score_global)
        .slice(0, 5);
    },

    // ----------------------------------------------------------------
    // CHARTS
    // ----------------------------------------------------------------
    initCharts() {
      if (!this.data.collective) return;
      this.$nextTick(() => {
        this.drawCollectiveRadar();
      });
    },

    analyseSuppliers() {
      if (!this.data?.suppliers) return [];
      let list = this.data.suppliers;
      if (this.analyseFilterLevel) list = list.filter(s => s.level === this.analyseFilterLevel);
      if (this.analyseFilterLang)  list = list.filter(s => s.language === this.analyseFilterLang);
      return list;
    },

    analyseStats() {
      const suppliers = this.analyseSuppliers();
      if (!suppliers.length || !this.data?.collective) return null;
      const pillars = Object.keys(this.data.collective.by_pillar);
      const by_pillar = {};
      pillars.forEach(p => {
        const scores = suppliers.map(s => s.scores?.[p] ?? 0);
        by_pillar[p] = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
      });
      return {
        total:       suppliers.length,
        count_green: suppliers.filter(s => s.level === 'green').length,
        count_amber: suppliers.filter(s => s.level === 'amber').length,
        count_red:   suppliers.filter(s => s.level === 'red').length,
        count_fr:    suppliers.filter(s => s.language === 'fr').length,
        count_en:    suppliers.filter(s => s.language === 'en').length,
        by_pillar,
      };
    },

    initAnalyseCharts() {
      if (!this.data.collective) return;
      this.$nextTick(() => {
        this.drawDonutLevels();
        this.drawDonutLangs();
        this.drawBubblePillars();
      });
    },

    drawCollectiveRadar() {
      destroyChart('radarCollectif');
      const canvas = document.getElementById('radarCollectif');
      if (!canvas) return;
      const pillars = Object.keys(this.data.collective.by_pillar);
      const labels = pillars.map(p => PILLAR_LABELS[p] || p);
      const values = pillars.map(p => this.data.collective.by_pillar[p]);
      const cfg = radarDefaults(labels, values, 'Score collectif', '#00A896');
      cfg.options.aspectRatio = 1.25;
      new Chart(canvas, cfg);
    },

    drawSupplierRadar(s) {
      const canvasId = 'radar-' + s.id;
      destroyChart(canvasId);
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const pillars = Object.keys(s.scores);
      const labels = pillars.map(p => PILLAR_LABELS[p] || p);
      const values = pillars.map(p => s.scores[p]);
      const color = s.level === 'green' ? '#22c55e' : s.level === 'amber' ? '#f59e0b' : '#E63946';
      new Chart(canvas, radarDefaults(labels, values, s.name, color));
    },

    drawDonutLevels() {
      destroyChart('donutLevels');
      const canvas = document.getElementById('donutLevels');
      if (!canvas) return;
      const stats = this.analyseStats();
      if (!stats) return;
      new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['Bon élève', 'En progression', 'Prioritaire'],
          datasets: [{
            data: [stats.count_green, stats.count_amber, stats.count_red],
            backgroundColor: ['#22c55e', '#f59e0b', '#E63946'],
            borderWidth: 2,
            borderColor: themeColors().border
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ' ' + ctx.label + ' : ' + ctx.raw + ' fournisseurs'
              }
            }
          }
        }
      });
    },

    drawDonutLangs() {
      destroyChart('donutLangs');
      const canvas = document.getElementById('donutLangs');
      if (!canvas) return;
      const stats = this.analyseStats();
      if (!stats) return;
      new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['Français', 'Anglais'],
          datasets: [{
            data: [stats.count_fr, stats.count_en],
            backgroundColor: ['#1B3F6E', '#00A896'],
            borderWidth: 2,
            borderColor: themeColors().border
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ' ' + ctx.label + ' : ' + ctx.raw + ' fournisseurs'
              }
            }
          }
        }
      });
    },

    drawBubblePillars() {
      destroyChart('bubblePillars');
      const canvas = document.getElementById('bubblePillars');
      if (!canvas) return;

      const WEIGHTS = {
        gouvernance: 10,
        droits_humains: 20,
        sst: 20,
        ethique: 10,
        environnement: 25,
        achats: 15
      };

      const stats = this.analyseStats();
      if (!stats) return;
      const suppliers = this.analyseSuppliers();
      const pillars = Object.keys(stats.by_pillar);

      const datasets = pillars.map(pillar => {
        const score = stats.by_pillar[pillar];
        const weight = WEIGHTS[pillar] || 10;
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
          layout: {
            padding: { top: 20 }
          },
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
              display: true,
              color: themeColors().datalabels,
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
              title: { display: true, text: 'Score moyen (%)', font: { size: 11 }, color: themeColors().axisTitle },
              ticks: { callback: v => v + '%', font: { size: 11 }, color: themeColors().ticks },
              grid: { color: themeColors().gridLight }
            },
            y: {
              min: 0,
              max: 30,
              title: { display: true, text: 'Importance (%)', font: { size: 11 }, color: themeColors().axisTitle },
              ticks: { callback: v => v + '%', font: { size: 11 }, stepSize: 5, color: themeColors().ticks },
              grid: { color: themeColors().gridLight }
            }
          }
        }
      });
    }
  };
}

// =====================================================================
// CLASSEMENT VIEW COMPONENT
// =====================================================================
function classementView() {
  return {
    search: '',
    filterLevel: '',
    filterLang: '',
    sortKey: 'score_global',
    sortDir: 'desc',

    getAppData() {
      // Get the parent Alpine app data
      const appEl = document.querySelector('[x-data="app()"]') ||
        document.querySelector('body[x-data]');
      if (appEl) return Alpine.$data(appEl);
      return null;
    },

    getLevelClass(level) {
      if (level === 'green') return 'badge-green';
      if (level === 'amber') return 'badge-amber';
      return 'badge-red';
    },

    getLevelLabel(level) {
      if (level === 'green') return '🟢 Bon élève';
      if (level === 'amber') return '🟡 En progression';
      return '🔴 Prioritaire';
    },

    filteredSuppliers() {
      const appData = this.getAppData();
      if (!appData || !appData.data || !appData.data.suppliers) return [];

      let list = [...appData.data.suppliers];

      if (this.search.trim()) {
        const q = this.search.toLowerCase().trim();
        list = list.filter(s =>
          s.name.toLowerCase().includes(q) ||
          (s.contact_name && s.contact_name.toLowerCase().includes(q))
        );
      }
      if (this.filterLevel) list = list.filter(s => s.level === this.filterLevel);
      if (this.filterLang) list = list.filter(s => s.language === this.filterLang);

      const levelOrder = { green: 2, amber: 1, red: 0 };
      list.sort((a, b) => {
        let va, vb;
        if (this.sortKey === 'name') {
          va = a.name; vb = b.name;
          return this.sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        } else if (this.sortKey === 'level') {
          va = levelOrder[a.level] ?? 0;
          vb = levelOrder[b.level] ?? 0;
          return this.sortDir === 'asc' ? va - vb : vb - va;
        } else {
          va = a[this.sortKey] || 0;
          vb = b[this.sortKey] || 0;
          return this.sortDir === 'asc' ? va - vb : vb - va;
        }
      });

      return list;
    },

    sortBy(key) {
      if (this.sortKey === key) {
        this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortKey = key;
        this.sortDir = key === 'name' ? 'asc' : 'desc';
      }
    },

    exportCSV() {
      const suppliers = this.filteredSuppliers();
      if (suppliers.length === 0) return;

      const headers = ['Nom', 'SIRET', 'Score Global', 'Gouvernance', 'Droits Humains', 'SST', 'Ethique', 'Environnement', 'Achats', 'Niveau', 'Langue', 'Date réponse'];
      const rows = suppliers.map(s => [
        '"' + s.name + '"',
        s.siret,
        s.score_global.toFixed(1),
        s.scores.gouvernance.toFixed(1),
        s.scores.droits_humains.toFixed(1),
        s.scores.sst.toFixed(1),
        s.scores.ethique.toFixed(1),
        s.scores.environnement.toFixed(1),
        s.scores.achats.toFixed(1),
        s.level,
        s.language,
        '"' + (s.responded_at || '') + '"'
      ]);

      const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rse_fournisseurs_' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  };
}

// =====================================================================
// COMPARAISON VIEW COMPONENT
// =====================================================================
function comparaisonView() {
  return {
    selected: [],
    _radarCharts: {},

    getAppData() {
      const appEl = document.querySelector('body[x-data]');
      if (appEl) return Alpine.$data(appEl);
      return null;
    },

    getLevelClass(level) {
      if (level === 'green') return 'badge-green';
      if (level === 'amber') return 'badge-amber';
      return 'badge-red';
    },

    getLevelLabel(level) {
      if (level === 'green') return '🟢 Bon élève';
      if (level === 'amber') return '🟡 En progression';
      return '🔴 Prioritaire';
    },

    getPillarLabel(key) {
      return PILLAR_LABELS[key] || key;
    },

    getAllSuppliers() {
      const appData = this.getAppData();
      if (!appData || !appData.data || !appData.data.suppliers) return [];
      return [...appData.data.suppliers].sort((a, b) => b.score_global - a.score_global);
    },

    isSelected(id) {
      return this.selected.some(s => s.id === id);
    },

    toggleSelect(supplier) {
      if (this.isSelected(supplier.id)) {
        this.selected = this.selected.filter(s => s.id !== supplier.id);
        // Destroy radar for removed supplier
        const chartId = 'comp-radar-' + supplier.id;
        destroyChart(chartId);
        delete this._radarCharts[supplier.id];
      } else if (this.selected.length < 4) {
        this.selected = [...this.selected, supplier];
      }
    },

    drawComparisonRadars() {
      if (this.selected.length < 2) return;

      this.$nextTick(() => {
        this.selected.forEach(s => {
          const canvasId = 'comp-radar-' + s.id;
          destroyChart(canvasId);
          const canvas = document.getElementById(canvasId);
          if (!canvas) return;

          const pillars = Object.keys(s.scores);
          const labels = pillars.map(p => PILLAR_LABELS[p] || p);
          const values = pillars.map(p => s.scores[p]);
          const color = s.level === 'green' ? '#22c55e' : s.level === 'amber' ? '#f59e0b' : '#E63946';

          const cfg = radarDefaults(labels, values, s.name, color);
          cfg.options.scales.r.pointLabels.font = { size: 10 };
          cfg.options.scales.r.ticks.font = { size: 10 };
          new Chart(canvas, cfg);
        });
      });
    }
  };
}

// =====================================================================
// JSONP helper — contourne le blocage CORS de Google Apps Script
// =====================================================================
function _ccJsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = '__ccCb' + Date.now() + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    window[cb] = function(data) {
      delete window[cb];
      if (script.parentNode) script.parentNode.removeChild(script);
      resolve(data);
    };
    script.onerror = function() {
      delete window[cb];
      if (script.parentNode) script.parentNode.removeChild(script);
      reject(new Error('Erreur réseau'));
    };
    const sep = url.includes('?') ? '&' : '?';
    script.src = url + sep + 'callback=' + cb;
    document.head.appendChild(script);
  });
}

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
        const json = await _ccJsonp(CODE_CONDUITE_SCRIPT_URL);
        if (json.error) throw new Error(json.error);
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
        const json = await _ccJsonp(url);
        if (json.error) throw new Error(json.error);
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
        const json = await _ccJsonp(url);
        if (json.error) throw new Error(json.error);
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

// =====================================================================
// POST-RENDER: Reinitialize Lucide icons whenever Alpine updates DOM
// =====================================================================
document.addEventListener('alpine:initialized', () => {
  lucide.createIcons();
});

// Classement open-supplier event bridge
document.addEventListener('open-supplier', (e) => {
  const bodyEl = document.querySelector('body');
  if (bodyEl) {
    const appData = Alpine.$data(bodyEl);
    if (appData && typeof appData.openSupplier === 'function') {
      appData.openSupplier(e.detail.supplier || e.detail, e.detail.list);
    }
  }
});
