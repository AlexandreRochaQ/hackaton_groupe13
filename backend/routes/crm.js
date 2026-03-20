import { Router } from 'express'
import { getBatch } from '../services/batchStore.js'

const router = Router()

router.get('/:batchId', async (req, res, next) => {
  try {
    const batch = await getBatch(req.params.batchId)
    if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' })
    if (batch.pipelineStep !== 'ready') {
      return res.status(202).json({ success: false, error: 'Processing not complete' })
    }

    const extraction = batch.extraction || []
    const byType = {}
    extraction.forEach(doc => { byType[doc.type] = doc.fields })

    const src = byType.kbis || byType.facture || byType.devis || byType.attestation_siret || {}
    const rib = byType.rib || {}
    const sirene = batch.sireneData || null

    // OCR-extracted values (primary source)
    const ocrRaisonSociale = src.raisonSociale?.value || src.fournisseur?.value || ''
    const ocrFormeJuridique = src.formeJuridique?.value || ''
    const ocrAdresse = src.adresse?.value || ''
    const ocrActivite = src.activite?.value || ''

    // SIRENE enrichment: fill gaps when OCR didn't extract the field
    const sireneFound = sirene?.found === true
    const enrichedRaisonSociale = ocrRaisonSociale || (sireneFound ? sirene.raisonSociale : '') || ''
    const enrichedFormeJuridique = ocrFormeJuridique || (sireneFound ? sirene.formeJuridique : '') || ''
    const enrichedAdresse = ocrAdresse || (sireneFound ? sirene.adresse : '') || ''
    const enrichedActivite = ocrActivite || (sireneFound ? sirene.libelleActivite : '') || ''

    // Track which fields came from SIRENE vs OCR
    const sireneFields = []
    if (!ocrRaisonSociale && enrichedRaisonSociale) sireneFields.push('raisonSociale')
    if (!ocrFormeJuridique && enrichedFormeJuridique) sireneFields.push('formeJuridique')
    if (!ocrAdresse && enrichedAdresse) sireneFields.push('adresse')
    if (!ocrActivite && enrichedActivite) sireneFields.push('activite')

    res.json({
      success: true,
      data: {
        raisonSociale: enrichedRaisonSociale,
        siret: src.siret?.value || '',
        tva: src.tva?.value || '',
        formeJuridique: enrichedFormeJuridique,
        capital: src.capital?.value || '',
        adresse: enrichedAdresse,
        activite: enrichedActivite,
        iban: rib.iban?.value || src.iban?.value || '',
        bic: rib.bic?.value || src.bic?.value || '',
        banque: rib.banque?.value || src.banque?.value || '',
        _sourceDocuments: extraction.map(e => e.typeLabel),
        _sireneData: sirene ? {
          found: sirene.found,
          isActive: sirene.isActive,
          raisonSociale: sirene.raisonSociale,
          siret: sirene.siret,
          siren: sirene.siren,
          codePostal: sirene.codePostal,
          commune: sirene.commune,
          dateCreation: sirene.dateCreation,
          categorieEntreprise: sirene.categorieEntreprise,
          nameMatchScore: sirene.nameMatchScore,
        } : null,
        _sireneFields: sireneFields,
      },
    })
  } catch (err) {
    next(err)
  }
})

router.post('/:batchId', (req, res) => {
  res.json({ success: true, data: { saved: true, payload: req.body } })
})

export default router
