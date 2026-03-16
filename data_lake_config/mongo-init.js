// mongo-init.js

// 1. Sélection de la base de données
db = db.getSiblingDB('document_processor_datalake');

// 2. Création de la Clean Zone (Texte OCR)
db.createCollection('clean_zone');
db.clean_zone.createIndex({ "raw_file_id": 1 });

// 3. Création de la Curated Zone avec le validateur de schéma
db.createCollection('curated_zone', {
   validator: {
      $jsonSchema: {
         bsonType: "object",
         required: ["raw_file_id", "data", "is_validated"],
         properties: {
            raw_file_id: {
               bsonType: "objectId",
               description: "Doit être un ObjectId valide lié à la Raw Zone"
            },
            data: {
               bsonType: "object",
               required: ["siret", "total_ttc"],
               properties: {
                  siret: {
                     bsonType: "string",
                     pattern: "^[0-9]{14}$",
                     description: "Le SIRET doit comporter exactement 14 chiffres"
                  },
                  total_ttc: {
                     bsonType: "double",
                     description: "Le montant doit être un nombre décimal"
                  }
               }
            },
            is_validated: {
               bsonType: "bool",
               description: "Indicateur de fin de traitement"
            }
         }
      }
   }
});

// 4. Index de performance pour la Curated Zone
db.curated_zone.createIndex({ "data.siret": 1 });
db.curated_zone.createIndex({ "raw_file_id": 1 });

print("Initialisation du Data Lake terminée avec succès !");