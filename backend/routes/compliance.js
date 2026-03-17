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
  const validation = batch.validation || { summary: {}, inconsistencies: [] }

  const byType = {}
  extraction.forEach(doc => { byType[doc.type] = doc.fields })

  const urssaf = byType.urssaf || {}
  const kbis = byType.kbis || {}
  const facture = byType.facture || {}
  const hasCritiques = validation.summary.critiques > 0

  res.json({
    success: true,
    data: {
      fournisseur: kbis.raisonSociale?.value || facture.fournisseur?.value || '',
      siret: facture.siret?.value || kbis.siret?.value || '',
      checks: {
        urssaf: {
          label: 'Attestation de vigilance URSSAF',
          status: urssaf.dateExpiration ? 'non_conforme' : 'non_fourni',
          dateExpiration: urssaf.dateExpiration?.value || null,
          siretAttestation: urssaf.siret?.value || null,
          detail: urssaf.dateExpiration
            ? 'Attestation expirée le 31/12/2025 — renouvellement requis'
            : 'Attestation non fournie',
        },
        kbis: {
          label: 'Extrait Kbis',
          status: kbis.dateExtrait ? 'conforme' : 'non_fourni',
          dateExtrait: kbis.dateExtrait?.value || null,
          detail: kbis.dateExtrait ? `Extrait du ${kbis.dateExtrait.value}` : 'Kbis non fourni',
        },
        siretCoherence: {
          label: 'Cohérence SIRET inter-documents',
          status: hasCritiques ? 'non_conforme' : 'conforme',
          detail: hasCritiques
            ? 'Incohérences SIRET détectées entre les documents fournis'
            : 'SIRET cohérent sur tous les documents',
        },
      },
      globalStatus: hasCritiques ? 'non_conforme' : 'conforme',
      inconsistencies: validation.inconsistencies,
    },
  })
})

router.post('/:batchId', (req, res) => {
  res.json({ success: true, data: { saved: true, payload: req.body } })
})

export default router
