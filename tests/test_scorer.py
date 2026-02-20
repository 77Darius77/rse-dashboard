"""Tests pour le moteur de scoring RSE."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from scorer import score_answer, score_pillar, score_supplier, get_level


def test_score_answer_oui():
    assert score_answer("Oui") == 1.0

def test_score_answer_yes():
    assert score_answer("Yes") == 1.0

def test_score_answer_non():
    assert score_answer("Non") == 0.0

def test_score_answer_no():
    assert score_answer("No") == 0.0

def test_score_answer_text():
    assert score_answer("Nous utilisons des panneaux solaires") == 0.5

def test_score_answer_empty():
    assert score_answer("") == 0.0

def test_score_answer_none():
    assert score_answer(None) == 0.0

def test_score_pillar_all_oui():
    row = [""] * 70
    row[9] = "Oui"
    row[10] = "Oui"
    score = score_pillar(row, [9, 10])
    assert score == 100.0

def test_score_pillar_mixed():
    row = [""] * 70
    row[9] = "Oui"
    row[10] = "Non"
    score = score_pillar(row, [9, 10])
    assert score == 50.0

def test_score_pillar_empty_cols():
    row = [""] * 70
    score = score_pillar(row, [9, 10])
    assert score == 0.0

def test_get_level_green():
    assert get_level(80) == "green"

def test_get_level_amber():
    assert get_level(50) == "amber"

def test_get_level_red():
    assert get_level(20) == "red"

def test_get_level_boundary_green():
    assert get_level(67) == "green"

def test_get_level_boundary_red():
    assert get_level(33) == "red"
