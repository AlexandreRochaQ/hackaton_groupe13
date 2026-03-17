from fastapi import FastAPI, HTTPException
from app.schemas import ExtractionInput, ExtractionOutput
from app.extractor import extract

app = FastAPI(
    title="NER Service",
    description="Service d'extraction d'entités depuis du texte OCR — Hackathon Groupe 13",
    version="1.0.0"
)


@app.get("/")
def root():
    return {"status": "ok", "service": "ner-service", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/extract", response_model=ExtractionOutput)
def extract_entities(payload: ExtractionInput):
    """
    Reçoit un texte OCR brut et retourne les entités extraites en JSON structuré.
    
    - document_id : identifiant unique du document
    - text : texte brut sorti par l'OCR
    """
    if not payload.text or len(payload.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Le champ 'text' est vide.")

    result = extract(payload.document_id, payload.text)
    return ExtractionOutput(**result)