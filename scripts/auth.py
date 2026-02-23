"""Authentification OAuth2 Google pour Google Sheets API."""

import os
import json
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
TOKEN_PATH = os.path.join(os.path.dirname(__file__), 'token.json')

# Chemin par défaut vers le fichier client_secret (hors repo, à adapter)
DEFAULT_CLIENT_SECRET_PATH = os.path.expanduser('~/Documents/client_secret_rse_dashboard.json')

# Fichier local (gitignored) pour mémoriser le dernier chemin entré
LAST_SECRET_PATH_FILE = os.path.join(os.path.dirname(__file__), '.last_secret_path')

def get_client_secret_path():
    """Détermine le chemin du client_secret : fichier mémorisé, défaut, ou via invite."""
    path = DEFAULT_CLIENT_SECRET_PATH

    # Si on l'a mémorisé lors d'une précédente exécution
    if os.path.exists(LAST_SECRET_PATH_FILE):
        with open(LAST_SECRET_PATH_FILE, 'r', encoding='utf-8') as f:
            saved_path = f.read().strip()
            if os.path.exists(saved_path):
                return saved_path

    # S'il existe au chemin par défaut
    if os.path.exists(DEFAULT_CLIENT_SECRET_PATH):
        return DEFAULT_CLIENT_SECRET_PATH

    # Sinon, on demande à l'utilisateur
    while not os.path.exists(path):
        print(f"\n[⚠️] Fichier '{os.path.basename(DEFAULT_CLIENT_SECRET_PATH)}' introuvable.")
        print("Veuillez fournir un chemin valide (ex: C:\\Lacme\\Documents\\client_secret_rse_dashboard.json)")
        path = input("Chemin du fichier d'authentification : ").strip()
        
        # Gestion des guillemets pour les copier-coller sous Windows
        if path.startswith('"') and path.endswith('"'):
            path = path[1:-1]
        if path.startswith("'") and path.endswith("'"):
            path = path[1:-1]

    # Sauvegarder pour les prochaines fois
    with open(LAST_SECRET_PATH_FILE, 'w', encoding='utf-8') as f:
        f.write(path)
        
    return path


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
            client_secret_path = get_client_secret_path()
            flow = InstalledAppFlow.from_client_secrets_file(client_secret_path, SCOPES)
            creds = flow.run_local_server(port=8080)

        # Sauvegarder le token pour la prochaine fois
        with open(TOKEN_PATH, 'w') as token_file:
            token_file.write(creds.to_json())

    return creds
