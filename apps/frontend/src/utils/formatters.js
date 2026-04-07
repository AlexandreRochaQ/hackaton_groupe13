export const formatSIRET = (s) =>
  s?.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4') ?? '—'

export const formatMontant = (n) =>
  n != null
    ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
    : '—'

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—'
