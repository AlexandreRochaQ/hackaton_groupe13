from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago
import requests
import logging
import json
import os
from datetime import datetime, timedelta

MONGO_URI       = os.getenv("MONGO_URI", "mongodb+srv://bvoguie_db_user:Umbrella@cluster0.egsznkn.mongodb.net/?appName=Cluster0")
MONGO_DB        = "document_processor_datalake"
OCR_SERVICE_URL = "http://ocr-service:5001"
NER_SERVICE_URL = "http://ner-service:8001"
API_BACKEND_URL = "http://api-backend:4000"

DEFAULT_ARGS = {
    "owner": "role7-orchestration",
    "depends_on_past": False,
    "retries": 2,
    "retry_delay": timedelta(seconds=30),
    "email_on_failure": False,
}

log = logging.getLogger(__name__)

def get_mongo_db():
    from pymongo import MongoClient
    client = MongoClient(MONGO_URI)
    return client[MONGO_DB]

def task_ingestion(**ctx):
    conf     = ctx["dag_run"].conf or {}
    file_id  = conf.get("file_id",  "DEMO_FILE_001")
    filename = conf.get("filename", "facture_demo.pdf")
    doc_type = conf.get("doc_type", "inconnu")

    log.info(f"[INGESTION] Nouveau document reçu : {filename} (id={file_id}, type={doc_type})")
    ctx["ti"].xcom_push(key="file_id",  value=file_id)
    ctx["ti"].xcom_push(key="filename", value=filename)
    ctx["ti"].xcom_push(key="doc_type", value=doc_type)
    log.info("[INGESTION] Métadonnées transmises au pipeline")
    return {"file_id": file_id, "filename": filename, "doc_type": doc_type}


def task_raw_zone(**ctx):
    from gridfs import GridFS

    ti       = ctx["ti"]
    file_id  = ti.xcom_pull(task_ids="ingestion", key="file_id")
    filename = ti.xcom_pull(task_ids="ingestion", key="filename")
    file_path = f"/opt/airflow/uploads/{filename}"

    log.info(f"[RAW ZONE] Stockage brut du fichier {filename}")

    try:
        db = get_mongo_db()
        fs = GridFS(db, collection="raw_documents")

        existing = fs.find_one({"filename": filename})
        if existing:
            mongo_id = str(existing._id)
            log.info(f"[RAW ZONE] Document déjà présent (id={mongo_id})")
        else:
            with open(file_path, "rb") as f:
                mongo_id = str(fs.put(
                    f,
                    filename=filename,
                    file_id=file_id,
                    upload_date=datetime.utcnow()
                ))
            log.info(f"[RAW ZONE] Document archivé dans GridFS (id={mongo_id})")

        ctx["ti"].xcom_push(key="mongo_raw_id", value=mongo_id)

    except Exception as e:
        log.warning(f"[RAW ZONE] MongoDB indisponible ({e}) — on continue")
        ctx["ti"].xcom_push(key="mongo_raw_id", value=None)

    ctx["ti"].xcom_push(key="raw_stored", value=True)


def task_ocr(**ctx):
    ti       = ctx["ti"]
    file_id  = ti.xcom_pull(task_ids="ingestion", key="file_id")
    filename = ti.xcom_pull(task_ids="ingestion", key="filename")
    file_path = f"/opt/airflow/uploads/{filename}"

    log.info(f"[OCR] Envoi du fichier {filename} au service OCR...")

    try:
        with open(file_path, "rb") as f:
            response = requests.post(
                f"{OCR_SERVICE_URL}/ocr",
                files={"file": (filename, f, "application/pdf")},
                timeout=60
            )
        response.raise_for_status()
        result         = response.json()
        extracted_text = result.get("text", "")
        confidence     = result.get("confidence", 0)
        log.info(f"[OCR] Texte extrait ({len(extracted_text)} chars, confiance={confidence:.2f})")

    except (FileNotFoundError, requests.exceptions.ConnectionError) as e:
        log.warning(f"[OCR] Service indisponible ({type(e).__name__}) — mock")
        extracted_text = """
            FACTURE N° 2024-001
            Fournisseur : ACME SAS
            SIRET : 12345678901234
            TVA : FR12345678901
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
    file_id        = ti.xcom_pull(task_ids="ingestion", key="file_id")
    mongo_raw_id   = ti.xcom_pull(task_ids="raw_zone",  key="mongo_raw_id")
    extracted_text = ti.xcom_pull(task_ids="ocr",       key="extracted_text")
    confidence     = ti.xcom_pull(task_ids="ocr",       key="ocr_confidence")

    log.info(f"[CLEAN ZONE] Stockage texte OCR pour {file_id}")

    try:
        db = get_mongo_db()
        clean_doc = {
            "file_id":        file_id,
            "raw_file_id":    mongo_raw_id,
            "extracted_text": extracted_text,
            "ocr_confidence": confidence,
            "ocr_engine":     "Tesseract-v5",
            "processed_at":   datetime.utcnow()
        }
        db["clean_zone"].update_one(
            {"file_id": file_id},
            {"$set": clean_doc},
            upsert=True
        )
        log.info("[CLEAN ZONE] Texte OCR stocké dans MongoDB Atlas")

    except Exception as e:
        log.warning(f"[CLEAN ZONE] MongoDB indisponible ({e}) — on continue")


def task_ner(**ctx):
    ti             = ctx["ti"]
    file_id        = ti.xcom_pull(task_ids="ingestion", key="file_id")
    extracted_text = ti.xcom_pull(task_ids="ocr",       key="extracted_text")

    log.info(f"[NER] Extraction des entités pour {file_id}...")

    try:
        response = requests.post(
            f"{NER_SERVICE_URL}/extract",
            json={"document_id": file_id, "text": extracted_text},
            timeout=30
        )
        response.raise_for_status()
        entities = response.json()

    except requests.exceptions.ConnectionError:
        log.warning("[NER] Service NER non disponible — mock")
        entities = {
            "document_id":   file_id,
            "document_type": "facture",
            "company_name":  "ACME SAS",
            "siret":         "12345678901234",
            "vat":           "FR12345678901",
            "amount_ht":     1000.00,
            "amount_ttc":    1200.00,
            "issue_date":    "2024-01-15",
            "expiration_date": None,
            "confidence":    0.99,
            "anomalies":     []
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

    facture = {
        "siret":         entities.get("siret"),
        "tva":           entities.get("vat"),
        "montant_ttc":   entities.get("amount_ttc"),
        "date_emission": entities.get("issue_date"),
    }

    autres_docs = {
        "attestation_urssaf": {
            "siret":           entities.get("siret"),
            "date_expiration": "2026-12-31"
        },
        "kbis": {
            "date_expiration": "2026-12-31"
        }
    }

    result = validate_documents(
        facture,
        autres_docs["attestation_urssaf"],
        autres_docs["kbis"]
    )

    for anomalie in entities.get("anomalies", []):
        result["errors"].append({"type": "NER_ANOMALY", "message": anomalie})
    result["valid"] = len(result["errors"]) == 0

    if result["valid"]:
        log.info("[VALIDATION] Document valide — aucune anomalie")
    else:
        log.warning(f"[VALIDATION] {len(result['errors'])} anomalie(s)")
        for err in result["errors"]:
            log.warning(f"  → [{err['type']}] {err['message']}")

    ctx["ti"].xcom_push(key="validation_result", value=result)
    return result

def task_curated_zone(**ctx):
    ti                = ctx["ti"]
    file_id           = ti.xcom_pull(task_ids="ingestion",  key="file_id")
    mongo_raw_id      = ti.xcom_pull(task_ids="raw_zone",   key="mongo_raw_id")
    entities          = ti.xcom_pull(task_ids="ner",        key="entities")
    validation_result = ti.xcom_pull(task_ids="validation", key="validation_result")

    status = "valid" if validation_result["valid"] else "anomalie"
    log.info(f"[CURATED ZONE] Stockage données structurées pour {file_id} — statut: {status}")

    try:
        db = get_mongo_db()
        curated_doc = {
            "file_id":           file_id,
            "raw_file_id":       mongo_raw_id,
            "is_validated":      validation_result["valid"],
            "compliance_status": status,
            "data": {
                "siret":         entities.get("siret"),
                "company_name":  entities.get("company_name"),
                "vat":           entities.get("vat"),
                "total_ttc":     entities.get("amount_ttc") or 0.0,
                "amount_ht":     entities.get("amount_ht"),
                "issue_date":    entities.get("issue_date"),
                "document_type": entities.get("document_type"),
                "confidence":    entities.get("confidence"),
                "anomalies":     entities.get("anomalies", []),
                "errors":        validation_result.get("errors", []),
            },
            "last_update": datetime.utcnow()
        }

        db["curated_zone"].update_one(
            {"file_id": file_id},
            {"$set": curated_doc},
            upsert=True
        )
        log.info(f"[CURATED ZONE] Données stockées dans MongoDB Atlas — statut: {status}")

    except Exception as e:
        log.warning(f"[CURATED ZONE] MongoDB indisponible ({e}) — on continue")

    ctx["ti"].xcom_push(key="curated_doc", value={"file_id": file_id, "status": status})


def task_fill_crm(**ctx):
    ti       = ctx["ti"]
    entities = ti.xcom_pull(task_ids="ner",       key="entities")
    file_id  = ti.xcom_pull(task_ids="ingestion", key="file_id")

    log.info(f"[CRM] Auto-remplissage fiche fournisseur pour {file_id}")

    payload = {
        "file_id":     file_id,
        "fournisseur": entities.get("company_name"),
        "siret":       entities.get("siret"),
        "tva":         entities.get("vat"),
        "montant_ttc": entities.get("amount_ttc"),
        "date":        entities.get("issue_date"),
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
        log.warning("[CRM] API backend non disponible — payload prêt :")
        log.warning(json.dumps(payload, ensure_ascii=False, indent=2))


def task_fill_conformite(**ctx):
    ti                = ctx["ti"]
    file_id           = ti.xcom_pull(task_ids="ingestion",  key="file_id")
    entities          = ti.xcom_pull(task_ids="ner",        key="entities")
    validation_result = ti.xcom_pull(task_ids="validation", key="validation_result")

    log.info(f"[CONFORMITÉ] Envoi rapport de conformité pour {file_id}")

    payload = {
        "file_id":    file_id,
        "siret":      entities.get("siret"),
        "valid":      validation_result["valid"],
        "errors":     validation_result.get("errors", []),
        "anomalies":  entities.get("anomalies", []),
        "confidence": entities.get("confidence", 0),
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
        log.warning("[CONFORMITÉ] API backend non disponible — payload prêt :")
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

    t_ingestion  = PythonOperator(task_id="ingestion",      python_callable=task_ingestion)
    t_raw        = PythonOperator(task_id="raw_zone",        python_callable=task_raw_zone)
    t_ocr        = PythonOperator(task_id="ocr",             python_callable=task_ocr)
    t_clean      = PythonOperator(task_id="clean_zone",      python_callable=task_clean_zone)
    t_ner        = PythonOperator(task_id="ner",             python_callable=task_ner)
    t_validation = PythonOperator(task_id="validation",      python_callable=task_validation)
    t_curated    = PythonOperator(task_id="curated_zone",    python_callable=task_curated_zone)
    t_crm        = PythonOperator(task_id="fill_crm",        python_callable=task_fill_crm)
    t_conformite = PythonOperator(task_id="fill_conformite", python_callable=task_fill_conformite)

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