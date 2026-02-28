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

# Mapping colonnes → pilier pour le sheet CN (indices 0-based, utilisation des memes que EN par défaut)
PILLAR_COLUMNS_CN = PILLAR_COLUMNS_EN.copy()

# Questions clés pour les recommandations (col index → message si réponse faible)
KEY_RECOMMENDATIONS_FR = {
    # GOUVERNANCE
    9:  "Initier une démarche RSE structurée : formaliser une politique, des objectifs mesurables et un plan d'action",
    10: "Engager une démarche de certification RSE auprès d'un organisme tiers (EcoVadis, ISO 26000, B Corp, Lucie 26000...)",
    12: "Nommer un référent RSE interne chargé de coordonner et d'animer la démarche",
    16: "Publier un rapport RSE ou développement durable annuel (référentiel GRI disponible)",
    17: "Rédiger et diffuser un code de conduite RSE à l'ensemble des collaborateurs et partenaires",
    18: "Instaurer un dispositif de remontée des préoccupations et alertes éthiques pour les parties prenantes",
    # DROITS HUMAINS
    19: "Élaborer une politique de vigilance sur les droits humains : conditions de travail, non-discrimination, prévention du travail forcé",
    # SST
    25: "Formaliser un Document Unique d'Évaluation des Risques (DUER) et une politique SST",
    26: "Déployer un programme de prévention des risques professionnels (EPI, formations SST, plans d'urgence)",
    # ÉTHIQUE
    28: "Adopter une charte éthique couvrant la lutte anti-corruption, les conflits d'intérêts et la conformité réglementaire (Sapin II)",
    # ENVIRONNEMENT
    33: "Structurer le management environnemental via une certification ISO 14001 ou un système de management environnemental simplifié",
    43: "Suivre des indicateurs environnementaux de base (énergie, eau, déchets, émissions CO2)",
    49: "Mettre en place un plan de suivi et de réduction des déchets à la source",
    53: "Mettre en place un suivi de la consommation énergétique (électricité, gaz, fioul) pour identifier les gisements d'économies",
    54: "Déployer des actions d'efficacité énergétique (LED, isolation, équipements moins énergivores, énergies renouvelables)",
    56: "Mettre en place un comptage de la consommation d'eau et définir des objectifs de réduction",
    59: "Réduire l'empreinte carbone liée au transport (optimisation logistique, véhicules propres, plan de mobilité)",
    61: "Mesurer les émissions de CO2 liées au transport des marchandises (bilan carbone transport)",
    62: "Engager une démarche d'éco-conception pour réduire l'impact environnemental des produits (matériaux recyclés, réduction des emballages, durabilité, ACV)",
    # ACHATS
    37: "Définir des exigences RSE minimales pour vos fournisseurs et les intégrer dans les contrats et processus d'achats",
    40: "Former les collaborateurs aux enjeux RSE (éthique, environnement, social, SST)",
}

KEY_RECOMMENDATIONS_EN = {
    # GOUVERNANCE
    9:  "Initier une démarche RSE structurée : formaliser une politique, des objectifs mesurables et un plan d'action",
    10: "Engager une démarche de certification RSE auprès d'un organisme tiers (EcoVadis, ISO 26000, B Corp...)",
    12: "Nommer un référent RSE interne chargé de coordonner et d'animer la démarche",
    16: "Publier un rapport RSE ou développement durable annuel (référentiel GRI disponible)",
    17: "Rédiger et diffuser un code de conduite RSE à l'ensemble des collaborateurs et partenaires",
    18: "Instaurer un dispositif de remontée des préoccupations et alertes éthiques pour les parties prenantes",
    # DROITS HUMAINS
    19: "Élaborer une politique de vigilance sur les droits humains : conditions de travail, non-discrimination, prévention du travail forcé",
    # SST
    25: "Formaliser un Document Unique d'Évaluation des Risques (DUER) et une politique SST",
    26: "Déployer un programme de prévention des risques professionnels (EPI, formations SST, plans d'urgence)",
    # ÉTHIQUE
    28: "Adopter une charte éthique couvrant la lutte anti-corruption, les conflits d'intérêts et la conformité réglementaire",
    # ENVIRONNEMENT
    33: "Structurer le management environnemental via une certification ISO 14001 ou un système de management environnemental simplifié",
    43: "Suivre des indicateurs environnementaux de base (énergie, eau, déchets, émissions CO2)",
    49: "Mettre en place un plan de suivi et de réduction des déchets à la source",
    53: "Mettre en place un suivi de la consommation énergétique (électricité, gaz, fioul) pour identifier les gisements d'économies",
    54: "Déployer des actions d'efficacité énergétique (LED, isolation, équipements moins énergivores, énergies renouvelables)",
    56: "Mettre en place un comptage de la consommation d'eau et définir des objectifs de réduction",
    59: "Réduire l'empreinte carbone liée au transport (optimisation logistique, véhicules propres, plan de mobilité)",
    61: "Mesurer les émissions de CO2 liées au transport des marchandises (bilan carbone transport)",
    62: "Engager une démarche d'éco-conception pour réduire l'impact environnemental des produits (matériaux recyclés, réduction des emballages, durabilité, ACV)",
    # ACHATS
    37: "Définir des exigences RSE minimales pour vos fournisseurs et les intégrer dans les contrats et processus d'achats",
    40: "Former les collaborateurs aux enjeux RSE (éthique, environnement, social, SST)",
}

KEY_RECOMMENDATIONS_CN = KEY_RECOMMENDATIONS_EN.copy()

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
