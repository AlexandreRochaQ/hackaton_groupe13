"""
Main pipeline orchestrator for document processing.
"""

import os
import json
import logging
from pathlib import Path
from typing import List, Union
from pdf2image import convert_from_path
from PIL import Image

from .ocr import OCR
from .yolo_detector import RegionDetector
from .llm_extractor import LLMExtractor
from .config import Config
from .validators import validate_document_path, validate_folder_path, validate_extraction_data
from .exceptions import DocumentNotFoundError, ExtractionError, ConfigurationError


# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DocumentPipeline:
    """Orchestrates the complete document processing workflow."""
    
    def __init__(self):
        """Initialize all pipeline components."""
        try:
            # Validate environment
            Config.validate_environment()
            
            # Ensure directories exist
            Config.ensure_directories()
            
            logger.info("Initializing DocumentPipeline...")
            
            # Vérifier si le pack français est installé
            tesseract_path = os.getenv('TESSERACT_PATH')
            fra_lang_file = None
            if tesseract_path:
                import pathlib
                tessdata_dir = pathlib.Path(tesseract_path).parent / 'tessdata'
                fra_lang_file = tessdata_dir / 'fra.traineddata'
            
            # Utiliser français si disponible, sinon anglais
            if fra_lang_file and fra_lang_file.exists():
                self.ocr = OCR(lang=Config.DEFAULT_LANG, config=Config.OCR_CONFIG)
                logger.info("Using French language pack for OCR")
            else:
                self.ocr = OCR(lang='eng', config=Config.OCR_CONFIG)
                logger.info("French language pack not found, using English")
            
            self.detector = RegionDetector()
            self.extractor = LLMExtractor(model_name=Config.GROQ_MODEL)
            
            logger.info("DocumentPipeline initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize pipeline: {e}")
            raise ConfigurationError(f"Pipeline initialization failed: {e}")
    
    def load_document(self, file_path: str) -> str:
        """
        Load a PDF or image document.
        
        Args:
            file_path: Path to the document file
            
        Returns:
            File path if valid
            
        Raises:
            DocumentNotFoundError: If file doesn't exist
            ValidationError: If file type is unsupported
        """
        logger.debug(f"Validating document: {file_path}")
        validated_path = validate_document_path(file_path)
        logger.info(f"Document validated: {validated_path.name}")
        return str(validated_path)
    
    def convert_pdf_to_images(self, pdf_path: str) -> List[Image.Image]:
        """
        Convert PDF pages to images.
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            List of PIL Images (one per page)
            
        Raises:
            ExtractionError: If conversion fails
        """
        try:
            logger.info(f"Converting PDF to images: {pdf_path}")
            
            poppler_path = Config.POPPLER_PATH
            if poppler_path:
                images = convert_from_path(pdf_path, dpi=Config.IMAGE_DPI, poppler_path=poppler_path)
            else:
                images = convert_from_path(pdf_path, dpi=Config.IMAGE_DPI)
            
            logger.info(f"Successfully converted {len(images)} page(s)")
            return images
            
        except Exception as e:
            logger.error(f"PDF conversion failed: {e}")
            raise ExtractionError(f"Failed to convert PDF: {e}")
    
    def process_image(self, image: Image.Image) -> dict:
        """
        Process a single image through the extraction pipeline.
        
        Args:
            image: PIL Image object
            
        Returns:
            Dictionary with extracted data
            
        Raises:
            ExtractionError: If extraction fails
        """
        try:
            logger.debug("Processing image...")
            
            # First, try full-text extraction (no region cropping)
            ocr_text_full = self.ocr.extract_text(image)
            logger.debug(f"Full text extracted ({len(ocr_text_full)} chars)")
            
            # Also try region-based extraction as supplementary
            try:
                regions = self.detector.detect_regions(image)
                cropped_regions = self.detector.extract_all_regions(image, regions)
                ocr_results = self.ocr.extract_regions(cropped_regions)
                
                # Combine full text with structured regions
                combined_text = f"[FULL DOCUMENT]\n{ocr_text_full}\n\n"
                combined_text += "\n\n".join([
                    f"[{region_name.upper()}]\n{text}" 
                    for region_name, text in ocr_results.items()
                ])
                logger.debug(f"Combined text length: {len(combined_text)} chars")
            except Exception as e:
                logger.warning(f"Region detection failed, using full text only: {e}")
                combined_text = ocr_text_full
            
            extracted_data = self.extractor.extract(combined_text)
            
            # Validate extraction result
            validate_extraction_data(extracted_data)
            logger.info("Image processed successfully")
            
            return extracted_data
            
        except Exception as e:
            logger.error(f"Image processing failed: {e}")
            raise ExtractionError(f"Failed to process image: {e}")
    
    def process_document(self, file_path: str) -> List[dict]:
        """
        Process a single document (PDF or image).
        
        Args:
            file_path: Path to the document
            
        Returns:
            List of extracted data dictionaries (one per page)
        """
        logger.info(f"Processing document: {file_path}")
        
        path = Path(file_path)
        results = []
        
        if path.suffix.lower() == '.pdf':
            images = self.convert_pdf_to_images(file_path)
            for i, image in enumerate(images):
                logger.info(f"  Processing page {i+1}/{len(images)}")
                page_result = self.process_image(image)
                page_result['page_number'] = i + 1
                page_result['source_file'] = path.name
                results.append(page_result)
        else:
            image = Image.open(file_path)
            result = self.process_image(image)
            result['page_number'] = 1
            result['source_file'] = path.name
            results.append(result)
        
        logger.info(f"Document processed: {len(results)} page(s)")
        return results
    
    def process_folder(self, input_folder: str) -> List[dict]:
        """
        Process all PDFs and images in a folder.
        
        Args:
            input_folder: Path to folder containing documents
            
        Returns:
            List of all extracted data dictionaries
        """
        logger.info(f"Processing folder: {input_folder}")
        folder_path = validate_folder_path(input_folder)
        
        all_results = []
        supported_files = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff']
        
        files_to_process = [
            f for f in folder_path.iterdir() 
            if f.suffix.lower() in supported_files
        ]
        
        logger.info(f"Found {len(files_to_process)} documents to process")
        
        for i, file_path in enumerate(files_to_process, 1):
            logger.info(f"[{i}/{len(files_to_process)}] Processing {file_path.name}...")
            try:
                results = self.process_document(str(file_path))
                all_results.extend(results)
            except Exception as e:
                logger.error(f"Error processing {file_path.name}: {e}")
                continue
        
        logger.info(f"Folder processing complete: {len(all_results)} total pages")
        return all_results
    
    def export_json(self, results: List[dict], output_path: str) -> str:
        """
        Export extracted data to JSON file(s).
        
        Args:
            results: List of extracted data dictionaries
            output_path: Output directory or file path
            
        Returns:
            Path to the output file
            
        Raises:
            ExtractionError: If export fails
        """
        try:
            logger.info(f"Exporting results to: {output_path}")
            output_dir = Path(output_path)
            output_dir.mkdir(parents=True, exist_ok=True)
            
            results_by_file = {}
            for result in results:
                source_file = result.get('source_file', 'unknown')
                if source_file not in results_by_file:
                    results_by_file[source_file] = []
                results_by_file[source_file].append(result)
            
            output_files = []
            for source_file, file_results in results_by_file.items():
                base_name = Path(source_file).stem
                output_file = output_dir / f"{base_name}_extracted.json"
                
                output_data = {
                    "document_info": {
                        "source_file": source_file,
                        "pages_processed": len(file_results)
                    },
                    "extracted_data": file_results
                }
                
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(output_data, f, indent=2, ensure_ascii=False)
                
                output_files.append(str(output_file))
                logger.info(f"Exported: {output_file}")
            
            if len(results_by_file) == 1:
                return output_files[0]
            elif len(results_by_file) > 1:
                summary_file = output_dir / "summary.json"
                with open(summary_file, 'w', encoding='utf-8') as f:
                    json.dump({
                        "total_documents": len(results_by_file),
                        "total_pages": len(results),
                        "files": output_files
                    }, f, indent=2)
                logger.info(f"Summary exported: {summary_file}")
                return str(summary_file)
            
            return ""
            
        except Exception as e:
            logger.error(f"Export failed: {e}")
            raise ExtractionError(f"Failed to export results: {e}")
    
    def run(self, input_path: str, output_path: str) -> dict:
        """
        Run the complete pipeline.
        
        Args:
            input_path: Path to document or folder
            output_path: Path to output directory
            
        Returns:
            Summary dictionary
            
        Raises:
            ExtractionError: If pipeline fails
        """
        logger.info("="*60)
        logger.info("Starting Document AI Pipeline")
        logger.info("="*60)
        
        input_path_obj = Path(input_path)
        
        if input_path_obj.is_dir():
            results = self.process_folder(str(input_path))
        else:
            results = self.process_document(str(input_path))
        
        if not results:
            logger.error("No data extracted!")
            return {"success": False, "error": "No data extracted"}
        
        output_file = self.export_json(results, output_path)
        
        summary = {
            "success": True,
            "documents_processed": len(set(r['source_file'] for r in results)),
            "pages_processed": len(results),
            "output_file": output_file
        }
        
        logger.info("="*50)
        logger.info("Pipeline completed successfully!")
        logger.info(f"Documents: {summary['documents_processed']}")
        logger.info(f"Pages: {summary['pages_processed']}")
        logger.info(f"Output: {output_file}")
        logger.info("="*50)
        
        return summary
