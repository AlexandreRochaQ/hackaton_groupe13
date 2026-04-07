import { validateExtractions } from '../services/validationService.js'

describe('validationService', () => {
  describe('validateExtractions', () => {
    it('should return no inconsistencies for valid extractions', () => {
      const extractions = [
        {
          type: 'facture',
          typeLabel: 'Facture',
          fields: { siret: { value: '12345678901234' } }
        },
        {
          type: 'kbis',
          typeLabel: 'Extrait Kbis',
          fields: { siret: { value: '12345678901234' } }
        }
      ]

      const result = validateExtractions(extractions)

      expect(result.inconsistencies).toHaveLength(1)
      expect(result.inconsistencies[0].code).toBe('SIRET_VALIDATED')
      expect(result.inconsistencies[0].severity).toBe('ok')
    })

    it('should detect SIRET mismatch', () => {
      const extractions = [
        {
          type: 'facture',
          typeLabel: 'Facture',
          fields: { siret: { value: '12345678901234' } }
        },
        {
          type: 'kbis',
          typeLabel: 'Extrait Kbis',
          fields: { siret: { value: '56789012345678' } }
        }
      ]

      const result = validateExtractions(extractions)

      expect(result.inconsistencies).toHaveLength(1)
      expect(result.inconsistencies[0].code).toBe('SIRET_MISMATCH')
      expect(result.inconsistencies[0].severity).toBe('critique')
    })

    it('should validate SIRET coherence', () => {
      const extractions = [
        {
          type: 'facture',
          typeLabel: 'Facture',
          fields: { siret: { value: '12345678901234' } }
        },
        {
          type: 'kbis',
          typeLabel: 'Extrait Kbis',
          fields: { siret: { value: '12345678901234' } }
        }
      ]

      const result = validateExtractions(extractions)

      expect(result.inconsistencies).toHaveLength(1)
      expect(result.inconsistencies[0].code).toBe('SIRET_VALIDATED')
      expect(result.inconsistencies[0].severity).toBe('ok')
    })

    it('should detect expired URSSAF attestation', () => {
      const extractions = [
        {
          type: 'urssaf',
          typeLabel: 'Attestation URSSAF',
          fields: { dateExpiration: { value: '01/01/2020' } }
        }
      ]

      const result = validateExtractions(extractions)

      expect(result.inconsistencies).toHaveLength(1)
      expect(result.inconsistencies[0].code).toBe('ATTESTATION_EXPIRÉE')
      expect(result.inconsistencies[0].severity).toBe('critique')
    })

    it('should detect expired Kbis', () => {
      const extractions = [
        {
          type: 'kbis',
          typeLabel: 'Extrait Kbis',
          fields: { dateExpiration: { value: '01/01/2020' } }
        }
      ]

      const result = validateExtractions(extractions)

      expect(result.inconsistencies).toHaveLength(1)
      expect(result.inconsistencies[0].code).toBe('KBIS_EXPIRED')
      expect(result.inconsistencies[0].severity).toBe('critique')
    })

    it('should handle SIRENE data not found', () => {
      const extractions = [
        {
          type: 'facture',
          typeLabel: 'Facture',
          fields: { siret: { value: '12345678901234' } }
        }
      ]
      const sireneData = { siret: '12345678901234', found: false }

      const result = validateExtractions(extractions, sireneData)

      expect(result.inconsistencies).toHaveLength(1)
      expect(result.inconsistencies[0].code).toBe('SIRENE_NOT_FOUND')
      expect(result.inconsistencies[0].severity).toBe('critique')
    })
  })
})