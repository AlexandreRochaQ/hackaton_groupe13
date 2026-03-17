from pydantic import BaseModel
from typing import Optional


class ExtractionInput(BaseModel):
    document_id: str
    text: str


class ExtractionOutput(BaseModel):
    document_id: str
    document_type: Optional[str] = None
    company_name: Optional[str] = None
    siret: Optional[str] = None
    siren: Optional[str] = None
    vat: Optional[str] = None
    invoice_number: Optional[str] = None
    amount_ht: Optional[float] = None
    amount_ttc: Optional[float] = None
    issue_date: Optional[str] = None
    expiration_date: Optional[str] = None
    confidence: Optional[float] = None
    anomalies: list[str] = []