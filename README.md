# Document AI Pipeline

Extract structured information from administrative PDFs using OCR and LLM.

## Tech Stack

- **Python** 3.12
- **Tesseract OCR** - Text extraction
- **Poppler** - PDF to image conversion
- **LangChain** - LLM orchestration
- **Groq API** - LLM inference

## Extracted Fields

- `document_type` (invoice, quote, attestation)
- `company_name`
- `siren` (9 digits)
- `siret` (14 digits)
- `invoice_number`
- `date` (YYYY-MM-DD)
- `amount`

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Edit `.env` file:
```
GROQ_API_KEY=your_api_key_here
POPPLER_PATH=C:\path\to\poppler\Library\bin
TESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe
```

### 3. Run Pipeline

```bash
python main.py --input data/documents --output data/results
```

## Project Structure

```
ocr-service/
├── data/
│   ├── documents/      # Input PDFs
│   └── results/        # Output JSON
├── src/
│   ├── ocr.py          # Tesseract OCR
│   ├── yolo_detector.py # Region detection
│   ├── llm_extractor.py # LangChain + Groq
│   └── pipeline.py     # Main orchestrator
├── main.py             # CLI entry point
├── requirements.txt    # Dependencies
└── .env                # Environment config
```

## Example Output

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
