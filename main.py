#!/usr/bin/env python3
"""
Document AI Pipeline - CLI Entry Point

Extract structured information from administrative PDFs using OCR and LLM.

Usage:
    python main.py --input data/documents --output data/results
"""

import argparse
import sys
from pathlib import Path

# Ensure the OCR service package is importable when running from the repo root
ROOT_DIR = Path(__file__).resolve().parent
OCR_SERVICE_DIR = ROOT_DIR / "ocr-service"
if str(OCR_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(OCR_SERVICE_DIR))

from src.pipeline import DocumentPipeline


def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Document AI Pipeline - Extract structured data from PDFs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=r"""
Examples:
  python ../main.py -i ../data/documents -o ../data/results
  python main.py --input data/documents --output data/results
  python main.py -i invoice.pdf -o results/
  python main.py --input ./pdfs --output ./output --verbose --model qwen2.5
  python main.py --input ./pdfs --output ./output --verbose --model llama3.1
        """
    )
    
    parser.add_argument(
        '-i', '--input',
        type=str,
        required=True,
        help='Input path (PDF file, image file, or folder containing documents)'
    )
    
    parser.add_argument(
        '-o', '--output',
        type=str,
        required=True,
        help='Output directory for JSON results'
    )
    
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose output'
    )
    
    parser.add_argument(
        '--model',
        type=str,
        default='llama3.1',
        help='LLM model to use for extraction (e.g., llama3.1, qwen2.5)'
    )
    
    return parser.parse_args()


def validate_paths(input_path: str, output_path: str) -> bool:
    """
    Validate input and output paths.
    
    Args:
        input_path: Input file or folder path
        output_path: Output directory path
        
    Returns:
        True if valid, raises exception otherwise
    """
    input_p = Path(input_path)
    if not input_p.exists():
        raise FileNotFoundError(
            f"Input path does not exist: {input_path}"
        )
    
    if not (input_p.is_file() or input_p.is_dir()):
        raise ValueError(
            f"Input must be a file or directory: {input_path}"
        )
    
    return True


def main():
    """Main entry point for the Document AI pipeline."""
    args = parse_arguments()
    
    try:
        validate_paths(args.input, args.output)
    except (FileNotFoundError, ValueError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    
    print("=" * 60)
    print("Document AI Pipeline")
    print("=" * 60)
    print(f"Input:  {args.input}")
    print(f"Output: {args.output}")
    print("=" * 60)
    
    pipeline = DocumentPipeline(llm_model=args.model)
    
    try:
        summary = pipeline.run(args.input, args.output)
        
        if summary.get('success'):
            sys.exit(0)
        else:
            print("Pipeline failed to extract data.", file=sys.stderr)
            sys.exit(1)
            
    except Exception as e:
        print(f"\nPipeline error: {e}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
