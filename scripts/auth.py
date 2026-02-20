"""Authentification OAuth2 Google pour Google Sheets API."""

import os
import json
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
TOKEN_PATH = os.path.join(os.path.dirname(__file__), 'token.json')

# Chemin vers le fichier client_secret (hors repo, à adapter)
CLIENT_SECRET_PATH = os.path.expanduser(
    '~/Documents/client_secret_rse_dashboard.json'
)


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
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_PATH, SCOPES)
            creds = flow.run_local_server(port=8080)

        # Sauvegarder le token pour la prochaine fois
        with open(TOKEN_PATH, 'w') as token_file:
            token_file.write(creds.to_json())

    return creds
