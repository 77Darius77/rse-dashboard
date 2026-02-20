"""Moteur de calcul des scores RSE par pilier et global."""

from pillar_mapping import PILLAR_WEIGHTS, PILLAR_COLUMNS_FR, PILLAR_COLUMNS_EN
from pillar_mapping import KEY_RECOMMENDATIONS_FR, KEY_RECOMMENDATIONS_EN, META_COLUMNS


def score_answer(value) -> float:
    """Convertit une réponse brute en score numérique 0.0 à 1.0."""
    if not value or not str(value).strip():
        return 0.0
    v = str(value).strip().lower()
    if v in ('oui', 'yes'):
        return 1.0
    if v in ('non', 'no'):
        return 0.0
    return 0.5


def score_pillar(row: list, col_indices: list) -> float:
    """Calcule le score d'un pilier (0-100) pour une ligne de données."""
    if not col_indices:
        return 0.0
    total = sum(score_answer(row[i] if i < len(row) else None) for i in col_indices)
    return round((total / len(col_indices)) * 100, 1)


def get_level(score: float) -> str:
    """Retourne le niveau traffic light selon le score."""
    if score >= 67:
        return 'green'
    if score >= 34:
        return 'amber'
    return 'red'


def score_supplier(row: list, language: str = 'fr') -> dict:
    """Calcule tous les scores et métadonnées pour un fournisseur."""
    pillar_cols = PILLAR_COLUMNS_FR if language == 'fr' else PILLAR_COLUMNS_EN
    reco_map = KEY_RECOMMENDATIONS_FR if language == 'fr' else KEY_RECOMMENDATIONS_EN

    pillar_scores = {
        pillar: score_pillar(row, cols)
        for pillar, cols in pillar_cols.items()
    }

    global_score = round(sum(
        pillar_scores[p] * w for p, w in PILLAR_WEIGHTS.items()
    ), 1)

    level = get_level(global_score)
    strengths = [p for p, s in pillar_scores.items() if s >= 80]
    weaknesses = [p for p, s in pillar_scores.items() if s < 50]

    recommendations = []
    for col_idx, message in reco_map.items():
        if col_idx < len(row) and score_answer(row[col_idx]) < 0.5:
            recommendations.append(message)

    def get_meta(key):
        idx = META_COLUMNS.get(key, -1)
        return row[idx].strip() if idx >= 0 and idx < len(row) and row[idx] else ''

    name = get_meta('name')
    supplier_id = name.lower().replace(' ', '-').replace('/', '-')[:50]

    return {
        'id': supplier_id,
        'name': name,
        'email': get_meta('email'),
        'siret': get_meta('siret'),
        'address': get_meta('address'),
        'contact_name': get_meta('contact_name'),
        'contact_role': get_meta('contact_role'),
        'contact_email': get_meta('contact_email'),
        'rse_contact': get_meta('rse_contact'),
        'responded_at': get_meta('timestamp'),
        'language': language,
        'score_global': global_score,
        'level': level,
        'scores': pillar_scores,
        'strengths': strengths,
        'weaknesses': weaknesses,
        'recommendations': recommendations[:5],
    }


def compute_collective_stats(suppliers: list) -> dict:
    """Calcule les statistiques agrégées de tous les fournisseurs."""
    if not suppliers:
        return {}

    scores_by_pillar = {p: [] for p in PILLAR_WEIGHTS.keys()}
    all_scores = []

    for s in suppliers:
        all_scores.append(s['score_global'])
        for pillar, score in s['scores'].items():
            scores_by_pillar[pillar].append(score)

    avg_by_pillar = {
        p: round(sum(scores) / len(scores), 1) if scores else 0
        for p, scores in scores_by_pillar.items()
    }

    levels = [s['level'] for s in suppliers]

    return {
        'avg_score': round(sum(all_scores) / len(all_scores), 1) if all_scores else 0,
        'by_pillar': avg_by_pillar,
        'count_green': levels.count('green'),
        'count_amber': levels.count('amber'),
        'count_red': levels.count('red'),
        'top_pillar': max(avg_by_pillar, key=avg_by_pillar.get),
        'weak_pillar': min(avg_by_pillar, key=avg_by_pillar.get),
    }
