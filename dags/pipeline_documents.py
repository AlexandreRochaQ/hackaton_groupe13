"""
pipeline_documents.py
DAG principal DocuFlow — Orchestration du pipeline documentaire
Auteur : Rôle 7 — Orchestration & Industrialisation
"""

from airflow import DAG
from airflow.operators.python import PythonOperator, BranchPythonOperator
from airflow.operators.empty import EmptyOperator
from airflow.utils.dates import days_ago
from airflow.models import Variable
import requests
import logging
import json
from datetime import datetime, timedelta

MONGO_URI         = "mongodb://mongo:27017"
MONGO_DB          = "docuflow"
OCR_SERVICE_URL   = "http://ocr-service:5001"
NER_SERVICE_URL   = "http://ner-service:5002"
API_BACKEND_URL   = "http://api-backend:4000"

DEFAULT_ARGS = {
    "owner": "role7-orchestration",
    "depends_on_past": False,
    "retries": 2,
    "retry_delay": timedelta(seconds=30),
    "email_on_failure": False,  
}

log = logging.getLogger(__name__)

def task_ingestion(**ctx):
    """
    Point d'entrée du pipeline.
    En prod : déclenché via API Airflow trigger avec conf JSON.
    Exemple de conf : {"file_id": "abc123", "filename": "facture.pdf", "type": "facture"}
    """
    conf = ctx["dag_run"].conf or {}

    file_id  = conf.get("file_id", "DEMO_FILE_001")
    filename = conf.get("filename", "facture_demo.pdf")
    doc_type = conf.get("doc_type", "inconnu")   

    log.info(f"[INGESTION] Nouveau document reçu : {filename} (id={file_id}, type={doc_type})")

   
    ctx["ti"].xcom_push(key="file_id",  value=file_id)
    ctx["ti"].xcom_push(key="filename", value=filename)
    ctx["ti"].xcom_push(key="doc_type", value=doc_type)

    log.info("[INGESTION] Métadonnées transmises au pipeline")
    return {"file_id": file_id, "filename": filename, "doc_type": doc_type}


def task_raw_zone(**ctx):
    ti      = ctx["ti"]
    file_id = ti.xcom_pull(task_ids="ingestion", key="file_id")
    filename = ti.xcom_pull(task_ids="ingestion", key="filename")

    log.info(f"[RAW ZONE] Stockage brut du fichier {filename} (id={file_id})")

    # TODO : remplacer par vrai appel MongoDB quand collègue Data Lake est prêt
    # from pymongo import MongoClient
    # client = MongoClient(MONGO_URI)
    # db = client[MONGO_DB]
    # db.raw.insert_one({"file_id": file_id, "filename": filename, "stored_at": datetime.utcnow()})

    log.info("[RAW ZONE] Document brut stocké")
    ctx["ti"].xcom_push(key="raw_stored", value=True)


def task_ocr(**ctx):
    ti      = ctx["ti"]
    file_id = ti.xcom_pull(task_ids="ingestion", key="file_id")

    log.info(f"[OCR] Envoi du fichier {file_id} au service OCR...")

    try:
        response = requests.post(
            f"{OCR_SERVICE_URL}/ocr",
            json={"file_id": file_id},
            timeout=60
        )
        response.raise_for_status()
        result = response.json()
        extracted_text = result.get("text", "")
        confidence     = result.get("confidence", 0)

        log.info(f"[OCR] Texte extrait ({len(extracted_text)} chars, confiance={confidence:.2f})")

    except requests.exceptions.ConnectionError:
        log.warning("[OCR] Service OCR non disponible — utilisation du mock")
        extracted_text = """
            FACTURE N° 2024-001
            Fournisseur : ACME SAS
            SIRET : 12345678901234
            TVA : FR12345678901
            Date d'émission : 15/01/2024
            Montant HT : 1 000,00 €
            TVA 20% : 200,00 €
            Montant TTC : 1 200,00 €
        """
        confidence = 0.99  

    ctx["ti"].xcom_push(key="extracted_text", value=extracted_text)
    ctx["ti"].xcom_push(key="ocr_confidence", value=confidence)
    return {"text_length": len(extracted_text), "confidence": confidence}

def task_clean_zone(**ctx):
    ti             = ctx["ti"]
    file_id        = ti.xcom_pull(task_ids="ingestion",  key="file_id")
    extracted_text = ti.xcom_pull(task_ids="ocr",        key="extracted_text")
    confidence     = ti.xcom_pull(task_ids="ocr",        key="ocr_confidence")

    log.info(f"[CLEAN ZONE] Stockage texte OCR pour {file_id}")

    # TODO : vrai stockage MongoDB
    # db.clean.insert_one({
    #     "file_id": file_id,
    #     "text": extracted_text,
    #     "ocr_confidence": confidence,
    #     "processed_at": datetime.utcnow()
    # })

    log.info("[CLEAN ZONE] Texte OCR stocké")

def task_ner(**ctx):
    ti             = ctx["ti"]
    file_id        = ti.xcom_pull(task_ids="ingestion", key="file_id")
    extracted_text = ti.xcom_pull(task_ids="ocr",       key="extracted_text")

    log.info(f"[NER] Extraction des entités pour {file_id}...")

    try:
        response = requests.post(
            f"{NER_SERVICE_URL}/extract",
            json={"file_id": file_id, "text": extracted_text},
            timeout=30
        )
        response.raise_for_status()
        entities = response.json()

    except requests.exceptions.ConnectionError:
        log.warning("[NER] Service NER non disponible — utilisation du mock")
        entities = {
            "siret":           "12345678901234",
            "tva":             "FR12345678901",
            "montant_ht":      1000.00,
            "montant_tva":     200.00,
            "montant_ttc":     1200.00,
            "date_emission":   "2024-01-15",
            "date_expiration": None,
            "fournisseur":     "ACME SAS",
            "doc_type_detected": "facture"
        }

    log.info(f"[NER] Entités extraites : {json.dumps(entities, ensure_ascii=False)}")
    ctx["ti"].xcom_push(key="entities", value=entities)
    return entities


def task_validation(**ctx):
    from checker import validate_documents

    ti       = ctx["ti"]
    file_id  = ti.xcom_pull(task_ids="ingestion", key="file_id")
    doc_type = ti.xcom_pull(task_ids="ingestion", key="doc_type")
    entities = ti.xcom_pull(task_ids="ner",       key="entities")

    log.info(f"[VALIDATION] Vérification cohérence pour {file_id} (type={doc_type})")

    # TODO : en prod, récupérer les autres docs du même fournisseur depuis MongoDB
    # pour comparer les SIRETs entre documents
    # doc_sibling = db.curated.find_one({"siret": entities["siret"]})

    autres_docs = {
        "attestation_urssaf": {
            "siret": entities.get("siret"),          
            "date_expiration": "2025-12-31"
        },
        "kbis": {
            "date_expiration": "2025-06-01"
        }
    }

    result = validate_documents(entities, autres_docs.get("attestation_urssaf", {}), autres_docs.get("kbis", {}))

    if result["valid"]:
        log.info("[VALIDATION] Document valide — aucune anomalie détectée")
    else:
        log.warning(f"[VALIDATION] {len(result['errors'])} anomalie(s) détectée(s)")
        for err in result["errors"]:
            log.warning(f"  → [{err['type']}] {err['message']}")

    ctx["ti"].xcom_push(key="validation_result", value=result)
    return result


def task_curated_zone(**ctx):
    ti                = ctx["ti"]
    file_id           = ti.xcom_pull(task_ids="ingestion",  key="file_id")
    entities          = ti.xcom_pull(task_ids="ner",        key="entities")
    validation_result = ti.xcom_pull(task_ids="validation", key="validation_result")

    log.info(f"[CURATED ZONE] Stockage données structurées pour {file_id}")

    curated_doc = {
        "file_id":    file_id,
        "entities":   entities,
        "validation": validation_result,
        "status":     "valid" if validation_result["valid"] else "anomalie",
        "curated_at": datetime.utcnow().isoformat()
    }

    # TODO : vrai stockage MongoDB
    # db.curated.insert_one(curated_doc)

    log.info(f"[CURATED ZONE] Document curé avec statut : {curated_doc['status']}")
    ctx["ti"].xcom_push(key="curated_doc", value=curated_doc)


def task_fill_crm(**ctx):
    ti       = ctx["ti"]
    entities = ti.xcom_pull(task_ids="ner",         key="entities")
    file_id  = ti.xcom_pull(task_ids="ingestion",   key="file_id")

    log.info(f"[CRM] Auto-remplissage fiche fournisseur pour {file_id}")

    payload = {
        "file_id":     file_id,
        "fournisseur": entities.get("fournisseur"),
        "siret":       entities.get("siret"),
        "tva":         entities.get("tva"),
        "montant_ttc": entities.get("montant_ttc"),
        "date":        entities.get("date_emission"),
    }

    try:
        response = requests.post(
            f"{API_BACKEND_URL}/crm/fill",
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        log.info("[CRM] Fiche fournisseur remplie automatiquement")

    except requests.exceptions.ConnectionError:
        log.warning("[CRM]  API backend non disponible (mock) — payload prêt :")
        log.warning(json.dumps(payload, ensure_ascii=False, indent=2))


def task_fill_conformite(**ctx):
    ti                = ctx["ti"]
    file_id           = ti.xcom_pull(task_ids="ingestion",  key="file_id")
    entities          = ti.xcom_pull(task_ids="ner",        key="entities")
    validation_result = ti.xcom_pull(task_ids="validation", key="validation_result")

    log.info(f"[CONFORMITÉ] Envoi du rapport de conformité pour {file_id}")

    payload = {
        "file_id":  file_id,
        "siret":    entities.get("siret"),
        "valid":    validation_result["valid"],
        "errors":   validation_result.get("errors", []),
        "warnings": validation_result.get("warnings", []),
        "checked_at": datetime.utcnow().isoformat()
    }

    try:
        response = requests.post(
            f"{API_BACKEND_URL}/conformite/fill",
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        log.info("[CONFORMITÉ] Rapport de conformité envoyé")

    except requests.exceptions.ConnectionError:
        log.warning("[CONFORMITÉ] API backend non disponible (mock) — payload prêt :")
        log.warning(json.dumps(payload, ensure_ascii=False, indent=2))


with DAG(
    dag_id="pipeline_documents",
    description="Pipeline complet traitement documents administratifs",
    default_args=DEFAULT_ARGS,
    start_date=days_ago(1),
    schedule=None,          
    catchup=False,
    tags=["docuflow", "orchestration", "documents"],
) as dag:

    t_ingestion   = PythonOperator(task_id="ingestion",    python_callable=task_ingestion)
    t_raw         = PythonOperator(task_id="raw_zone",     python_callable=task_raw_zone)
    t_ocr         = PythonOperator(task_id="ocr",          python_callable=task_ocr)
    t_clean       = PythonOperator(task_id="clean_zone",   python_callable=task_clean_zone)
    t_ner         = PythonOperator(task_id="ner",          python_callable=task_ner)
    t_validation  = PythonOperator(task_id="validation",   python_callable=task_validation)
    t_curated     = PythonOperator(task_id="curated_zone", python_callable=task_curated_zone)

    t_crm         = PythonOperator(task_id="fill_crm",        python_callable=task_fill_crm)
    t_conformite  = PythonOperator(task_id="fill_conformite",  python_callable=task_fill_conformite)

    (
        t_ingestion
        >> t_raw
        >> t_ocr
        >> t_clean
        >> t_ner
        >> t_validation
        >> t_curated
        >> [t_crm, t_conformite]  
    )