#!/usr/bin/env python3
"""
Script principal de mise à jour du dashboard RSE.
Usage: python scripts/update_data.py
"""

import json
import os
import subprocess
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from fetch_sheets import fetch_all_sheets
from scorer import score_supplier, compute_collective_stats

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'data.json')


def build_data_json(sheets_data: dict) -> dict:
    """Construit le dictionnaire complet pour data.json."""
    all_suppliers = []
    for lang, sheet_rows in sheets_data.items():
        if len(sheet_rows) <= 1:
            print(f"  Aucune donnée pour {lang.upper()}, skip.")
            continue
        data_rows = sheet_rows[1:]
        print(f"  Calcul scores pour {len(data_rows)} fournisseurs {lang.upper()}...")
        for row in data_rows:
            if not row or not row[2].strip():
                continue
            supplier = score_supplier(row, language=lang)
            all_suppliers.append(supplier)
    all_suppliers.sort(key=lambda s: s['score_global'], reverse=True)
    collective = compute_collective_stats(all_suppliers)
    return {
        'meta': {
            'last_updated': datetime.now().isoformat(),
            'total_responded': len(all_suppliers),
            'count_fr': sum(1 for s in all_suppliers if s['language'] == 'fr'),
            'count_en': sum(1 for s in all_suppliers if s['language'] == 'en'),
        },
        'collective': collective,
        'suppliers': all_suppliers,
    }


def save_json(data: dict, path: str) -> None:
    """Sauvegarde data.json."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    size_kb = os.path.getsize(path) / 1024
    print(f"  Sauvegardé : {path} ({size_kb:.1f} KB)")


def git_commit_push(message: str) -> None:
    """Commit et push les changements sur GitHub."""
    repo_root = os.path.join(os.path.dirname(__file__), '..')
    cmds = [
        ['git', 'add', 'public/data.json'],
        ['git', 'commit', '-m', message],
        ['git', 'push'],
    ]
    for cmd in cmds:
        result = subprocess.run(cmd, cwd=repo_root, capture_output=True, text=True)
        if result.returncode != 0:
            if 'nothing to commit' in result.stdout + result.stderr:
                print("  Aucun changement à committer.")
                return
            print(f"  Info git: {result.stderr or result.stdout}")
            return
    print("  Push GitHub OK → dashboard mis à jour dans ~2 minutes")


def main():
    print("=" * 50)
    print("Dashboard RSE — Mise à jour des données")
    print("=" * 50)
    print("\n[1/4] Lecture des Google Sheets...")
    sheets_data = fetch_all_sheets()
    print("\n[2/4] Calcul des scores RSE...")
    data = build_data_json(sheets_data)
    total = data['meta']['total_responded']
    avg = data['collective'].get('avg_score', 0)
    print(f"  {total} fournisseurs traités, score moyen : {avg}%")
    print("\n[3/4] Génération de data.json...")
    save_json(data, OUTPUT_PATH)
    print("\n[4/4] Commit & Push GitHub...")
    now = datetime.now().strftime('%Y-%m-%d %H:%M')
    git_commit_push(f"data: update RSE scores {now} ({total} suppliers)")
    print(f"\n✅ Terminé !")
    print(f"   Score moyen global : {avg}%")
    c = data['collective']
    print(f"   🟢 {c.get('count_green',0)} bons élèves")
    print(f"   🟡 {c.get('count_amber',0)} en progression")
    print(f"   🔴 {c.get('count_red',0)} prioritaires")


if __name__ == '__main__':
    main()
