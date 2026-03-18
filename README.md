# DocFlow — Plateforme Documentaire Intelligente

Traitement automatique de pièces comptables et administratives : OCR, extraction d'entités, vérification de cohérence inter-documents, et auto-remplissage d'applications métiers.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Frontend  │────▶│  API Backend │────▶│   OCR Service   │
│  React/Vite │     │  Node/Express│     │ Tesseract + LLM │
│  :3000      │     │  :4000       │     │  :5001          │
└─────────────┘     └──────┬───────┘     └────────┬────────┘
                           │                       │
                    ┌──────▼───────┐     ┌────────▼────────┐
                    │  NER Service │     │    Data Lake    │
                    │  FastAPI     │     │    MongoDB      │
                    │  :5002/8001  │     │  Raw/Clean/     │
                    └──────────────┘     │  Curated zones  │
                                         └─────────────────┘
                    ┌──────────────┐
                    │   Airflow    │  Pipeline orchestration
                    │   :8080      │  ingest → OCR → NER → validate
                    └──────────────┘
                    ┌──────────────┐
                    │    Ollama    │  LLM local (llama3.1 / qwen2.5)
                    │   :11434     │
                    └──────────────┘
```

## Services

| Service | Stack | Port | Rôle |
|---|---|---|---|
| `frontend/` | React 18, Vite, Tailwind | 3000 | Interface upload, révision, CRM, conformité |
| `backend/` | Node.js, Express | 4000 | BFF — routage API, agrégation, mock/real toggle |
| `ocr-service/` | Python, Flask, Tesseract | 5001 | OCR PDF/image → texte brut |
| `services/ner-service/` | Python, FastAPI, spaCy | 8001 (ext: 5002) | Extraction d'entités (SIRET, TVA, montants, dates) |
| `data-lake/` | Python, MongoDB, GridFS | 27017 | Stockage 3 zones : raw / clean / curated |
| `validation/` | Python | — | Vérification cohérence inter-documents |
| `dags/` | Airflow 2.9.1 | 8080 | Orchestration pipeline complet |

## Documents supportés

| Type | Champs extraits |
|---|---|
| Facture | SIRET, TVA, montant HT/TTC, date émission, fournisseur, acheteur |
| Devis | SIRET, TVA, montant HT/TTC, date émission, date validité |
| Extrait Kbis | Raison sociale, SIRET, forme juridique, capital, adresse, activité |
| Attestation URSSAF | SIRET, date émission, date expiration, statut |
| Attestation SIRET | SIRET, raison sociale, état administratif |
| RIB | IBAN, BIC, titulaire, banque |

## Démarrage

### Développement local (frontend + backend uniquement)

```bash
# Installer toutes les dépendances Node
npm run install:all

# Lancer frontend + backend en parallèle
npm run dev
```

Frontend : http://localhost:3000
Backend : http://localhost:4000

### Stack complète (Docker)

```bash
docker-compose up --build
```

| Interface | URL |
|---|---|
| Application | http://localhost:3000 |
| API Backend | http://localhost:4000 |
| Airflow | http://localhost:8080 (admin/admin) |
| Mongo Express | http://localhost:8081 |
| Ollama | http://localhost:11434 |

### Pipeline OCR en ligne de commande

```bash
# Installer les dépendances Python
pip install -r requirements.txt
python -m spacy download fr_core_news_sm

# Lancer le pipeline sur un dossier de documents
python main.py --input data/documents --output data/results

# Options
python main.py -i facture.pdf -o results/ --verbose --model qwen2.5
```

### Variables d'environnement

**`backend/.env`**
```
PORT=4000
USE_MOCK_SERVICES=true
MONGO_URI=mongodb://localhost:27017
OCR_SERVICE_URL=http://localhost:5001
NER_SERVICE_URL=http://localhost:5002
```

**Requis pour OCR local :**
```
TESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe
POPPLER_PATH=C:\chemin\vers\poppler\Library\bin
OLLAMA_URL=http://localhost:11434
```

## Structure du projet

```
hackaton_groupe13/
├── backend/                  Node.js BFF
│   ├── routes/               documents, extraction, validation, crm, compliance
│   └── mocks/                mock store + mock data (dev/demo)
├── frontend/                 React SPA
│   └── src/
│       ├── features/         upload, review, crm, compliance
│       ├── components/       Layout, Sidebar, StatusBadge, SkeletonCard
│       └── api/              clients Axios par domaine
├── ocr-service/              Flask + Tesseract
│   └── src/                  pipeline, ocr, llm_extractor, yolo_detector
├── services/
│   └── ner-service/          FastAPI + spaCy
│       └── app/              main, extractor, patterns, schemas
├── data-lake/                MongoDB 3 zones
│   └── data_lake_config/     mongo-init.js
├── validation/               checker.py — règles inter-documents
├── dags/                     Airflow DAG pipeline_documents
├── data/                     documents d'entrée et résultats
├── docs/                     rapports, captures, fichiers de référence
├── main.py                   CLI OCR pipeline (point d'entrée local)
├── requirements.txt          dépendances Python (tous services)
├── docker-compose.yaml       stack complète
└── package.json              scripts npm racine (dev, clean, install:all)
```

## Pipeline de traitement

```
Upload (PDF/image)
    ↓
OCR Service — Tesseract + LLM Ollama → texte brut
    ↓
NER Service — spaCy + regex → entités structurées (SIRET, TVA, montants, dates)
    ↓
Data Lake MongoDB
    ├── Raw zone    → fichier original (GridFS)
    ├── Clean zone  → texte OCR
    └── Curated zone → JSON structuré validé
    ↓
Validation inter-documents → incohérences SIRET, attestations expirées
    ↓
API Backend → CRM auto-rempli + Outil conformité
```

## Mock mode

Le backend peut fonctionner entièrement sans les services Python (utile pour le développement front-end) :

```
USE_MOCK_SERVICES=true  # dans backend/.env
```

En mode mock, le pipeline est simulé avec des données réalistes incluant des incohérences intentionnelles (SIRET mismatch, attestation expirée) pour démontrer les capacités de détection.

## Nettoyage

```bash
npm run clean
```

Supprime `node_modules/`, `dist/`, `__pycache__/`, `.ipynb_checkpoints/`, et les fichiers temporaires.
