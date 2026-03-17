# NER Service — Extraction d'entités

Service d'extraction d'informations clés depuis du texte OCR brut.

## Rôle dans le projet

Ce service reçoit le texte extrait par l'OCR et retourne un JSON structuré avec les champs métiers : SIRET, TVA, montants, dates, raison sociale, type de document.

## Stack technique

- Python 3.11
- spaCy (fr_core_news_sm) — détection de la raison sociale
- Regex — extraction SIRET, TVA, montants, dates
- FastAPI — exposition via API REST
- Pydantic — validation des données
- Docker — conteneurisation

## Lancer le service en local

```bash
pip install -r requirements.txt
python -m spacy download fr_core_news_sm
uvicorn app.main:app --reload --port 8001
```

## Endpoint

```
POST /extract
```

### Entrée

```json
{
  "document_id": "doc_001",
  "text": "FACTURE N° F2026-042 SIRET : 55210055400013 ..."
}
```

### Sortie

```json
{
  "document_id": "doc_001",
  "document_type": "facture",
  "company_name": "ABC SARL",
  "siret": "55210055400013",
  "siren": "552100554",
  "vat": "FR12345678901",
  "invoice_number": "F2026-042",
  "amount_ht": 1200.0,
  "amount_ttc": 1440.0,
  "issue_date": "2026-03-15",
  "expiration_date": null,
  "confidence": 0.9,
  "anomalies": []
}
```

## Lancer les tests

```bash
pytest tests/
```

## Docker

```bash
docker build -t ner-service .
docker run -p 8001:8001 ner-service
```

## Documentation interactive

Une fois le service lancé, accéder à :

```
http://localhost:8001/docs
```