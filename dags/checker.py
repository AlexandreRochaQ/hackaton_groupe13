def validate_documents(facture, attestation_urssaf, kbis):
    errors = []
    today = date.today()

    # Règle 1 : SIRET cohérent
    if facture.get("siret") and attestation_urssaf.get("siret"):
        if normalize_siret(facture["siret"]) != normalize_siret(attestation_urssaf["siret"]):
            errors.append({
                "type": "SIRET_MISMATCH",
                "message": f"SIRET facture {facture['siret']} != attestation {attestation_urssaf['siret']}"
            })

    # Règle 2 : Kbis expiré
    date_kbis = parse_date(kbis.get("date_expiration"))
    if date_kbis and date_kbis < today:
        errors.append({
            "type": "KBIS_EXPIRED",
            "message": f"Kbis expiré depuis le {date_kbis}"
        })

    # Règle 3 : URSSAF expirée
    date_urssaf = parse_date(attestation_urssaf.get("date_expiration"))
    if date_urssaf and date_urssaf < today:
        errors.append({
            "type": "URSSAF_EXPIRED",
            "message": "Attestation de vigilance expirée"
        })

    return {"valid": len(errors) == 0, "errors": errors}