"""
Mapping des colonnes des Google Sheets vers les 6 piliers RSE.
Les indices sont 0-based (colonne A = index 0).

Structure commune aux sheets FR et EN :
- Cols 0-8  : Métadonnées (horodateur, email, société, adresse, SIRET, contact...)
- Cols 9+   : Questions RSE

Règles de scoring :
- "Oui" / "Yes" → 1.0 point
- "Non" / "No"  → 0.0 point
- Texte libre non vide → 0.5 point (engagement partiel)
- Vide           → 0.0 point
"""

# Pondération des piliers (doit sommer à 1.0)
PILLAR_WEIGHTS = {
    'gouvernance':    0.20,
    'droits_humains': 0.15,
    'sst':            0.20,
    'ethique':        0.15,
    'environnement':  0.20,
    'achats':         0.10,
}

# Noms d'affichage des piliers
PILLAR_LABELS = {
    'gouvernance':    'Gouvernance RSE',
    'droits_humains': 'Droits Humains',
    'sst':            'Santé & Sécurité',
    'ethique':        'Éthique',
    'environnement':  'Environnement',
    'achats':         'Achats Responsables',
}

# Mapping colonnes → pilier pour le sheet FR (Sheet 3, indices 0-based)
PILLAR_COLUMNS_FR = {
    'gouvernance':    [9, 10, 12, 13, 16, 17, 18],
    'droits_humains': [19, 20],
    'sst':            [25, 26],
    'ethique':        [28, 29],
    'environnement':  [33, 43, 49, 53, 54, 56, 59, 61, 62],
    'achats':         [37, 40],
}

# Mapping colonnes → pilier pour le sheet EN (Sheet 4, indices 0-based)
PILLAR_COLUMNS_EN = {
    'gouvernance':    [9, 10, 12, 13, 16, 17, 18],
    'droits_humains': [19, 20],
    'sst':            [25, 26],
    'ethique':        [28, 29],
    'environnement':  [33, 43, 49, 53, 54, 56, 59, 61, 62],
    'achats':         [37, 40],
}

# Questions clés pour les recommandations (col index → message si réponse faible)
KEY_RECOMMENDATIONS_FR = {
    10: "Initier une démarche de labellisation RSE (EcoVadis, ISO 26000, B Corp...)",
    16: "Publier un rapport RSE ou développement durable annuel (guide GRI disponible)",
    61: "Mesurer les émissions CO2 liées au transport des marchandises (bilan carbone)",
    62: "Mettre en place des actions de réduction de l'empreinte carbone transport",
    43: "Suivre des indicateurs environnementaux de base (énergie, eau, déchets, CO2)",
    49: "Mettre en place un suivi et une réduction des déchets",
    18: "Créer un système de remontée d'alertes pour les parties prenantes",
    40: "Former les collaborateurs aux enjeux RSE (éthique, environnement, social)",
}

KEY_RECOMMENDATIONS_EN = {
    10: "Pursue third-party CSR labelling (EcoVadis, ISO 26000, B Corp...)",
    16: "Publish an annual CSR/sustainability report (GRI guidelines available)",
    61: "Measure CO2 emissions related to goods transport (carbon footprint)",
    62: "Implement actions to reduce transport-related carbon footprint",
    43: "Track basic environmental indicators (energy, water, waste, CO2)",
    49: "Set up waste monitoring and reduction processes",
    18: "Establish a stakeholder concern reporting system",
    40: "Train employees on CSR topics (ethics, environment, social, OHS)",
}

# Indices des colonnes métadonnées (communes FR et EN)
META_COLUMNS = {
    'timestamp':    0,
    'email':        1,
    'name':         2,
    'address':      3,
    'siret':        4,
    'contact_name': 5,
    'contact_role': 6,
    'contact_email':7,
    'rse_contact':  8,
}
