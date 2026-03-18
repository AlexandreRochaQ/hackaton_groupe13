"""
Integration tests for the complete OCR pipeline.
"""

import unittest
from pathlib import Path
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.pipeline import DocumentPipeline
from src.config import Config
from src.validators import validate_siren, validate_siret, validate_extraction_data


class TestPipelineIntegration(unittest.TestCase):
    """Integration tests for the complete pipeline."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_pdf = Config.DOCUMENTS_DIR / "KAOUTAR_CERTIFICAT DE SCOLARITÉ (1).pdf"
        self.output_dir = Config.RESULTS_DIR / "test_results"
        
    def test_pipeline_with_real_document(self):
        """Test complete pipeline with actual certificate."""
        # Skip if test document doesn't exist
        if not self.test_pdf.exists():
            self.skipTest(f"Test document not found: {self.test_pdf}")
        
        # Initialize pipeline
        pipeline = DocumentPipeline()
        
        # Run pipeline
        result = pipeline.run(str(self.test_pdf), str(self.output_dir))
        
        # Verify results
        self.assertTrue(result['success'])
        self.assertEqual(result['documents_processed'], 1)
        self.assertEqual(result['pages_processed'], 1)
        
        # Check output file exists
        output_file = Path(result['output_file'])
        self.assertTrue(output_file.exists())
        
        # Load and verify extracted data
        import json
        with open(output_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        extracted = data['extracted_data'][0]
        
        # Validate structure
        validate_extraction_data(extracted)
        
        # Verify key fields were extracted
        self.assertEqual(extracted['document_type'], 'certificat de scolarité')
        self.assertIsNotNone(extracted.get('company_name'))
        
        # Verify SIREN and SIRET are valid format
        if extracted.get('siren'):
            self.assertTrue(validate_siren(extracted['siren']))
        
        if extracted.get('siret'):
            self.assertTrue(validate_siret(extracted['siret']))
        
        print(f"\n✅ Pipeline test passed! Extracted {len(extracted)} fields")


if __name__ == '__main__':
    unittest.main()
