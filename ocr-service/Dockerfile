FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-fra \
    libgl1 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    flask \
    pytesseract \
    easyocr \
    pymongo \
    Pillow \
    pdf2image

COPY . .

RUN if [ ! -f app.py ]; then \
    echo 'from flask import Flask, request, jsonify\napp = Flask(__name__)\n\n@app.route("/health")\ndef health():\n    return jsonify({"status": "ok", "service": "ocr"})\n\n@app.route("/ocr", methods=["POST"])\ndef ocr():\n    data = request.json\n    return jsonify({"file_id": data.get("file_id"), "text": "OCR mock - service en cours de développement", "confidence": 0.99})\n\nif __name__ == "__main__":\n    app.run(host="0.0.0.0", port=5001)' > app.py; \
    fi

EXPOSE 5001

CMD ["python", "app.py"]