import { Router } from 'express'
import { getBatch } from '../mocks/mockStore.js'

const router = Router()

// GET /api/crm/:batchId
// Returns CRM supplier form pre-filled from extracted data
router.get('/:batchId', (req, res) => {
  const batch = getBatch(req.params.batchId)
  if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' })
  if (batch.pipelineStep !== 'ready') {
    return res.status(202).json({ success: false, error: 'Processing not complete' })
  }

  const extraction = batch.extraction || []

  // Aggregate fields across documents — prefer kbis > facture > urssaf for each field
  const byType = {}
  extraction.forEach(doc => { byType[doc.type] = doc.fields })

  const src = byType.kbis || byType.facture || byType.devis || byType.attestation_siret || {}
  const rib = byType.rib || {}

  const crmData = {
    // Company info
    raisonSociale: src.raisonSociale?.value || src.fournisseur?.value || '',
    siret: src.siret?.value || '',
    tva: src.tva?.value || '',
    formeJuridique: src.formeJuridique?.value || '',
    capital: src.capital?.value || '',
    adresse: src.adresse?.value || '',
    activite: src.activite?.value || '',

    // Bank info
    iban: rib.iban?.value || '',
    bic: rib.bic?.value || '',
    banque: rib.banque?.value || '',

    // Meta
    _autoFilledFields: Object.keys(src).concat(Object.keys(rib)),
    _sourceDocuments: extraction.map(e => e.typeLabel),
  }

  res.json({ success: true, data: crmData })
})

// POST /api/crm/:batchId — save form submission
router.post('/:batchId', (req, res) => {
  // In production: write to CRM system. For now: echo back.
  res.json({ success: true, data: { saved: true, payload: req.body } })
})

export default router
