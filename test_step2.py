from database_manager import MongoDataLake
# Remplace par l'ID affiché à l'étape précédente (sous forme de string)
from bson import ObjectId

db = MongoDataLake()
# On simule l'ID récupéré à l'étape 1
mon_id_raw = ObjectId("69b8256ee3ae2a57d5cfbfb7") 

clean_id = db.save_to_clean(mon_id_raw, "Ceci est le texte extrait par l'IA...")
print(f"Texte stocké avec succès dans Clean Zone. ID : {clean_id}")