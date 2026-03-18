const TYPE_LABELS = {
  facture: 'Facture fournisseur',
  devis: 'Devis',
  kbis: 'Extrait Kbis',
  urssaf: 'Attestation de vigilance URSSAF',
  attestation_siret: 'Attestation SIRET',
  rib: 'RIB',
  inconnu: 'Document inconnu',
}

function field(value, label, confidence) {
  if (value === null || value === undefined || value === '') return null
  return { value: String(value), label, confidence }
}

export function nerToExtraction(doc, nerResult) {
  const type = nerResult.document_type || doc.type || 'inconnu'
  const conf = nerResult.confidence || 0.8
  const fields = {}

  if (nerResult.siret) fields.siret = field(nerResult.siret, 'SIRET', conf)
  if (nerResult.vat) fields.tva = field(nerResult.vat, 'N° TVA intracommunautaire', conf)
  if (nerResult.amount_ht != null) fields.montantHT = field(`${nerResult.amount_ht} €`, 'Montant HT', conf)
  if (nerResult.amount_ttc != null) fields.montantTTC = field(`${nerResult.amount_ttc} €`, 'Montant TTC', conf)
  if (nerResult.issue_date) fields.dateEmission = field(nerResult.issue_date, "Date d'émission", conf)
  if (nerResult.expiration_date) fields.dateExpiration = field(nerResult.expiration_date, "Date d'expiration", conf)

  if (nerResult.invoice_number) {
    if (type === 'devis') {
      fields.numeroDevis = field(nerResult.invoice_number, 'N° Devis', conf)
    } else {
      fields.numeroFacture = field(nerResult.invoice_number, 'N° Facture', conf)
    }
  }

  if (nerResult.company_name) {
    if (['kbis', 'urssaf', 'attestation_siret'].includes(type)) {
      fields.raisonSociale = field(nerResult.company_name, 'Raison sociale', conf)
    } else {
      fields.fournisseur = field(nerResult.company_name, 'Fournisseur', conf)
    }
  }

  Object.keys(fields).forEach(k => { if (!fields[k]) delete fields[k] })

  return {
    documentId: doc.id,
    documentName: doc.name,
    type,
    typeLabel: TYPE_LABELS[type] || 'Document inconnu',
    confidence: conf,
    fields,
    anomalies: nerResult.anomalies || [],
  }
}
