"""
Main pipeline orchestrator for document processing.
"""

import os
import json
from pathlib import Path
from typing import List, Union
from pdf2image import convert_from_path
from PIL import Image

from .ocr import OCR
from .yolo_detector import RegionDetector
from .llm_extractor import LLMExtractor


class DocumentPipeline:
    """Orchestrates the complete document processing workflow."""
    
    def __init__(self, llm_model: str = "llama3.1"):
        """Initialize all pipeline components."""
        # Configuration pour documents français (avec fallback anglais)
        import os
        from dotenv import load_dotenv
        load_dotenv()
        
        # Vérifier si le pack français est installé
        tesseract_path = os.getenv('TESSERACT_PATH')
        fra_lang_file = None
        if tesseract_path:
            import pathlib
            tessdata_dir = pathlib.Path(tesseract_path).parent / 'tessdata'
            fra_lang_file = tessdata_dir / 'fra.traineddata'
        
        # Utiliser français si disponible, sinon anglais
        if fra_lang_file and fra_lang_file.exists():
            self.ocr = OCR(lang='fra', config='--psm 3')  # PSM 3: Fully automatic page segmentation
        else:
            self.ocr = OCR(lang='eng', config='--psm 3')
        
        self.detector = RegionDetector()
        self.extractor = LLMExtractor(model_name=llm_model)
    
    def load_document(self, file_path: str) -> str:
        """
        Load a PDF or image document.
        
        Args:
            file_path: Path to the document file
            
        Returns:
            File path if valid
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Document not found: {file_path}")
        
        supported_extensions = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff']
        if path.suffix.lower() not in supported_extensions:
            raise ValueError(
                f"Unsupported file type: {path.suffix}. "
                f"Supported: {supported_extensions}"
            )
        
        return str(path)
    
    def convert_pdf_to_images(self, pdf_path: str) -> List[Image.Image]:
        """
        Convert PDF pages to images.
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            List of PIL Images (one per page)
        """
        try:
            import os
            from dotenv import load_dotenv
            load_dotenv()
            
            poppler_path = os.getenv('POPPLER_PATH')
            if poppler_path:
                images = convert_from_path(pdf_path, dpi=300, poppler_path=poppler_path)
            else:
                images = convert_from_path(pdf_path, dpi=300)
            return images
        except Exception as e:
            print(f"Error converting PDF: {e}")
            return []
    
    def process_image(self, image: Image.Image) -> dict:
        """
        Process a single image through the extraction pipeline.
        
        Args:
            image: PIL Image object
            
        Returns:
            Dictionary with extracted data
        """
        # First, try full-text extraction (no region cropping)
        ocr_text_full = self.ocr.extract_text(image)
        
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
        except Exception as e:
            print(f"Region detection failed, using full text only: {e}")
            combined_text = ocr_text_full
        
        extracted_data = self.extractor.extract(combined_text)
        
        return extracted_data
    
    def process_document(self, file_path: str) -> List[dict]:
        """
        Process a single document (PDF or image).
        
        Args:
            file_path: Path to the document
            
        Returns:
            List of extracted data dictionaries (one per page)
        """
        print(f"Processing: {file_path}")
        
        path = Path(file_path)
        results = []
        
        if path.suffix.lower() == '.pdf':
            images = self.convert_pdf_to_images(file_path)
            for i, image in enumerate(images):
                print(f"  Processing page {i+1}/{len(images)}")
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
        
        return results
    
    def process_folder(self, input_folder: str) -> List[dict]:
        """
        Process all PDFs and images in a folder.
        
        Args:
            input_folder: Path to folder containing documents
            
        Returns:
            List of all extracted data dictionaries
        """
        folder_path = Path(input_folder)
        if not folder_path.exists():
            raise FileNotFoundError(f"Input folder not found: {input_folder}")
        
        all_results = []
        supported_files = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff']
        
        files_to_process = [
            f for f in folder_path.iterdir() 
            if f.suffix.lower() in supported_files
        ]
        
        print(f"Found {len(files_to_process)} documents to process")
        
        for i, file_path in enumerate(files_to_process, 1):
            print(f"\n[{i}/{len(files_to_process)}] ", end="")
            try:
                results = self.process_document(str(file_path))
                all_results.extend(results)
            except Exception as e:
                print(f"Error processing {file_path.name}: {e}")
                continue
        
        return all_results
    
    def export_json(self, results: List[dict], output_path: str) -> str:
        """
        Export extracted data to JSON file(s).
        
        Args:
            results: List of extracted data dictionaries
            output_path: Output directory or file path
            
        Returns:
            Path to the output file
        """
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
            print(f"Exported: {output_file}")
        
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
            print(f"Summary exported: {summary_file}")
            return str(summary_file)
        
        return ""
    
    def run(self, input_path: str, output_path: str) -> dict:
        """
        Run the complete pipeline.
        
        Args:
            input_path: Path to document or folder
            output_path: Path to output directory
            
        Returns:
            Summary dictionary
        """
        input_path_obj = Path(input_path)
        
        if input_path_obj.is_dir():
            results = self.process_folder(str(input_path))
        else:
            results = self.process_document(str(input_path))
        
        if not results:
            print("No data extracted!")
            return {"success": False, "error": "No data extracted"}
        
        output_file = self.export_json(results, output_path)
        
        summary = {
            "success": True,
            "documents_processed": len(set(r['source_file'] for r in results)),
            "pages_processed": len(results),
            "output_file": output_file
        }
        
        print(f"\n{'='*50}")
        print(f"Pipeline completed successfully!")
        print(f"Documents: {summary['documents_processed']}")
        print(f"Pages: {summary['pages_processed']}")
        print(f"Output: {output_file}")
        print(f"{'='*50}")
        
        return summary
