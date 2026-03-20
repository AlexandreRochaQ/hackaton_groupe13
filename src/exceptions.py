"""
Custom exceptions for the OCR pipeline.
"""


class OCRError(Exception):
    """OCR processing errors."""
    pass


class DocumentNotFoundError(Exception):
    """Document file not found."""
    pass


class ExtractionError(Exception):
    """Data extraction errors."""
    pass


class ConfigurationError(Exception):
    """Configuration or environment setup errors."""
    pass


class ValidationError(Exception):
    """Input/output validation errors."""
    pass
