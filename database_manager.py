import os
from pathlib import Path
from pymongo import MongoClient
from gridfs import GridFS
from dotenv import load_dotenv
from datetime import datetime

# =================================================================
# 1. CLASSE PRINCIPALE : GESTION DU DATA LAKE
# =================================================================

class MongoDataLake:
    def __init__(self):
        """
        Initialise la connexion à MongoDB Atlas en utilisant le fichier .env
        """
        # Chargement des variables d'environnement
        load_dotenv() 
        
        # Récupération de l'URI
        self.uri = os.getenv("MONGO_URI")
        
        # Vérification de sécurité
        if not self.uri:
            raise ValueError("Erreur : MONGO_URI est introuvable. Vérifie ton fichier .env !")
            
        print(f"Tentative de connexion à Atlas...")
        
        # Initialisation du client et de la base de données
        self.client = MongoClient(self.uri)
        self.db = self.client['document_processor_datalake']
        
        # Initialisation de GridFS pour la RAW ZONE (fichiers binaires)
        self.fs = GridFS(self.db, collection="raw_documents")
        
        # Accès aux collections JSON
        self.clean_zone = self.db["clean_zone"]    # Zone de stockage texte (OCR)
        self.curated_zone = self.db["curated_zone"] # Zone de stockage structuré (Final)

    # =================================================================
    # 2. CONFIGURATION DE LA STRUCTURE (A LANCER UNE FOIS)
    # =================================================================

    def setup_database(self):
        """
        Configure les Index (Vitesse) et le Schéma de Validation (Sécurité).
        """
        # --- INDEXATION ---
        self.clean_zone.create_index([("raw_file_id", 1)])
        self.curated_zone.create_index([("data.siret", 1)])
        self.curated_zone.create_index([("raw_file_id", 1)])
        print("Indexation terminée : Les recherches seront instantanées.")

        # --- VALIDATION (JSON Schema) ---
        validation_schema = {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["raw_file_id", "data", "is_validated"],
                "properties": {
                    "data": {
                        "bsonType": "object",
                        "required": ["siret", "total_ttc"],
                        "properties": {
                            "siret": {
                                "bsonType": "string",
                                "pattern": "^[0-9]{14}$",
                                "description": "Le SIRET doit comporter exactement 14 chiffres."
                            }
                        }
                    }
                }
            }
        }

        try:
            self.db.command("collMod", "curated_zone", validator=validation_schema)
        except:
            self.db.create_collection("curated_zone", validator=validation_schema)
        
        print("Schéma de validation activé : La zone Curated est sécurisée.")

    # =================================================================
    # 3. GESTION DU PIPELINE DE DONNÉES
    # =================================================================

    def upload_to_raw(self, file_path, file_name):
        """ZONE 1 (RAW) : Stockage du PDF/Image original."""
        with open(file_path, 'rb') as f:
            file_id = self.fs.put(
                f, 
                filename=file_name, 
                upload_date=datetime.now()
            )
        print(f"[RAW] Document '{file_name}' archivé. ID: {file_id}")
        return file_id

    def save_to_clean(self, file_id, raw_text):
        """ZONE 2 (CLEAN) : Stockage du texte extrait (OCR)."""
        clean_doc = {
            "raw_file_id": file_id,
            "extracted_text": raw_text,
            "ocr_engine": "Tesseract-v5",
            "processed_at": datetime.now()
        }
        return self.clean_zone.insert_one(clean_doc).inserted_id

    def save_to_curated(self, file_id, structured_data):
        """ZONE 3 (CURATED) : Stockage des données JSON finales validées."""
        curated_doc = {
            "raw_file_id": file_id,
            "data": structured_data,
            "is_validated": True,
            "compliance_status": "pending",
            "last_update": datetime.now()
        }
        return self.curated_zone.insert_one(curated_doc).inserted_id

# =================================================================
# 4. INTERFACE POUR L'ORCHESTRATEUR (AIRFLOW)
# =================================================================

class DataLakeInterface:
    def __init__(self):
        self.lake = MongoDataLake()

    def step_1_ingest(self, path, name):
        return self.lake.upload_to_