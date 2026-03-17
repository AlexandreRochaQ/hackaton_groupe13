"""
services/ner/app.py
Service NER — extraction d'entités + validation
Stack : FastAPI + spaCy + regex
Auteur : Rôle 7
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import spacy
import re
import logging
from datetime import datetime
from pymongo import MongoClient
import os

log = logging.getLogger(__name__)
app = FastAPI(title="DocuFlow NER Service", version="1.0.0")
nlp = spacy.load("fr_core_news_lg")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB  = os.getenv("MONGO_DB", "docuflow")
client    = MongoClient(MONGO_URI)
db        = client[MONGO_DB]

class ExtractRequest(BaseModel):
    file_id: str
    text: str

class ExtractResponse(BaseModel):
    file_id: str
    siret:           Optional[str] = None
    tva:             Optional[str] = None
    montant_ht:      Optional[float] = None
    montant_tva:     Optional[float] = None
    montant_ttc:     Optional[float] = None
    date_emission:   Optional[str] = None
    date_expiration: Optional[str] = None
    fournisseur:     Optional[str] = None
    doc_type:        Optional[str] = None


PATTERNS = {
    "siret": r"\b\d{3}[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{5}\b",
    "tva":   r"\bFR[\s]?[A-Z0-9]{2}[\s]?\d{9}\b",
    "montant": r"(\d{1,3}(?:[\s\.\,]\d{3})*(?:[,\.]\d{2})?)\s*€",
    "date":  r"\b(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}|\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2})\b",
}

DOC_TYPES = {
    "facture":    ["facture", "invoice", "avoir"],
    "devis":      ["devis", "proposition", "offre"],
    "kbis":       ["kbis", "extrait", "registre du commerce"],
    "urssaf":     ["urssaf", "attestation de vigilance", "vigilance"],
    "siret":      ["avis de situation", "siret", "sirene"],
    "rib":        ["rib", "relevé d'identité bancaire", "iban", "bic"],
}


def parse_montant(raw: str) -> float:
    """Convertit '1 200,50' ou '1.200,50' en float 1200.50"""
    clean = raw.replace(" ", "").replace(".", "").replace(",", ".")
    try:
        return float(clean)
    except ValueError:
        return 0.0


def detect_doc_type(text: str) -> Optional[str]:
    text_lower = text.lower()
    for doc_type, keywords in DOC_TYPES.items():
        if any(kw in text_lower for kw in keywords):
            return doc_type
    return None


@app.post("/extract", response_model=ExtractResponse)
async def extract_entities(req: ExtractRequest):
    text    = req.text
    file_id = req.file_id

    log.info(f"[NER] Extraction pour file_id={file_id} ({len(text)} chars)")

    result = ExtractResponse(file_id=file_id)

    # ── 1. Type de document ──────────────────
    result.doc_type = detect_doc_type(text)

    # ── 2. SIRET ────────────────────────────
    match = re.search(PATTERNS["siret"], text)
    if match:
        result.siret = re.sub(r"[\s\-]", "", match.group())

    # ── 3. TVA ──────────────────────────────
    match = re.search(PATTERNS["tva"], text, re.IGNORECASE)
    if match:
        result.tva = re.sub(r"\s", "", match.group()).upper()

    # ── 4. Montants ─────────────────────────
    montants = re.findall(PATTERNS["montant"], text)
    montants_float = sorted([parse_montant(m) for m in montants])

    text_lower = text.lower()
    # Cherche les labels dans le texte pour associer les montants
    ht_match  = re.search(r"(?:montant\s+)?ht[\s:]+(\d[\d\s,\.]*)\s*€", text_lower)
    tva_match = re.search(r"(?:montant\s+)?tva[\s:]+(\d[\d\s,\.]*)\s*€", text_lower)
    ttc_match = re.search(r"(?:montant\s+)?ttc[\s:]+(\d[\d\s,\.]*)\s*€", text_lower)

    if ht_match:  result.montant_ht  = parse_montant(ht_match.group(1))
    if tva_match: result.montant_tva = parse_montant(tva_match.group(1))
    if ttc_match: result.montant_ttc = parse_montant(ttc_match.group(1))

    # Fallback si pas de labels : plus grand montant = TTC
    if not result.montant_ttc and montants_float:
        result.montant_ttc = montants_float[-1]

    # ── 5. Dates ────────────────────────────
    dates = re.findall(PATTERNS["date"], text)
    if dates:
        result.date_emission = dates[0]
    if len(dates) > 1:
        result.date_expiration = dates[-1]

    # ── 6. Nom fournisseur via spaCy NER ────
    doc = nlp(text[:500])   # on traite les 500 premiers chars
    orgs = [ent.text for ent in doc.ents if ent.label_ == "ORG"]
    if orgs:
        result.fournisseur = orgs[0]

    # ── 7. Stockage en Clean zone MongoDB ───
    db.clean.update_one(
        {"file_id": file_id},
        {"$set": {
            "entities":     result.dict(),
            "extracted_at": datetime.utcnow()
        }},
        upsert=True
    )

    log.info(f"[NER] Entités extraites pour {file_id} : {result.dict()}")
    return result


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ner", "spacy_model": "fr_core_news_lg"}


@app.get("/")
async def root():
    return {"message": "DocuFlow NER Service — POST /extract pour extraire les entités"}