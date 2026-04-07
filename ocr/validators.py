"""
Input/output validation for the OCR pipeline.
"""

from pathlib import Path
from typing import List, Dict, Any
from .exceptions import ValidationError, DocumentNotFoundError


def validate_document_path(file_path: str) -> Path:
    """
    Validate that a document path exists and is accessible.
    
    Args:
        file_path: Path to the document
        
    Returns:
        Validated Path object
        
    Raises:
        DocumentNotFoundError: If file doesn't exist
        ValidationError: If file type is unsupported
    """
    path = Path(file_path)
    
    if not path.exists():
        raise DocumentNotFoundError(f"Document not found: {file_path}")
    
    supported_extensions = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff']
    if path.suffix.lower() not in supported_extensions:
        raise ValidationError(
            f"Unsupported file type: {path.suffix}. "
            f"Supported types: {supported_extensions}"
        )
    
    return path


def validate_folder_path(folder_path: str) -> Path:
    """
    Validate that a folder path exists and is accessible.
    
    Args:
        folder_path: Path to the folder
        
    Returns:
        Validated Path object
        
    Raises:
        DocumentNotFoundError: If folder doesn't exist
    """
    path = Path(folder_path)
    
    if not path.exists():
        raise DocumentNotFoundError(f"Folder not found: {folder_path}")
    
    if not path.is_dir():
        raise ValidationError(f"Path is not a directory: {folder_path}")
    
    return path


def validate_extraction_data(data: Dict[str, Any]) -> bool:
    """
    Validate extracted data structure.
    
    Args:
        data: Dictionary with extracted data
        
    Returns:
        True if valid
        
    Raises:
        ValidationError: If required fields are missing
    """
    required_fields = ['document_type']
    
    for field in required_fields:
        if field not in data:
            raise ValidationError(f"Missing required field: {field}")
    
    # Validate document type
    valid_types = ['facture', 'devis', 'attestation', 'certificat', 
                   'invoice', 'quote', 'certificate', 'unknown']
    doc_type = data.get('document_type', '').lower()
    
    if doc_type and not any(valid in doc_type for valid in valid_types):
        # Warning only, don't fail
        pass
    
    return True


def validate_siren(siren: str) -> bool:
    """
    Validate SIREN number (9 digits).
    
    Args:
        siren: SIREN number string
        
    Returns:
        True if valid
    """
    if not siren:
        return False
    
    # Remove spaces
    clean_siren = siren.replace(' ', '')
    
    return len(clean_siren) == 9 and clean_siren.isdigit()


def validate_siret(siret: str) -> bool:
    """
    Validate SIRET number (14 digits).
    
    Args:
        siret: SIRET number string
        
    Returns:
        True if valid
    """
    if not siret:
        return False
    
    # Remove spaces
    clean_siret = siret.replace(' ', '')
    
    return len(clean_siret) == 14 and clean_siret.isdigit()


def validate_date_format(date_str: str) -> bool:
    """
    Validate date is in ISO format (YYYY-MM-DD).
    
    Args:
        date_str: Date string
        
    Returns:
        True if valid ISO format
    """
    if not date_str:
        return False
    
    import re
    pattern = r'^\d{4}-\d{2}-\d{2}$'
    return bool(re.match(pattern, date_str))


def validate_phone_format(phone: str) -> bool:
    """
    Validate French phone number format.
    
    Args:
        phone: Phone number string
        
    Returns:
        True if valid format
    """
    if not phone:
        return False
    
    import re
    # French phone: 01 23 45 67 89 or 01.23.45.67.89 or +33 1 23 45 67 89
    pattern = r'^(\+33\s?|0)[1-9](\s|\.)?(\d{2}[\s\.]?){3}\d{2}$'
    return bool(re.match(pattern, phone.replace(' ', '')))
