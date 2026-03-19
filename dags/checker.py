from datetime import date, datetime
from typing import Optional
import re

def parse_date(date_str):
    if not date_str:
        return None
    formats = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None

def normalize_siret(siret):
    if not siret:
        return None
    return re.sub(r"[\s\-\.]", "", siret)

def validate_documents(facture, attestation_urssaf, kbis):
    errors = []
    today = date.today()

    if facture.get("siret") and attestation_urssaf.get("siret"):
        if normalize_siret(facture["siret"]) != normalize_siret(attestation_urssaf["siret"]):
            errors.append({"type": "SIRET_MISMATCH", "message": "SIRET incohérent"})

    date_kbis = parse_date(kbis.get("date_expiration"))
    if date_kbis and date_kbis < today:
        errors.append({"type": "KBIS_EXPIRED", "message": f"Kbis expiré depuis {date_kbis}"})

    date_urssaf = parse_date(attestation_urssaf.get("date_expiration"))
    if date_urssaf and date_urssaf < today:
        errors.append({"type": "URSSAF_EXPIRED", "message": "Attestation URSSAF expirée"})

    return {"valid": len(errors) == 0, "errors": errors}
