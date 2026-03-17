from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime

def ingest(**ctx):
    print("Ingestion du fichier...")
    # TODO : appel vrai service upload

def call_ocr(**ctx):
    print("Appel OCR...")
    # TODO : POST http://ocr-service:5001/ocr

def call_ner(**ctx):
    print("Appel NER...")
    # TODO : POST http://ner-service:5002/extract

def validate(**ctx):
    print("Validation inter-docs...")
    # C'est TON code métier ici

with DAG("pipeline_documents", start_date=datetime(2024,1,1), schedule=None) as dag:
    t1 = PythonOperator(task_id="ingestion",  python_callable=ingest)
    t2 = PythonOperator(task_id="ocr",        python_callable=call_ocr)
    t3 = PythonOperator(task_id="ner",        python_callable=call_ner)
    t4 = PythonOperator(task_id="validation", python_callable=validate)

    t1 >> t2 >> t3 >> t4