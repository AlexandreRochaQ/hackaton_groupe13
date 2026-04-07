"""
LLM-based structured data extraction using LangChain and Groq.
"""

import os
import json
import re
import logging
from typing import Optional
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv
from .config import Config
from .validators import validate_siren, validate_siret, validate_date_format

logger = logging.getLogger(__name__)


load_dotenv()


class LLMExtractor:
    """Extract structured data from OCR text using LangChain and Groq."""
    
    def __init__(self, model_name: str = "llama-3.1-8b-instant"):
        """
        Initialize the LLM extractor.
        
        Args:
            model_name: Groq model to use for extraction
        """
        api_key = Config.GROQ_API_KEY
        if not api_key:
            raise ValueError(
                "GROQ_API_KEY not found. Please set it in your .env file."
            )
        
        logger.info(f"Initializing LLM with model: {model_name}")
        
        self.llm = ChatGroq(
            groq_api_key=api_key,
            model_name=model_name or Config.GROQ_MODEL,
            temperature=Config.GROQ_TEMPERATURE
        )
        
        self.prompt_template = PromptTemplate(
            input_variables=["text"],
            template=self._get_prompt_template()
        )
        
        self.schema = {
            "type": "object",
            "properties": {
                "document_type": {"type": "string"},
                "company_name": {"type": "string"},
                "siren": {"type": "string"},
                "siret": {"type": "string"},
                "invoice_number": {"type": "string"},
                "date": {"type": "string"},
                "amount": {"type": "string"},
                "additional_info": {
                    "type": "object",
                    "description": "Toutes les autres informations trouvées dans le document"
                }
            },
            "required": ["document_type"]
        }
    
    def _get_prompt_template(self) -> str:
        """Return the prompt template for data extraction."""
        return """Tu es un expert en extraction d'informations structurées à partir de documents (factures, devis, attestations, certificats, documents commerciaux).

Analyse ATTENTIVEMENT le texte OCR ci-dessous et extrais TOUTES les informations présentes avec PRÉCISION. Le texte peut contenir des erreurs OCR, utilise ton jugement pour corriger.

Structure JSON attendue:
- document_type: facture|devis|attestation|certificat|invoice|quote|autre (en anglais ou français)
- company_name: nom de l'émetteur (entreprise, organisation, émetteur de la facture) ou chaîne vide
- siren: numéro SIREN à 9 chiffres ou chaîne vide
- siret: numéro SIRET à 14 chiffres ou chaîne vide  
- invoice_number: numéro de facture/document ou chaîne vide
- date: date du document au format ISO YYYY-MM-DD ou chaîne vide
- amount: montant total TTC numérique sans symbole monétaire ou chaîne vide
- additional_info: objet contenant TOUTES les autres informations importantes trouvées

Règles CRUCIALES:
1. Si un champ ne peut pas être trouvé, utilise une chaîne vide ""
2. Pour les montants, extrais uniquement la valeur numérique (exemple: "5263" et non "5263€")
3. Pour les dates, convertis TOUJOURS au format ISO YYYY-MM-DD (ex: 17/03/2026 → 2026-03-17)
4. Sois précis avec SIREN (9 chiffres) et SIRET (14 chiffres) - vérifie le nombre de chiffres
5. Identifie le type de document depuis le contexte
6. Dans additional_info, ajoute TOUS les champs importants que tu trouves :
   - ÉMETTEUR/COMPAGNIE: Qui émet le document
   - CLIENT/FACTURÉ À: Qui reçoit la facture
   - ADRESSES: Complètes (numéro, rue, code postal, ville)
   - CONTACTS: Téléphone, email, site web
   - MONTANTS: Total HT, TVA, Total TTC, descriptions des articles
   - PAIEMENT: Conditions, RIB/IBAN, échéance
   - AUTRES: Codes NAF/APE, immatriculations, références
7. CORRIGE les erreurs OCR évidentes
8. COMPLÈTE les informations partielles en utilisant le contexte
9. Ne limite PAS l'extraction - ajoute TOUT ce qui est pertinent dans additional_info
10. Pour les FACTURES COMMERCIALES, extrais:
    - L'émetteur (company_name)
    - Le client (dans additional_info.nom_complet ou additional_info.client)
    - Les deux adresses
    - Tous les montants (HT, TVA, TTC)
    - Les conditions de paiement
    - Le RIB/IBAN

TEXTE OCR:
{text}

Retourne UNIQUEMENT l'objet JSON valide, bien formaté, aucun autre texte:"""
    
    def extract(self, text: str) -> dict:
        """
        Extract structured data from OCR text.
        
        Args:
            text: OCR-extracted text from the document
            
        Returns:
            Dictionary with extracted fields
            
        Raises:
            ExtractionError: If extraction fails
        """
        try:
            logger.info(f"Extracting data from {len(text)} characters of OCR text")
            
            # Formater le prompt avec le texte
            formatted_prompt = self.prompt_template.format(text=text)
            
            # Utiliser le mode JSON de Groq directement
            from langchain_core.prompts import ChatPromptTemplate
            chat_prompt = ChatPromptTemplate.from_messages([
                ("system", "Tu es un expert qui extrait des données structurées au format JSON à partir de documents administratifs français. Tu corriges les erreurs OCR et complètes les informations partielles."),
                ("human", "{input}")
            ])
            
            chain = chat_prompt | self.llm
            response = chain.invoke({"input": formatted_prompt})
            
            # Parser la réponse JSON manuellement
            response_text = response.content if hasattr(response, 'content') else str(response)
            
            # Extraire le JSON de la réponse
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            if start_idx >= 0 and end_idx > start_idx:
                json_str = response_text[start_idx:end_idx]
                result = json.loads(json_str)
                
                # Validate and enrich extracted data
                self._validate_and_enrich(result)
                
                logger.info(f"Data extraction successful: {result.get('document_type', 'unknown')}")
                return result
            else:
                logger.error("No JSON found in LLM response")
                raise ValueError("No JSON found in response")
                
        except Exception as e:
            logger.error(f"LLM extraction error: {e}")
            return self._fallback_extraction(text)
    
    def _validate_and_enrich(self, data: dict) -> None:
        """
        Validate and enrich extracted data.
        
        Args:
            data: Extracted data dictionary
        """
        logger.debug("Validating extracted data...")
        
        # Validate SIREN if present
        if data.get('siren'):
            if not validate_siren(data['siren']):
                logger.warning(f"Invalid SIREN format: {data['siren']}")
        
        # Validate SIRET if present
        if data.get('siret'):
            if not validate_siret(data['siret']):
                logger.warning(f"Invalid SIRET format: {data['siret']}")
        
        # Validate date format if present
        if data.get('date'):
            if not validate_date_format(data['date']):
                logger.warning(f"Invalid date format: {data['date']}")
        
        logger.debug("Validation complete")
    
    def _json_parser(self):
        """Parse LLM response as JSON."""
        from langchain.output_parsers import ResponseSchema, StructuredOutputParser
        
        response_schemas = [
            ResponseSchema(name="document_type", description="Type of document (facture, devis, attestation, certificat)"),
            ResponseSchema(name="company_name", description="Nom de l'entreprise/organisation"),
            ResponseSchema(name="siren", description="Numéro SIREN à 9 chiffres"),
            ResponseSchema(name="siret", description="Numéro SIRET à 14 chiffres"),
            ResponseSchema(name="invoice_number", description="Numéro du document"),
            ResponseSchema(name="date", description="Date au format YYYY-MM-DD"),
            ResponseSchema(name="amount", description="Montant total numérique"),
            ResponseSchema(name="additional_info", description="Toutes les autres informations importantes trouvées")
        ]
        
        parser = StructuredOutputParser.from_response_schemas(response_schemas)
        return parser
    
    def _fallback_extraction(self, text: str) -> dict:
        """
        Fallback extraction using regex patterns when LLM fails.
        
        Args:
            text: OCR-extracted text
            
        Returns:
            Dictionary with extracted fields
        """
        result = {
            "document_type": self._detect_document_type(text),
            "company_name": "",
            "siren": "",
            "siret": "",
            "invoice_number": "",
            "date": "",
            "amount": "",
            "additional_info": {}
        }
        
        siren_match = re.search(r'\b(\d{9})\b', text)
        if siren_match:
            result["siren"] = siren_match.group(1)
        
        siret_match = re.search(r'\b(\d{14})\b', text)
        if siret_match:
            result["siret"] = siret_match.group(1)
        
        invoice_match = re.search(
            r'(?:Facture|Invoice|N°|Ref)[:\s]*([A-Z0-9\-]+)', 
            text, 
            re.IGNORECASE
        )
        if invoice_match:
            result["invoice_number"] = invoice_match.group(1)
        
        date_match = re.search(
            r'(\d{2}[-/]\d{2}[-/]\d{4})', 
            text
        )
        if date_match:
            date_str = date_match.group(1).replace('/', '-')
            parts = date_str.split('-')
            if len(parts) == 3:
                result["date"] = f"{parts[2]}-{parts[1]}-{parts[0]}"
        
        amount_match = re.search(
            r'(?:Total|Montant|Amount)[:\s]*([\d\s,\.]+)\s*€', 
            text, 
            re.IGNORECASE
        )
        if amount_match:
            amount = amount_match.group(1).replace(' ', '').replace(',', '.')
            result["amount"] = amount
        
        return result
    
    def _detect_document_type(self, text: str) -> str:
        """
        Detect document type from text.
        
        Args:
            text: OCR-extracted text
            
        Returns:
            Document type string
        """
        text_lower = text.lower()
        
        if any(word in text_lower for word in ['facture', 'invoice', 'billing']):
            return "invoice"
        elif any(word in text_lower for word in ['devis', 'quote', 'quotation']):
            return "quote"
        elif any(word in text_lower for word in ['attestation', 'certificate']):
            return "attestation"
        else:
            return "unknown"
    
    def validate_output(self, data: dict) -> bool:
        """
        Validate extracted data against schema.
        
        Args:
            data: Extracted data dictionary
            
        Returns:
            Boolean indicating validity
        """
        required_fields = self.schema["required"]
        for field in required_fields:
            if field not in data:
                return False
        return True
