import { Router } from 'express'
import { getBatch } from '../mocks/mockStore.js'

const router = Router()

router.get('/:batchId', (req, res) => {
  const batch = getBatch(req.params.batchId)
  if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' })
  if (batch.pipelineStep !== 'ready') {
    return res.status(202).json({ success: false, error: 'Processing not complete' })
  }

  const extraction = batch.extraction || []
  const byType = {}
  extraction.forEach(doc => { byType[doc.type] = doc.fields })

  const src = byType.kbis || byType.facture || byType.devis || byType.attestation_siret || {}
  const rib = byType.rib || {}

  res.json({
    success: true,
    data: {
      raisonSociale: src.raisonSociale?.value || src.fournisseur?.value || '',
      siret: src.siret?.value || '',
      tva: src.tva?.value || '',
      formeJuridique: src.formeJuridique?.value || '',
      capital: src.capital?.value || '',
      adresse: src.adresse?.value || '',
      activite: src.activite?.value || '',
      iban: rib.iban?.value || '',
      bic: rib.bic?.value || '',
      banque: rib.banque?.value || '',
      _sourceDocuments: extraction.map(e => e.typeLabel),
    },
  })
})

router.post('/:batchId', (req, res) => {
  res.json({ success: true, data: { saved: true, payload: req.body } })
})

export default router
