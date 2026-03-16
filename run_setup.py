import sys
import os

# On ajoute le dossier actuel au chemin de recherche de Python
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database_manager import MongoDataLake

db = MongoDataLake()
db.setup_database()