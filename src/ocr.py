"""
OCR module for text extraction from document images using Tesseract.
"""

import pytesseract
from PIL import Image
import cv2
import numpy as np


class OCR:
    """Tesseract OCR wrapper for extracting text from images."""
    
    def __init__(self, lang='eng', config=''):
        """
        Initialize OCR engine.
        
        Args:
            lang: Language code for Tesseract (default: 'eng')
            config: Additional Tesseract configuration parameters
        """
        self.lang = lang
        self.config = config or '--psm 6'
        
        # Load Tesseract path from environment if available
        import os
        from dotenv import load_dotenv
        load_dotenv()
        tesseract_path = os.getenv('TESSERACT_PATH')
        if tesseract_path:
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
    
    def extract_text(self, image) -> str:
        """
        Extract text from an image.
        
        Args:
            image: PIL Image object or numpy array, or path to image file
            
        Returns:
            Extracted text as string
        """
        if isinstance(image, str):
            image = Image.open(image)
        elif isinstance(image, np.ndarray):
            image = Image.fromarray(image)
        
        # Preprocess image for better OCR results
        preprocessed = self.preprocess_image(image, enhance=True)
        
        text = pytesseract.image_to_string(
            preprocessed if isinstance(preprocessed, Image.Image) else Image.fromarray(preprocessed),
            lang=self.lang, 
            config=self.config
        )
        return text.strip()
    
    def extract_text_from_path(self, image_path: str) -> str:
        """
        Extract text from an image file path.
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Extracted text as string
        """
        return self.extract_text(image_path)
    
    def extract_regions(self, regions: dict) -> dict:
        """
        Extract text from multiple cropped regions.
        
        Args:
            regions: Dictionary mapping region names to PIL Images
            
        Returns:
            Dictionary mapping region names to extracted text
        """
        results = {}
        for region_name, region_image in regions.items():
            text = self.extract_text(region_image)
            results[region_name] = text
        return results
    
    @staticmethod
    def preprocess_image(image, enhance=True) -> np.ndarray:
        """
        Preprocess image for better OCR results.
        
        Args:
            image: Input image (PIL Image or numpy array)
            enhance: Whether to apply enhancement
            
        Returns:
            Preprocessed image as numpy array
        """
        if isinstance(image, Image.Image):
            image = np.array(image)
        
        if enhance:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            
            # Apply denoising
            denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
            
            # Apply adaptive thresholding with multiple methods
            # Method 1: Gaussian adaptive threshold
            thresh1 = cv2.adaptiveThreshold(
                denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
            
            # Method 2: Mean adaptive threshold
            thresh2 = cv2.adaptiveThreshold(
                denoised, 255, cv2.ADAPTIVE_THRESH_MEAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
            
            # Combine both methods - take the brighter pixels (more text)
            combined = cv2.max(thresh1, thresh2)
            
            # Morphological operations to connect broken text
            kernel = np.ones((1,1), np.uint8)
            dilated = cv2.dilate(combined, kernel, iterations=1)
            eroded = cv2.erode(dilated, kernel, iterations=1)
            
            return eroded
        
        return image
