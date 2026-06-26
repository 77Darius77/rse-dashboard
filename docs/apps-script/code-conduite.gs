// Dashboard RSE LACME — Code de Conduite Fournisseurs
// Déployer comme Web App : Extensions → Apps Script → Déployer → Nouveau déploiement
// Type : Web App | Exécuter en tant que : Moi | Accès : Tout le monde (Anyone)

const SHEET_ID   = '1snLQRLAaoJGs7tPbm4Hlae9Qq3uENRy2k6pVNQSdKcg';
const SHEET_NAME = 'Fournisseurs';

// Retourne la réponse en JSON ou JSONP selon la présence du paramètre callback
function respond_(params, payload) {
  const json = JSON.stringify(payload);
  if (params.callback) {
    return ContentService
      .createTextOutput(params.callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};

  // Opération d'écriture via GET (évite le preflight CORS des requêtes POST)
  if (params.action === 'update') {
    const row   = parseInt(params.row);
    const field = params.field;   // 'code_conduite' ou 'commentaire'
    const value = params.value !== undefined ? params.value : '';

    if (!row || row < 2) {
      return respond_(params, { error: 'Numéro de ligne invalide' });
    }

    if (!['code_conduite', 'commentaire'].includes(field)) {
      return respond_(params, { error: 'Champ invalide' });
    }
    // code_conduite = colonne D (4), commentaire = colonne F (6)
    const col = field === 'commentaire' ? 6 : 4;

    try {
      const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
      if (!sheet) throw new Error('Onglet introuvable : ' + SHEET_NAME);
      sheet.getRange(row, col).setValue(value);
    } catch (err) {
      return respond_(params, { error: err.message });
    }

    return respond_(params, { ok: true });
  }

  // Lecture par défaut : retourne toutes les lignes non vides
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Onglet introuvable : ' + SHEET_NAME);
    const rows  = sheet.getDataRange().getValues();
    const data  = rows.slice(1)
      .filter(row => row[0] && row[0].toString().trim())
      .map((row, i) => ({
        row:           i + 2,          // numéro de ligne Google Sheets (1-indexé, ligne 1 = en-tête)
        fournisseur:   row[0] || '',
        contact:       row[1] || '',
        email:         row[2] || '',
        code_conduite: row[3] || '',  // 'ok' | '' | '?'
        questionnaire: row[4] || '',
        commentaire:   row[5] || ''
      }));
    return respond_(params, { data });
  } catch (err) {
    return respond_(params, { error: err.message });
  }
}
