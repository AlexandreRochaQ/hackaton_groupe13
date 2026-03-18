function parseDate(value) {
  if (!value) return null
  const parts = value.split('/')
  if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0])
  return new Date(value)
}

export function validateExtractions(extractions) {
  const byType = {}
  extractions.forEach(e => { byType[e.type] = e.fields })

  const inconsistencies = []

  const docsWithSiret = extractions.filter(e => e.fields.siret?.value)
  if (docsWithSiret.length > 1) {
    const unique = [...new Set(docsWithSiret.map(e => e.fields.siret.value))]
    if (unique.length > 1) {
      const values = {}
      docsWithSiret.forEach(e => { values[e.typeLabel] = e.fields.siret.value })
      inconsistencies.push({
        id: 'inc-siret',
        severity: 'critique',
        code: 'SIRET_MISMATCH',
        title: 'SIRET incohérent entre documents',
        description: "Les numéros SIRET présents sur les documents ne correspondent pas. Ces documents ne peuvent pas appartenir au même fournisseur.",
        affectedDocuments: docsWithSiret.map(e => e.typeLabel),
        values,
      })
    } else {
      const values = {}
      docsWithSiret.forEach(e => { values[e.typeLabel] = e.fields.siret.value })
      inconsistencies.push({
        id: 'val-siret',
        severity: 'ok',
        code: 'SIRET_VALIDATED',
        title: 'SIRET cohérent entre documents',
        description: `Le SIRET (${unique[0]}) est identique sur tous les documents fournis.`,
        affectedDocuments: docsWithSiret.map(e => e.typeLabel),
        values,
      })
    }
  }

  const urssaf = byType.urssaf
  if (urssaf?.dateExpiration?.value) {
    const expDate = parseDate(urssaf.dateExpiration.value)
    if (expDate && expDate < new Date()) {
      inconsistencies.push({
        id: 'inc-urssaf',
        severity: 'critique',
        code: 'ATTESTATION_EXPIRÉE',
        title: 'Attestation URSSAF expirée',
        description: `L'attestation de vigilance URSSAF a expiré le ${urssaf.dateExpiration.value}. Un renouvellement est obligatoire avant tout règlement.`,
        affectedDocuments: ['Attestation de vigilance URSSAF'],
        values: { "Date d'expiration": urssaf.dateExpiration.value },
      })
    }
  }

  const kbis = byType.kbis
  if (kbis?.dateExpiration?.value) {
    const expDate = parseDate(kbis.dateExpiration.value)
    if (expDate && expDate < new Date()) {
      inconsistencies.push({
        id: 'inc-kbis',
        severity: 'critique',
        code: 'KBIS_EXPIRED',
        title: 'Extrait Kbis expiré',
        description: `L'extrait Kbis a expiré le ${kbis.dateExpiration.value}.`,
        affectedDocuments: ['Extrait Kbis'],
        values: { "Date d'expiration": kbis.dateExpiration.value },
      })
    }
  }

  return {
    summary: {
      total: extractions.length,
      critiques: inconsistencies.filter(i => i.severity === 'critique').length,
      avertissements: inconsistencies.filter(i => i.severity === 'avertissement').length,
      validations: inconsistencies.filter(i => i.severity === 'ok').length,
      isCompliant: inconsistencies.filter(i => i.severity === 'critique').length === 0,
    },
    inconsistencies,
  }
}
