#!/usr/bin/env python3
"""
Test script to verify OCR improvements.
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from src.pipeline import DocumentPipeline

def test_improved_pipeline():
    """Test the improved pipeline on the certificate PDF."""
    
    # Paths
    pdf_path = Path("data/documents/KAOUTAR_CERTIFICAT DE SCOLARITÉ (1).pdf")
    output_dir = Path("data/results_improved")
    
    if not pdf_path.exists():
        print(f"Error: PDF not found at {pdf_path}")
        print("Please ensure the PDF is in data/documents/")
        return
    
    print("=" * 60)
    print("Testing IMPROVED OCR Pipeline")
    print("=" * 60)
    
    # Create pipeline
    pipeline = DocumentPipeline()
    
    try:
        # Run pipeline
        summary = pipeline.run(str(pdf_path), str(output_dir))
        
        if summary.get('success'):
            print("\n✓ Pipeline completed successfully!")
            print(f"  - Documents processed: {summary['documents_processed']}")
            print(f"  - Pages processed: {summary['pages_processed']}")
            print(f"  - Output file: {summary['output_file']}")
            
            # Display results
            output_file = Path(summary['output_file'])
            if output_file.exists():
                import json
                with open(output_file, 'r', encoding='utf-8') as f:
                    results = json.load(f)
                
                print("\n" + "=" * 60)
                print("EXTRACTED DATA:")
                print("=" * 60)
                
                for item in results.get('extracted_data', []):
                    print(f"\nDocument Type: {item.get('document_type', 'N/A')}")
                    print(f"Company: {item.get('company_name', 'N/A')}")
                    print(f"SIREN: {item.get('siren', 'N/A')}")
                    print(f"SIRET: {item.get('siret', 'N/A')}")
                    
                    print("\nAdditional Info:")
                    additional = item.get('additional_info', {})
                    for key, value in additional.items():
                        print(f"  - {key}: {value}")
        else:
            print("\n✗ Pipeline failed!")
            
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_improved_pipeline()
