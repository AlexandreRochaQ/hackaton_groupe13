/**
 * SIRENE API integration — Base SIRENE des entreprises (data.gouv.fr)
 * Uses the free, unauthenticated recherche-entreprises API from api.gouv.fr
 *
 * Docs: https://recherche-entreprises.api.gouv.fr/docs
 * Data: https://www.data.gouv.fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret
 *
 * Rate limit: ~7 req/s — no API key required.
 */

const SIRENE_SEARCH_URL = 'https://recherche-entreprises.api.gouv.fr/search'

/**
 * Normalise a company name for fuzzy comparison.
 * Strips legal suffixes, punctuation, and accents for a fairer match.
 */
function normalizeName(name = '') {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/\b(sas|sarl|sa|sasu|eurl|sci|snc|gie|sca|scop)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Compute a simple similarity score between two names (0–1).
 * Uses word-level Jaccard similarity.
 */
function nameSimilarity(a, b) {
  const setA = new Set(normalizeName(a).split(' ').filter(Boolean))
  const setB = new Set(normalizeName(b).split(' ').filter(Boolean))
  if (!setA.size && !setB.size) return 1
  if (!setA.size || !setB.size) return 0
  const intersection = [...setA].filter(w => setB.has(w)).length
  const union = new Set([...setA, ...setB]).size
  return intersection / union
}

/**
 * Look up a SIRET in the SIRENE API.
 *
 * Returns null on network/API failure (non-blocking — pipeline continues).
 * Returns a structured object with official data + validation flags.
 *
 * @param {string} siret — 14-digit SIRET
 * @param {string} [extractedName] — company name extracted by OCR/NER, used for name matching
 */
export async function lookupSiret(siret, extractedName = null) {
  if (!siret || siret.replace(/\s/g, '').length !== 14) return null

  const cleanSiret = siret.replace(/\s/g, '')

  try {
    const url = `${SIRENE_SEARCH_URL}?q=${encodeURIComponent(cleanSiret)}&per_page=1`
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'DocFlow/1.0 (hackathon)' },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      console.warn(`[sireneService] API returned ${res.status} for SIRET ${cleanSiret}`)
      return null
    }

    const data = await res.json()
    const company = data.results?.[0]

    if (!company) {
      return {
        found: false,
        siret: cleanSiret,
        isActive: false,
        anomalies: [`SIRET ${cleanSiret} introuvable dans la base SIRENE`],
      }
    }

    // Prefer the establishment matching the exact SIRET; fall back to siège
    const etab =
      company.matching_etablissements?.find(e => e.siret === cleanSiret) ||
      company.siege ||
      {}

    const isActive = etab.etat_administratif === 'A'

    // Name cross-check
    const officialName = company.nom_raison_sociale || etab.denomination || ''
    const similarity = extractedName ? nameSimilarity(extractedName, officialName) : null

    const anomalies = []
    if (!isActive) {
      anomalies.push(`Entreprise fermée selon SIRENE (état : ${etab.etat_administratif})`)
    }
    if (similarity !== null && similarity < 0.5) {
      anomalies.push(
        `Nom extrait ("${extractedName}") diffère du nom officiel SIRENE ("${officialName}")`
      )
    }

    return {
      found: true,
      siret: cleanSiret,
      siren: company.siren,
      isActive,
      etatAdministratif: etab.etat_administratif,

      // Official identity
      raisonSociale: officialName,
      dateCreation: company.date_creation,
      categorieEntreprise: company.categorie_entreprise,      // PME, ETI, GE, etc.
      trancheEffectif: etab.tranche_effectif_salarie,

      // Establishment details
      adresse: etab.adresse,
      codePostal: etab.code_postal || company.siege?.code_postal,
      commune: etab.libelle_commune || company.siege?.libelle_commune,
      activitePrincipale: etab.activite_principale || company.siege?.activite_principale,
      libelleActivite:
        etab.libelle_activite_principale || company.siege?.libelle_activite_principale,
      formeJuridique:
        etab.libelle_nature_juridique_n3 ||
        etab.libelle_nature_juridique_n2 ||
        company.siege?.libelle_nature_juridique_n3,

      // Cross-check metadata
      nameMatchScore: similarity,
      nameMatchOk: similarity === null || similarity >= 0.5,
      extractedName,
      anomalies,
    }
  } catch (err) {
    console.warn('[sireneService] Lookup failed:', err.message)
    return null  // Non-blocking — pipeline continues without SIRENE
  }
}

/**
 * Find the most common SIRET across all extractions in a batch.
 * Returns null if no SIRET found.
 */
export function findBatchSiret(extractions) {
  const sirets = extractions
    .map(e => e.fields?.siret?.value)
    .filter(Boolean)
  if (!sirets.length) return null

  // Majority vote: pick the most frequent SIRET
  const counts = {}
  sirets.forEach(s => { counts[s] = (counts[s] || 0) + 1 })
  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0]
}
