import re

# SIRET : 14 chiffres
SIRET_PATTERN = re.compile(r'\b(\d{14})\b')

# SIREN : 9 chiffres (sous-ensemble du SIRET)
SIREN_PATTERN = re.compile(r'\b(\d{9})\b')

# TVA intracommunautaire française : FR + 2 caractères + 9 chiffres
TVA_PATTERN = re.compile(r'\bFR\s*[A-Z0-9]{2}\s*\d{9}\b', re.IGNORECASE)

# Montant HT
AMOUNT_HT_PATTERN = re.compile(
    r'(?:montant\s*h\.?t\.?|total\s*h\.?t\.?|ht\s*:?)\s*[:\-]?\s*([\d\s.,]+)\s*€?',
    re.IGNORECASE
)

# Montant TTC
AMOUNT_TTC_PATTERN = re.compile(
    r'(?:montant\s*t\.?t\.?c\.?|total\s*t\.?t\.?c\.?|ttc\s*:?)\s*[:\-]?\s*([\d\s.,]+)\s*€?',
    re.IGNORECASE
)

# Montant générique (fallback)
AMOUNT_GENERIC_PATTERN = re.compile(
    r'([\d\s]{1,10}[.,]\d{2})\s*€',
    re.IGNORECASE
)

# Date format JJ/MM/AAAA ou JJ-MM-AAAA ou AAAA-MM-JJ
DATE_PATTERN = re.compile(
    r'\b(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})\b'
)

# Date d'émission
DATE_EMISSION_PATTERN = re.compile(
    r'(?:date\s*(?:d\'?émission|de\s*facturation|facture|du)\s*[:\-]?\s*)(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})',
    re.IGNORECASE
)

# Date d'expiration / validité
DATE_EXPIRATION_PATTERN = re.compile(
    r'(?:date\s*(?:d\'?expiration|de\s*validité|valable\s*jusqu\'?au|expire\s*le)\s*[:\-]?\s*)(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})',
    re.IGNORECASE
)

# Numéro de facture
INVOICE_NUMBER_PATTERN = re.compile(
    r'(?:facture\s*n[°o]?\.?\s*[:\-]?\s*|invoice\s*#?\s*)([A-Z0-9\-\/]{4,20})',
    re.IGNORECASE
)

# Type de document
DOCUMENT_TYPE_KEYWORDS = {
    "facture": ["facture", "invoice", "avoir"],
    "devis": ["devis", "quotation", "estimation", "offre de prix"],
    "attestation_urssaf": ["attestation de vigilance", "urssaf", "cotisations sociales"],
    "kbis": ["extrait kbis", "registre du commerce", "rcs"],
    "rib": ["relevé d'identité bancaire", "rib", "iban", "bic"],
    "siret_certificate": ["avis de situation", "siret", "insee", "sirene"],
}