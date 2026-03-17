# Pipeline Document AI

Extraction d'informations structurées à partir de PDF administratifs en utilisant OCR et LLM.

## Stack Technique

- **Python** 3.12
- **Tesseract OCR** - Extraction de texte
- **Poppler** - Conversion PDF vers image
- **LangChain** - Orchestration LLM
- **Groq API** - Inférence LLM

## Champs Extraits

- `document_type` (facture, devis, attestation)
- `company_name` (nom de l'entreprise)
- `siren` (9 chiffres)
- `siret` (14 chiffres)
- `invoice_number` (numéro de facture)
- `date` (YYYY-MM-DD)
- `amount` (montant)

## Démarrage Rapide

### 1. Installer les dépendances

```bash
pip install -r requirements.txt
```

### 2. Configurer l'environnement

Modifier le fichier `.env` :
```
GROQ_API_KEY=votre_clé_api_ici
POPPLER_PATH=C:\chemin\vers\poppler\Library\bin
TESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe
```

### 3. Exécuter le pipeline

```bash
python main.py --input data/documents --output data/results
```

## Structure du Projet

```
oc r-service/
├── data/
│   ├── documents/      # PDFs en entrée
│   └── results/        # JSON en sortie
├── src/
│   ├── ocr.py          # OCR Tesseract
│   ├── yolo_detector.py # Détection de régions
│   ├── llm_extractor.py # LangChain + Groq
│   └── pipeline.py     # Orchestrateur principal
├── main.py             # Point d'entrée CLI
├── requirements.txt    # Dépendances
└── .env                # Configuration
```

## Exemple de Sortie

```json
{
  "document_type": "invoice",
  "company_name": "ABC SARL",
  "siren": "552100554",
  "siret": "55210055400013",
  "invoice_number": "F2026-154",
  "date": "2026-03-15",
  "amount": "1450"
}
```
