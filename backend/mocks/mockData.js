function detectType(filename) {
  const f = filename.toLowerCase()
  if (f.includes('facture') || f.includes('invoice')) return 'facture'
  if (f.includes('devis') || f.includes('quote')) return 'devis'
  if (f.includes('kbis')) return 'kbis'
  if (f.includes('urssaf') || f.includes('vigilance')) return 'urssaf'
  if (f.includes('siret') || f.includes('attestation')) return 'attestation_siret'
  if (f.includes('rib')) return 'rib'
  return 'inconnu'
}

const TYPE_LABELS = {
  facture: 'Facture fournisseur',
  devis: 'Devis',
  kbis: 'Extrait Kbis',
  urssaf: 'Attestation de vigilance URSSAF',
  attestation_siret: 'Attestation SIRET',
  rib: 'RIB',
  inconnu: 'Document inconnu',
}

const EXTRACTION_TEMPLATES = {
  facture: {
    type: 'facture',
    typeLabel: TYPE_LABELS.facture,
    confidence: 0.97,
    fields: {
      siret: { value: '52384756900123', label: 'SIRET', confidence: 0.99 },
      tva: { value: 'FR52523847569', label: 'N° TVA intracommunautaire', confidence: 0.98 },
      montantHT: { value: '2 450,00 €', label: 'Montant HT', confidence: 0.99 },
      montantTTC: { value: '2 940,00 €', label: 'Montant TTC', confidence: 0.99 },
      dateEmission: { value: '10/02/2026', label: "Date d'émission", confidence: 0.98 },
      fournisseur: { value: 'TECH SOLUTIONS SAS', label: 'Fournisseur', confidence: 0.97 },
      acheteur: { value: 'ACME CORP', label: 'Acheteur', confidence: 0.96 },
      numeroFacture: { value: 'FAC-2026-00142', label: 'N° Facture', confidence: 0.99 },
    },
  },
  devis: {
    type: 'devis',
    typeLabel: TYPE_LABELS.devis,
    confidence: 0.95,
    fields: {
      siret: { value: '52384756900123', label: 'SIRET', confidence: 0.96 },
      tva: { value: 'FR52523847569', label: 'N° TVA intracommunautaire', confidence: 0.95 },
      montantHT: { value: '3 200,00 €', label: 'Montant HT', confidence: 0.97 },
      montantTTC: { value: '3 840,00 €', label: 'Montant TTC', confidence: 0.97 },
      dateEmission: { value: '05/02/2026', label: "Date d'émission", confidence: 0.96 },
      dateValidite: { value: '05/04/2026', label: 'Date de validité', confidence: 0.94 },
      fournisseur: { value: 'TECH SOLUTIONS SAS', label: 'Fournisseur', confidence: 0.97 },
      numeroDevis: { value: 'DEV-2026-0089', label: 'N° Devis', confidence: 0.99 },
    },
  },
  kbis: {
    type: 'kbis',
    typeLabel: TYPE_LABELS.kbis,
    confidence: 0.98,
    fields: {
      siret: { value: '52384756900123', label: 'SIRET', confidence: 0.99 },
      raisonSociale: { value: 'TECH SOLUTIONS SAS', label: 'Raison sociale', confidence: 0.99 },
      formeJuridique: { value: 'Société par Actions Simplifiée (SAS)', label: 'Forme juridique', confidence: 0.98 },
      capital: { value: '10 000,00 €', label: 'Capital social', confidence: 0.97 },
      adresse: { value: '14 Rue de la République, 75001 Paris', label: 'Siège social', confidence: 0.96 },
      dateImmatriculation: { value: '15/03/2018', label: 'Date immatriculation', confidence: 0.98 },
      dateExtrait: { value: '01/12/2025', label: "Date de l'extrait", confidence: 0.99 },
      activite: { value: 'Conseil en systèmes et logiciels informatiques', label: 'Activité principale', confidence: 0.95 },
    },
  },
  urssaf: {
    type: 'urssaf',
    typeLabel: TYPE_LABELS.urssaf,
    confidence: 0.96,
    fields: {
      siret: { value: '87654321098765', label: 'SIRET', confidence: 0.97 },
      raisonSociale: { value: 'TECH SOLUTIONS SAS', label: 'Raison sociale', confidence: 0.98 },
      dateEmission: { value: '01/10/2025', label: "Date d'émission", confidence: 0.97 },
      dateExpiration: { value: '31/12/2025', label: "Date d'expiration", confidence: 0.98 },
      statut: { value: 'En règle au jour de délivrance', label: 'Statut', confidence: 0.96 },
      organisme: { value: 'URSSAF Île-de-France', label: 'Organisme émetteur', confidence: 0.97 },
    },
  },
  attestation_siret: {
    type: 'attestation_siret',
    typeLabel: TYPE_LABELS.attestation_siret,
    confidence: 0.94,
    fields: {
      siret: { value: '52384756900123', label: 'SIRET', confidence: 0.98 },
      raisonSociale: { value: 'TECH SOLUTIONS SAS', label: 'Raison sociale', confidence: 0.97 },
      dateEmission: { value: '05/01/2026', label: "Date d'émission", confidence: 0.96 },
      etatAdministratif: { value: 'Actif', label: 'État administratif', confidence: 0.99 },
    },
  },
  rib: {
    type: 'rib',
    typeLabel: TYPE_LABELS.rib,
    confidence: 0.99,
    fields: {
      iban: { value: 'FR76 3000 6000 0112 3456 7890 189', label: 'IBAN', confidence: 0.99 },
      bic: { value: 'BNPAFRPPXXX', label: 'BIC/SWIFT', confidence: 0.99 },
      titulaire: { value: 'TECH SOLUTIONS SAS', label: 'Titulaire', confidence: 0.98 },
      banque: { value: 'BNP Paribas', label: 'Banque', confidence: 0.97 },
    },
  },
  inconnu: {
    type: 'inconnu',
    typeLabel: TYPE_LABELS.inconnu,
    confidence: 0.42,
    fields: {
      rawText: { value: 'Contenu non structuré — extraction partielle', label: 'Texte brut', confidence: 0.42 },
    },
  },
}

export function getMockExtraction(documents) {
  return documents.map(doc => {
    const type = detectType(doc.name)
    const template = EXTRACTION_TEMPLATES[type] || EXTRACTION_TEMPLATES.inconnu
    return { documentId: doc.id, documentName: doc.name, ...template }
  })
}

export function getMockValidation(documents) {
  const types = documents.map(d => detectType(d.name))
  const inconsistencies = []

  if (types.includes('facture') && types.includes('urssaf')) {
    inconsistencies.push({
      id: 'inc-001',
      severity: 'critique',
      code: 'SIRET_MISMATCH',
      title: 'SIRET incohérent entre documents',
      description:
        "Le SIRET présent sur la facture (52384756900123) ne correspond pas au SIRET de l'attestation URSSAF (87654321098765). Ces documents ne peuvent pas appartenir au même fournisseur.",
      affectedDocuments: ['Facture fournisseur', 'Attestation de vigilance URSSAF'],
      values: {
        'Facture fournisseur': '52384756900123',
        'Attestation URSSAF': '87654321098765',
      },
    })
  }

  if (types.includes('urssaf')) {
    inconsistencies.push({
      id: 'inc-002',
      severity: 'critique',
      code: 'ATTESTATION_EXPIRÉE',
      title: 'Attestation URSSAF expirée',
      description:
        "L'attestation de vigilance URSSAF a expiré le 31/12/2025. Elle n'est plus valide à la date de traitement (10/02/2026). Un renouvellement est obligatoire avant tout règlement.",
      affectedDocuments: ['Attestation de vigilance URSSAF'],
      values: {
        "Date d'expiration": '31/12/2025',
        'Date de traitement': '10/02/2026',
        'Jours de dépassement': '41 jours',
      },
    })
  }

  if (types.includes('facture') && types.includes('kbis')) {
    inconsistencies.push({
      id: 'val-001',
      severity: 'ok',
      code: 'SIRET_VALIDATED',
      title: "SIRET cohérent — Facture / Kbis",
      description: "Le SIRET (52384756900123) est identique sur la facture et l'extrait Kbis.",
      affectedDocuments: ['Facture fournisseur', 'Extrait Kbis'],
      values: {
        'Facture fournisseur': '52384756900123',
        'Extrait Kbis': '52384756900123',
      },
    })
  }

  return {
    summary: {
      total: documents.length,
      critiques: inconsistencies.filter(i => i.severity === 'critique').length,
      avertissements: inconsistencies.filter(i => i.severity === 'avertissement').length,
      validations: inconsistencies.filter(i => i.severity === 'ok').length,
      isCompliant: inconsistencies.filter(i => i.severity === 'critique').length === 0,
    },
    inconsistencies,
  }
}
