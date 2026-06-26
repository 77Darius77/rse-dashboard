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
