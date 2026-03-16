from database_manager import MongoDataLake

db = MongoDataLake()
# On envoie le fichier
file_id = db.upload_to_raw("test-facture.pdf", "facture_001.pdf")
print(f"ID du fichier stocké : {file_id}")