import { Router } from 'express'
import { getBatch } from '../services/batchStore.js'

const router = Router()

function isExpired(dateValue) {
  if (!dateValue) return false
  const parts = dateValue.split('/')
  const d = parts.length === 3
    ? new Date(parts[2], parts[1] - 1, parts[0])
    : new Date(dateValue)
  return !isNaN(d.getTime()) && d < new Date()
}

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

  const urssafDateVal = urssaf.dateExpiration?.value || null
  const urssafExpired = isExpired(urssafDateVal)
  const urssafStatus = !urssafDateVal ? 'non_fourni' : urssafExpired ? 'non_conforme' : 'conforme'
  const urssafDetail = !urssafDateVal
    ? 'Attestation non fournie'
    : urssafExpired
      ? `Attestation expirée le ${urssafDateVal} — renouvellement requis`
      : `Attestation valide jusqu'au ${urssafDateVal}`

  const globalNonConforme = hasCritiques || urssafExpired

  res.json({
    success: true,
    data: {
      fournisseur: kbis.raisonSociale?.value || facture.fournisseur?.value || '',
      siret: facture.siret?.value || kbis.siret?.value || '',
      checks: {
        urssaf: {
          label: 'Attestation de vigilance URSSAF',
          status: urssafStatus,
          dateExpiration: urssafDateVal,
          siretAttestation: urssaf.siret?.value || null,
          detail: urssafDetail,
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
      globalStatus: globalNonConforme ? 'non_conforme' : 'conforme',
      inconsistencies: validation.inconsistencies,
    },
  })
})

router.post('/:batchId', (req, res) => {
  res.json({ success: true, data: { saved: true, payload: req.body } })
})

export default router
