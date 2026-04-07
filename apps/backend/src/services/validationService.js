function parseDate(value) {
  if (!value) return null
  const parts = value.split('/')
  if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0])
  return new Date(value)
}

/**
 * Validate extractions with optional SIRENE enrichment.
 * @param {Array} extractions — result of nerToExtraction()
 * @param {object|null} sireneData — result of sireneService.lookupSiret(), or null
 */
export function validateExtractions(extractions, sireneData = null) {
  const byType = {}
  extractions.forEach(e => { byType[e.type] = e.fields })

  const inconsistencies = []

  // ── Inter-document SIRET coherence ──
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

  // ── URSSAF expiry ──
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

  // ── Kbis expiry ──
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

  // ── SIRENE-based checks ──
  if (sireneData !== null) {
    if (!sireneData.found) {
      // SIRET submitted but not found in SIRENE
      inconsistencies.push({
        id: 'inc-sirene-not-found',
        severity: 'critique',
        code: 'SIRENE_NOT_FOUND',
        title: 'SIRET non reconnu par SIRENE',
        description: `Le numéro SIRET ${sireneData.siret} est introuvable dans la base SIRENE des entreprises (data.gouv.fr). Ce numéro est invalide ou n'existe pas.`,
        affectedDocuments: docsWithSiret.map(e => e.typeLabel),
        values: { SIRET: sireneData.siret },
      })
    } else {
      // SIRET found — check company status
      if (!sireneData.isActive) {
        inconsistencies.push({
          id: 'inc-sirene-closed',
          severity: 'critique',
          code: 'ENTREPRISE_FERMÉE',
          title: 'Entreprise fermée selon SIRENE',
          description: `Selon la base SIRENE officielle, l'établissement lié au SIRET ${sireneData.siret} est fermé (état administratif : ${sireneData.etatAdministratif}). Tout engagement financier est risqué.`,
          affectedDocuments: docsWithSiret.map(e => e.typeLabel),
          values: {
            SIRET: sireneData.siret,
            'Raison sociale': sireneData.raisonSociale,
            'État': sireneData.etatAdministratif,
          },
        })
      } else {
        // Active — confirm with SIRENE badge
        inconsistencies.push({
          id: 'val-sirene-active',
          severity: 'ok',
          code: 'SIRENE_ACTIVE',
          title: 'Entreprise active — validé par SIRENE',
          description: `Le SIRET ${sireneData.siret} correspond à une entreprise active dans la base SIRENE officielle : "${sireneData.raisonSociale}".`,
          affectedDocuments: docsWithSiret.map(e => e.typeLabel),
          values: {
            'Raison sociale officielle': sireneData.raisonSociale,
            'SIRET': sireneData.siret,
            'Activité': sireneData.libelleActivite || '—',
            'Forme juridique': sireneData.formeJuridique || '—',
          },
        })
      }

      // Name mismatch — warning (not critical, OCR can misread)
      if (sireneData.nameMatchScore !== null && sireneData.nameMatchScore < 0.5) {
        inconsistencies.push({
          id: 'warn-sirene-name',
          severity: 'avertissement',
          code: 'NOM_DIFFÉRENT_SIRENE',
          title: 'Nom extrait différent du nom officiel',
          description: `Le nom extrait par l'IA ("${sireneData.extractedName}") diffère significativement du nom officiel dans SIRENE ("${sireneData.raisonSociale}"). Vérifiez si le document appartient bien à cette entreprise.`,
          affectedDocuments: docsWithSiret.map(e => e.typeLabel),
          values: {
            'Nom extrait': sireneData.extractedName || '—',
            'Nom officiel (SIRENE)': sireneData.raisonSociale,
            'Score de correspondance': `${Math.round((sireneData.nameMatchScore ?? 0) * 100)}%`,
          },
        })
      }
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
    sireneData: sireneData ?? null,
  }
}
