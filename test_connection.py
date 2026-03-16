import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Charger les variables depuis le .env
load_dotenv(dotenv_path="data_lake_config/.env")

def check_datalake_health():
    try:
        # 1. Test de connexion via l'URI sécurisée
        uri = os.getenv("MONGO_URI")
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        
        # 2. Vérification de la distribution (Replica Set)
        # La commande 'isMaster' confirme que tu es connecté à un cluster distribué
        status = client.admin.command("isMaster")
        
        print("--- Diagnostic Data Lake ---")
        print(f"Connexion réussie à : {status['me']}")
        
        if 'setName' in status:
            print(f"Distribution : Connecté au Replica Set '{status['setName']}' (Haute Disponibilité OK)")
        
        # 3. Test des droits RBAC (Ecriture simple)
        db = client['document_processor_datalake']
        db.health_check.insert_one({"status": "ready", "timestamp": "2026-03-16"})
        print("Droits RBAC : Ecriture autorisée sur la zone Curated.")
        
    except Exception as e:
        print(f"Erreur de configuration : {e}")

if __name__ == "__main__":
    check_datalake_health()