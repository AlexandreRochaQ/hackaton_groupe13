def validate_documents(facture, attestation_urssaf, kbis):
    errors = []

    # Règle 1 : SIRET cohérent
    if facture["siret"] != attestation_urssaf["siret"]:
        errors.append({
            "type": "SIRET_MISMATCH",
            "message": f"SIRET facture {facture['siret']} ≠ attestation {attestation_urssaf['siret']}"
        })

    # Règle 2 : date expiration Kbis
    from datetime import date
    if kbis["date_expiration"] < date.today():
        errors.append({
            "type": "KBIS_EXPIRED",
            "message": f"Kbis expiré depuis {kbis['date_expiration']}"
        })

    # Règle 3 : attestation URSSAF expirée
    if attestation_urssaf["date_expiration"] < date.today():
        errors.append({
            "type": "URSSAF_EXPIRED",
            "message": "Attestation de vigilance expirée"
        })

    return {"valid": len(errors) == 0, "errors": errors}