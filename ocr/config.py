"""
Configuration settings for the OCR pipeline.
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Centralized configuration management."""
    
    # Base directories
    BASE_DIR = Path(__file__).parent.parent
    DATA_DIR = BASE_DIR / "data"
    DOCUMENTS_DIR = DATA_DIR / "documents"
    RESULTS_DIR = DATA_DIR / "results"
    
    # OCR settings
    DEFAULT_LANG = 'fra'
    DEFAULT_PSM = 3  # Fully automatic page segmentation
    OCR_CONFIG = f'--psm {DEFAULT_PSM}'
    
    # Tesseract and Poppler paths
    TESSERACT_PATH = os.getenv('TESSERACT_PATH')
    POPPLER_PATH = os.getenv('POPPLER_PATH')
    
    # Groq API
    GROQ_API_KEY = os.getenv('GROQ_API_KEY')
    GROQ_MODEL = "llama-3.1-8b-instant"
    GROQ_TEMPERATURE = 0.1
    
    # Image processing
    IMAGE_DPI = 300
    DENOISE_STRENGTH = 10
    MORPH_KERNEL_SIZE = (1, 1)
    
    # Logging
    LOG_LEVEL = logging.INFO
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    @classmethod
    def validate_environment(cls) -> bool:
        """Validate that all required environment variables are set."""
        required_vars = ['GROQ_API_KEY']
        missing = [var for var in required_vars if not os.getenv(var)]
        
        if missing:
            raise EnvironmentError(
                f"Missing required environment variables: {missing}. "
                "Please check your .env file."
            )
        
        return True
    
    @classmethod
    def ensure_directories(cls):
        """Create necessary directories if they don't exist."""
        cls.DATA_DIR.mkdir(parents=True, exist_ok=True)
        cls.DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
        cls.RESULTS_DIR.mkdir(parents=True, exist_ok=True)
