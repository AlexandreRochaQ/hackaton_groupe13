FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y tesseract-ocr tesseract-ocr-fra poppler-utils libgl1 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir flask pytesseract easyocr pymongo Pillow pdf2image requests python-dotenv opencv-python-headless
COPY . .
EXPOSE 5001
CMD ["python", "app.py"]
