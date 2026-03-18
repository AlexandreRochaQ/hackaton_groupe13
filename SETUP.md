# DocFlow — Setup local

## Prérequis

- [Node.js 18+](https://nodejs.org)
- [Python 3.11 ou 3.12](https://python.org) — **pas 3.14**, certaines dépendances ne le supportent pas encore
- Git

---

## Installation

```bash
git pull origin main
```

Copier le fichier d'environnement et remplir les valeurs :

```bash
cp .env.example .env
```

Ouvrir `.env` et remplacer `MONGO_URI` par la vraie URI MongoDB Atlas (demander à Youcef).
Les autres valeurs peuvent rester telles quelles pour tester en local.

---

## Démarrage

```bash
npm start
```

Ce script installe automatiquement toutes les dépendances (Node + Python) au premier lancement.

| Service  | URL                   |
|----------|-----------------------|
| Frontend | http://localhost:3000 |
| Backend  | http://localhost:3001 |
| OCR      | http://localhost:5001 |
| NER      | http://localhost:5002 |

---

## Notes

- Le service OCR retourne du texte simulé (Tesseract non requis pour tester).
- Le pipeline complet tourne : Upload → OCR → NER → Validation → Résultats.
- Nommer les fichiers uploadés avec des mots-clés pour que la détection fonctionne :
  `facture_...`, `kbis_...`, `urssaf_...`, `rib_...`, `devis_...`
