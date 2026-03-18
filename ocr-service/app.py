import io
import os
import tempfile
from flask import Flask, request, jsonify
from PIL import Image

app = Flask(__name__)

# Initialize OCR reader at startup to avoid per-request overhead
_easyocr_reader = None


def get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        try:
            import easyocr
            _easyocr_reader = easyocr.Reader(['fr', 'en'], gpu=False)
        except Exception as e:
            print(f"EasyOCR init failed: {e}")
    return _easyocr_reader


def ocr_image(image):
    """Extract text from a PIL Image using pytesseract, with easyocr fallback."""
    # Try pytesseract first
    try:
        import pytesseract
        tesseract_path = os.getenv('TESSERACT_PATH')
        if tesseract_path:
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
        # Try French+English, fall back to English only
        try:
            text = pytesseract.image_to_string(image, lang='fra+eng')
        except Exception:
            text = pytesseract.image_to_string(image, lang='eng')
        if text.strip():
            return text.strip()
    except Exception as e:
        print(f"pytesseract failed: {e}")

    # Fallback: easyocr
    try:
        import numpy as np
        reader = get_easyocr_reader()
        if reader:
            img_array = np.array(image)
            results = reader.readtext(img_array, detail=0)
            return '\n'.join(results)
    except Exception as e:
        print(f"easyocr failed: {e}")

    return ''


def extract_text_from_bytes(file_bytes, filename, mimetype):
    """Extract text from uploaded file bytes."""
    ext = os.path.splitext(filename or '')[1].lower()
    is_pdf = ext == '.pdf' or (mimetype or '').startswith('application/pdf')

    if is_pdf:
        try:
            from pdf2image import convert_from_bytes
            poppler_path = os.getenv('POPPLER_PATH')
            kwargs = {'dpi': 200}
            if poppler_path:
                kwargs['poppler_path'] = poppler_path
            images = convert_from_bytes(file_bytes, **kwargs)
            page_texts = [ocr_image(img) for img in images]
            return '\n\n'.join(t for t in page_texts if t)
        except Exception as e:
            print(f"PDF->image conversion failed: {e}")
            return ''
    else:
        try:
            image = Image.open(io.BytesIO(file_bytes))
            return ocr_image(image)
        except Exception as e:
            print(f"Image OCR failed: {e}")
            return ''


@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'service': 'ocr'})


@app.route('/ocr', methods=['POST'])
def ocr():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    f = request.files['file']
    file_bytes = f.read()
    filename = f.filename or ''
    mimetype = f.content_type or 'application/octet-stream'

    text = extract_text_from_bytes(file_bytes, filename, mimetype)
    char_count = len(text.strip())
    confidence = 0.85 if char_count > 100 else (0.5 if char_count > 20 else 0.1)

    return jsonify({'text': text, 'confidence': confidence})


if __name__ == '__main__':
    debug = os.getenv('FLASK_DEBUG', '0') == '1'
    app.run(host='0.0.0.0', port=5001, debug=debug)
