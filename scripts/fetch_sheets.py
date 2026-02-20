"""Lecture des Google Sheets via l'API et extraction des données brutes."""

import gspread
from auth import get_credentials

SHEET_IDS = {
    'fr': '1Ds0deb4YfVSFjEEKSevwC-OdU_V-dAzaOGEFtzejlfk',
    'en': '1hZidS721UzcFBFIRi6nwJiqX92QGc3tzvXHGqIZwXns',
}

TAB_NAME = 'Réponses au formulaire 1'


def fetch_sheet_data(sheet_id: str, tab_name: str = TAB_NAME) -> list:
    """Lit toutes les données d'un onglet Google Sheets."""
    creds = get_credentials()
    gc = gspread.authorize(creds)
    sheet = gc.open_by_key(sheet_id)
    worksheet = sheet.worksheet(tab_name)
    all_values = worksheet.get_all_values()
    if len(all_values) <= 1:
        return all_values
    headers = all_values[0]
    data_rows = [row for row in all_values[1:] if any(cell.strip() for cell in row)]
    return [headers] + data_rows


def fetch_all_sheets() -> dict:
    """Lit les deux sheets actifs (FR et EN)."""
    result = {}
    for lang, sheet_id in SHEET_IDS.items():
        print(f"  Lecture Sheet {lang.upper()} ({sheet_id[:20]}...)...")
        data = fetch_sheet_data(sheet_id)
        nb_responses = max(0, len(data) - 1)
        print(f"  → {nb_responses} réponses trouvées")
        result[lang] = data
    return result
