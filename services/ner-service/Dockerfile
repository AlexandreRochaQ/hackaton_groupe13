FROM --platform=linux/amd64 python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc g++ build-essential && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m spacy download fr_core_news_sm
COPY . .
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
