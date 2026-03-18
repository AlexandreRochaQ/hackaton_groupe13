import re
import spacy
from datetime import datetime
from app.patterns import (
    SIRET_PATTERN, SIREN_PATTERN, TVA_PATTERN,
    AMOUNT_HT_PATTERN, AMOUNT_TTC_PATTERN, AMOUNT_GENERIC_PATTERN,
    DATE_EMISSION_PATTERN, DATE_EXPIRATION_PATTERN, DATE_PATTERN,
    INVOICE_NUMBER_PATTERN, DOCUMENT_TYPE_KEYWORDS
)

# Chargement du modèle spaCy français
try:
    nlp = spacy.load("fr_core_news_sm")
except OSError:
    nlp = None
    print("Warning: modèle spaCy fr_core_news_sm non trouvé. Lancer: python -m spacy download fr_core_news_sm")


def clean_amount(raw: str) -> float | None:
    """Nettoie une chaîne de montant et retourne un float."""
    try:
        cleaned = raw.strip().replace(" ", "").replace("\xa0", "")
        cleaned = cleaned.replace(",", ".")
        return float(cleaned)
    except (ValueError, AttributeError):
        return None


def detect_document_type(text: str) -> str | None:
    """Détecte le type de document par mots-clés."""
    text_lower = text.lower()
    for doc_type, keywords in DOCUMENT_TYPE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                return doc_type
    return None


def extract_company_name(text: str) -> str | None:
    """Utilise spaCy pour détecter la raison sociale (entité ORG)."""
    if nlp is None:
        return None
    doc = nlp(text[:1000])  # on limite à 1000 chars pour la perf
    for ent in doc.ents:
        if ent.label_ == "ORG":
            return ent.text.strip()
    return None


def normalize_date(date_str: str) -> str | None:
    """Normalise une date en format YYYY-MM-DD."""
    formats = ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%Y/%m/%d"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return date_str


def detect_anomalies(result: dict) -> list[str]:
    """Détecte les anomalies dans les données extraites."""
    anomalies = []

    # SIRET manquant
    if not result.get("siret"):
        anomalies.append("SIRET manquant")

    # Date d'expiration dépassée
    if result.get("expiration_date"):
        try:
            exp = datetime.strptime(result["expiration_date"], "%Y-%m-%d")
            if exp < datetime.now():
                anomalies.append(f"Document expiré depuis le {result['expiration_date']}")
        except ValueError:
            pass

    # Montant TTC inférieur au montant HT
    if result.get("amount_ht") and result.get("amount_ttc"):
        if result["amount_ttc"] < result["amount_ht"]:
            anomalies.append("Montant TTC inférieur au montant HT — incohérence détectée")

    # TVA manquante sur une facture
    if result.get("document_type") == "facture" and not result.get("vat"):
        anomalies.append("Numéro TVA manquant sur une facture")

    return anomalies


def extract(document_id: str, text: str) -> dict:
    """Fonction principale : prend le texte OCR et retourne un dict structuré."""
    result = {"document_id": document_id}

    # Type de document
    result["document_type"] = detect_document_type(text)

    # Raison sociale via spaCy
    result["company_name"] = extract_company_name(text)

    # SIRET
    siret_match = SIRET_PATTERN.search(text)
    result["siret"] = siret_match.group(1) if siret_match else None

    # SIREN (uniquement si pas de SIRET)
    if not result["siret"]:
        siren_match = SIREN_PATTERN.search(text)
        result["siren"] = siren_match.group(1) if siren_match else None
    else:
        result["siren"] = result["siret"][:9]

    # TVA
    tva_match = TVA_PATTERN.search(text)
    result["vat"] = tva_match.group(0).replace(" ", "").upper() if tva_match else None

    # Numéro de facture
    inv_match = INVOICE_NUMBER_PATTERN.search(text)
    result["invoice_number"] = inv_match.group(1).strip() if inv_match else None

    # Montant HT
    ht_match = AMOUNT_HT_PATTERN.search(text)
    result["amount_ht"] = clean_amount(ht_match.group(1)) if ht_match else None

    # Montant TTC
    ttc_match = AMOUNT_TTC_PATTERN.search(text)
    result["amount_ttc"] = clean_amount(ttc_match.group(1)) if ttc_match else None

    # Fallback montant générique si aucun trouvé
    if not result["amount_ht"] and not result["amount_ttc"]:
        amounts = AMOUNT_GENERIC_PATTERN.findall(text)
        if amounts:
            result["amount_ttc"] = clean_amount(amounts[-1])

    # Date d'émission
    emission_match = DATE_EMISSION_PATTERN.search(text)
    if emission_match:
        result["issue_date"] = normalize_date(emission_match.group(1))
    else:
        date_match = DATE_PATTERN.search(text)
        result["issue_date"] = normalize_date(date_match.group(1)) if date_match else None

    # Date d'expiration
    exp_match = DATE_EXPIRATION_PATTERN.search(text)
    result["expiration_date"] = normalize_date(exp_match.group(1)) if exp_match else None

    # Score de confiance simple
    filled = sum(1 for v in result.values() if v is not None and v != document_id)
    total = 10
    result["confidence"] = round(filled / total, 2)

    # Détection anomalies
    result["anomalies"] = detect_anomalies(result)

    return result