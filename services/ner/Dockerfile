FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY Requirements.txt .
RUN pip install --no-cache-dir -r Requirements.txt

RUN python -m spacy download fr_core_news_lg

COPY . .

EXPOSE 5002

CMD ["uvicorn", "App:app", "--host", "0.0.0.0", "--port", "5002", "--reload"]