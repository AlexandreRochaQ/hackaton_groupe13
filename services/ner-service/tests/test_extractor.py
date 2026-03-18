import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.extractor import extract


# Texte simulant une facture OCR
FAKE_FACTURE = """
FACTURE N° F2026-042

Entreprise : ABC SARL
SIRET : 55210055400013
TVA : FR12345678901

Date d'émission : 15/03/2026

Montant HT : 1 200,00 €
Montant TTC : 1 440,00 €
"""

# Texte simulant une attestation URSSAF expirée
FAKE_ATTESTATION_EXPIREE = """
Attestation de vigilance URSSAF

Entreprise : XYZ SAS
SIRET : 73282932000074

Date d'expiration : 01/01/2024
"""

# Texte simulant un devis
FAKE_DEVIS = """
DEVIS N° D2026-007

Client : DEF EURL
SIRET : 41816609600069

Date : 10/03/2026
Montant HT : 800,00 €
Montant TTC : 960,00 €
"""

# Texte avec incohérence TTC < HT
FAKE_INCOHERENCE = """
FACTURE N° F2026-099

SIRET : 55210055400013
TVA : FR12345678901

Montant HT : 2 000,00 €
Montant TTC : 500,00 €
"""


def test_extraction_facture():
    result = extract("doc_001", FAKE_FACTURE)
    assert result["document_type"] == "facture"
    assert result["siret"] == "55210055400013"
    assert result["vat"] is not None
    assert result["amount_ht"] == 1200.0
    assert result["amount_ttc"] == 1440.0
    assert result["issue_date"] == "2026-03-15"
    assert result["invoice_number"] is not None
    print("✅ test_extraction_facture OK")


def test_attestation_expiree():
    result = extract("doc_002", FAKE_ATTESTATION_EXPIREE)
    assert result["siret"] == "73282932000074"
    assert result["expiration_date"] == "2024-01-01"
    assert any("expiré" in a for a in result["anomalies"])
    print("✅ test_attestation_expiree OK")


def test_extraction_devis():
    result = extract("doc_003", FAKE_DEVIS)
    assert result["document_type"] == "devis"
    assert result["siret"] == "41816609600069"
    assert result["amount_ht"] == 800.0
    print("✅ test_extraction_devis OK")


def test_incoherence_montants():
    result = extract("doc_004", FAKE_INCOHERENCE)
    assert any("TTC" in a for a in result["anomalies"])
    print("✅ test_incoherence_montants OK")


def test_siret_manquant():
    result = extract("doc_005", "Facture sans numéro SIRET ni information.")
    assert any("SIRET" in a for a in result["anomalies"])
    print("✅ test_siret_manquant OK")


if __name__ == "__main__":
    test_extraction_facture()
    test_attestation_expiree()
    test_extraction_devis()
    test_incoherence_montants()
    test_siret_manquant()
    print("\n✅ Tous les tests passés !")