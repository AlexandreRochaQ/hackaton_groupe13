from database_manager import MongoDataLake
from bson import ObjectId
import pymongo

db = MongoDataLake()
fake_id = ObjectId()

print("--- Test 1 : Envoi d'un SIRET faux (10 chiffres) ---")
try:
    db.save_to_curated(fake_id, {"siret": "1234567890", "total_ttc": 99.99})
    print("Erreur : La base a accepté un mauvais SIRET !")
except Exception as e:
    print(f"Succès : La sécurité a bloqué l'entrée. (Erreur attendue)")

print("\n--- Test 2 : Envoi d'un SIRET valide (14 chiffres) ---")
try:
    db.save_to_curated(fake_id, {"siret": "12345678901234", "total_ttc": 150.00})
    print("Succès : Données enregistrées dans la zone finale !")
except Exception as e:
    print(f"Erreur : La base a refusé des données valides. {e}")