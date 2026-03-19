from datetime import date, datetime
from typing import Optional
import logging
import re

log = logging.getLogger(__name__)


def parse_date(date_str: Optional[str]) -> Optional[date]:
    """Parse une date depuis plusieurs formats courants."""
    if not date_str:
        return None
    formats = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    log.warning(f"[VALIDATION] Impossible de parser la date : {date_str}")
    return None


def normalize_siret(siret: Optional[str]) -> Optional[str]:
    """Retire espaces et tirets pour comparer les SIRETs proprement."""
    if not siret:
        return None
    return re.sub(r"[\s\-\.]", "", siret)


def is_valid_siret(siret: Optional[str]) -> bool:
    """Vérifie le format SIRET : 14 chiffres exactement."""
    if not siret:
        return False
    clean = normalize_siret(siret)
    return bool(re.fullmatch(r"\d{14}", clean))


def is_valid_tva(tva: Optional[str]) -> bool:
    """Vérifie le format TVA intracommunautaire français : FR + 2 chars + 9 chiffres."""
    if not tva:
        return False
    return bool(re.fullmatch(r"FR[A-Z0-9]{2}\d{9}", tva.replace(" ", "")))


def validate_documents(entities: dict, autres_docs: dict) -> dict:
    errors   = []
    warnings = []

    today = date.today()

    siret = entities.get("siret")
    if not siret:
        errors.append({
            "type": "SIRET_MISSING",
            "severity": "error",
            "message": "SIRET introuvable dans le document"
        })
    elif not is_valid_siret(siret):
        errors.append({
            "type": "SIRET_INVALID_FORMAT",
            "severity": "error",
            "message": f"SIRET '{siret}' invalide — doit contenir 14 chiffres"
        })

    urssaf = autres_docs.get("attestation_urssaf", {})
    if urssaf and siret and urssaf.get("siret"):
        siret_doc    = normalize_siret(siret)
        siret_urssaf = normalize_siret(urssaf["siret"])

        if siret_doc != siret_urssaf:
            errors.append({
                "type": "SIRET_MISMATCH",
                "severity": "error",
                "message": (
                    f"SIRET incohérent : document={siret_doc} "
                    f"≠ attestation URSSAF={siret_urssaf}"
                )
            })
    tva = entities.get("tva")
    if tva and not is_valid_tva(tva):
        warnings.append({
            "type": "TVA_INVALID_FORMAT",
            "severity": "warning",
            "message": f"Numéro TVA '{tva}' ne respecte pas le format FR standard"
        })

    ht  = entities.get("montant_ht")
    tva_montant = entities.get("montant_tva")
    ttc = entities.get("montant_ttc")

    if ht and tva_montant and ttc:
        ttc_calcule = round(ht + tva_montant, 2)
        if abs(ttc_calcule - ttc) > 0.02:   
            errors.append({
                "type": "MONTANT_INCOHERENT",
                "severity": "error",
                "message": (
                    f"Montants incohérents : HT({ht}) + TVA({tva_montant}) "
                    f"= {ttc_calcule} ≠ TTC déclaré({ttc})"
                )
            })

    if urssaf:
        date_exp_urssaf = parse_date(urssaf.get("date_expiration"))
        if date_exp_urssaf:
            if date_exp_urssaf < today:
                errors.append({
                    "type": "URSSAF_EXPIRED",
                    "severity": "error",
                    "message": f"Attestation URSSAF expirée depuis le {date_exp_urssaf}"
                })
            elif (date_exp_urssaf - today).days <= 30:
                warnings.append({
                    "type": "URSSAF_EXPIRING_SOON",
                    "severity": "warning",
                    "message": (
                        f"Attestation URSSAF expire dans "
                        f"{(date_exp_urssaf - today).days} jours ({date_exp_urssaf})"
                    )
                })

    kbis = autres_docs.get("kbis", {})
    if kbis:
        date_exp_kbis = parse_date(kbis.get("date_expiration"))
        if date_exp_kbis:
            if date_exp_kbis < today:
                errors.append({
                    "type": "KBIS_EXPIRED",
                    "severity": "error",
                    "message": f"Extrait Kbis expiré depuis le {date_exp_kbis}"
                })
            elif (date_exp_kbis - today).days <= 30:
                warnings.append({
                    "type": "KBIS_EXPIRING_SOON",
                    "severity": "warning",
                    "message": (
                        f"Extrait Kbis expire dans "
                        f"{(date_exp_kbis - today).days} jours ({date_exp_kbis})"
                    )
                })

    date_emission = parse_date(entities.get("date_emission"))
    if date_emission and date_emission > today:
        warnings.append({
            "type": "DATE_EMISSION_FUTURE",
            "severity": "warning",
            "message": f"Date d'émission ({date_emission}) est dans le futur"
        })

    score = 100
    score -= len(errors)   * 20
    score -= len(warnings) * 5
    score = max(0, score)

    result = {
        "valid":    len(errors) == 0,
        "errors":   errors,
        "warnings": warnings,
        "score":    score,
        "summary": (
            f"{len(errors)} erreur(s), {len(warnings)} avertissement(s) "
            f"— score confiance : {score}/100"
        )
    }

    log.info(f"[VALIDATION] {result['summary']}")
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    print("\n" + "="*50)
    print("TEST 1 : Document valide")
    print("="*50)
    result = validate_documents(
        entities={
            "siret":        "12345678901234",
            "tva":          "FR12345678901",
            "montant_ht":   1000.00,
            "montant_tva":  200.00,
            "montant_ttc":  1200.00,
            "date_emission": "2024-01-15",
        },
        autres_docs={
            "attestation_urssaf": {
                "siret": "12345678901234",
                "date_expiration": "2026-12-31"
            },
            "kbis": {
                "date_expiration": "2026-06-01"
            }
        }
    )
    print(f"Valide : {result['valid']} | Score : {result['score']}/100")
    print(f"Erreurs : {result['errors']}")
    print(f"Warnings : {result['warnings']}")

    print("\n" + "="*50)
    print("TEST 2 : SIRET incohérent + URSSAF expirée")
    print("="*50)
    result2 = validate_documents(
        entities={
            "siret":        "12345678901234",
            "tva":          "FR12345678901",
            "montant_ht":   1000.00,
            "montant_tva":  200.00,
            "montant_ttc":  1500.00,  
            "date_emission": "2024-01-15",
        },
        autres_docs={
            "attestation_urssaf": {
                "siret": "99999999999999",   
                "date_expiration": "2022-01-01"  
            },
            "kbis": {
                "date_expiration": "2026-06-01"
            }
        }
    )
    print(f"Valide : {result2['valid']} | Score : {result2['score']}/100")
    for err in result2['errors']:
        print(f"  ❌ [{err['type']}] {err['message']}")
    for w in result2['warnings']:
        print(f"  ⚠️  [{w['type']}] {w['message']}")