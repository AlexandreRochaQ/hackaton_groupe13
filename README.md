# DocFlow — Plateforme Documentaire Intelligente

Traitement automatique de pièces comptables et administratives : OCR, extraction d'entités, vérification de cohérence inter-documents, et auto-remplissage d'applications métiers.

Déployable sur **Vercel** sans Docker ni dépendances locales — alimenté par **Groq API** et **MongoDB Atlas**.

---

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────┐
│   Frontend  │────▶│              API Backend (BFF)            │
│  React/Vite │     │           Node.js / Express               │
│  :3000      │     │  documents · extraction · validation      │
└─────────────┘     │  crm · compliance · datalake · logs       │
                    └──────┬──────────────────────┬────────────┘
                           │                      │
                  ┌────────▼────────┐   ┌─────────▼──────────┐
                  │   Groq API      │   │   MongoDB Atlas     │
                  │ llama-4-scout   │   │  Data Lake 3 zones  │
                  │ (vision/OCR)    │   │  raw / clean /      │
                  │ llama-3.3-70b   │   │  curated            │
                  │ (NER/extract)   │   └────────────────────┘
                  └─────────────────┘
```

### Data Lake — 3 zones MongoDB

```
Upload (PDF / image)
    ↓
raw_zone     → métadonnées fichier, type détecté, timestamp
    ↓
OCR (Groq Vision llama-4-scout  |  pdf-parse pour PDF natifs)
    ↓
clean_zone   → texte OCR brut par document
    ↓
Extraction NER (Groq llama-3.3-70b)
    ↓
curated_zone → JSON structuré validé (SIRET, TVA, montants, dates…)
    ↓
Validation inter-documents → incohérences SIRET, attestations expirées
    ↓
API Backend  → CRM auto-rempli + Outil de conformité
```

---

## Services

| Service | Stack | Port | Rôle |
|---|---|---|---|
| `frontend/` | React 18, Vite, Tailwind CSS | 3000 | Upload, révision, CRM, conformité, dashboard admin |
| `backend/` | Node.js 24, Express | 3001 | BFF — pipeline OCR/NER, Data Lake, routes API |
| **Groq API** | llama-4-scout + llama-3.3-70b | (externe) | OCR vision + extraction d'entités |
| **MongoDB Atlas** | MongoDB 7 | (externe) | Stockage 3 zones raw/clean/curated |

---

## Démarrage rapide

### Prérequis

- Node.js ≥ 18
- Compte [Groq](https://console.groq.com) (gratuit) — clé API
- Cluster [MongoDB Atlas](https://cloud.mongodb.com) (gratuit M0)

### Installation

```bash
# Cloner et installer toutes les dépendances
git clone https://github.com/AlexandreRochaQ/hackaton_groupe13
cd hackaton_groupe13
npm run install:all
```

### Variables d'environnement

Créer `.env` à la racine du projet :

```env
# Groq — supporte plusieurs clés séparées par virgule (rotation automatique)
GROQ_API_KEY=gsk_xxx,gsk_yyy

# MongoDB Atlas
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/
MONGO_DB=docuflow

# Backend
PORT=3001
```

### Lancement

```bash
npm run dev
```

| Interface | URL |
|---|---|
| Application | http://localhost:3000 |
| API Backend | http://localhost:3001 |
| Health check | http://localhost:3001/health |

---

## Rôles utilisateurs

| Rôle | Accès | Identifiant |
|---|---|---|
| **Opérateur** | Upload → Révision → CRM → Conformité | Sélectionner "Opérateur" sur la page d'accueil |
| **Administrateur** | Dashboard Data Lake, Historique, Logs pipeline | Sélectionner "Administrateur" sur la page d'accueil |

---

## Documents supportés

| Type | Champs extraits |
|---|---|
| Facture | SIRET, TVA, montant HT/TTC, date émission, fournisseur, acheteur |
| Devis | SIRET, TVA, montant HT/TTC, date émission, date validité |
| Extrait Kbis | Raison sociale, SIRET, forme juridique, capital, adresse, activité |
| Attestation URSSAF | SIRET, date émission, date expiration, statut |
| Attestation SIRET | SIRET, raison sociale, état administratif |
| RIB | IBAN, BIC, titulaire, banque |

Formats acceptés : **PDF, JPG, PNG, TIFF** — max 20 Mo par fichier.

---

## Fonctionnalités

### Opérateur

- **Upload multi-fichiers** — drag & drop avec overlay plein écran, barre de progression réelle
- **Révision & extraction** — panneau OCR avec indicateur de qualité, édition inline par champ, sélection multiple pour téléchargement ZIP
- **Classification automatique** — icône par type de document, barre de confiance colorée, badge "À classifier manuellement" si confiance < 50 %
- **Vérification inter-documents** — panel collapsible, liens visuels entre documents concernés
- **CRM fournisseur** — auto-remplissage animé champ par champ, historique des modifications avec annulation
- **Outil de conformité** — timeline des vérifications, section pièces manquantes, export PDF

### Administrateur

- **Vue d'ensemble** — 4 KPIs avec sparklines, diagramme pipeline
- **Data Lake** — visualisation en temps réel des 3 zones (raw / clean / curated)
- **Historique** — tableau paginé de tous les lots, filtre par statut, export CSV
- **Logs pipeline** — terminal dark avec polling toutes les 3s, pause/vider, filtre par niveau (INFO/WARN/ERROR)

---

## Structure du projet

```
hackaton_groupe13/
├── backend/                  Node.js BFF
│   ├── routes/               documents, extraction, validation, crm, compliance, datalake, logs
│   ├── services/
│   │   ├── groqService.js    OCR vision + NER via Groq API (multi-key rotation)
│   │   ├── batchStore.js     MongoDB Data Lake (raw/clean/curated + batches)
│   │   ├── fileBufferStore.js buffer in-memory pour téléchargement ZIP
│   │   ├── realPipeline.js   orchestration OCR → NER → validation
│   │   └── validationService.js vérifications cohérence inter-documents
│   └── app.js                point d'entrée Express
├── frontend/                 React 18 SPA
│   └── src/
│       ├── features/         upload, review, crm, compliance, admin, login
│       ├── components/       Layout, Sidebar, Toast, Tooltip, SkeletonCard, StatusBadge
│       ├── api/              clients Axios par domaine
│       └── utils/            formatters (SIRET, montant, date)
├── dags/                     Airflow DAGs (stack Docker optionnelle)
│   ├── pipeline_documents.py DAG principal ingest → OCR → NER → validate
│   └── checker.py            règles de vérification
├── vercel.json               configuration déploiement Vercel
├── .env                      variables d'environnement (ne pas committer)
└── package.json              scripts npm racine
```

---

## Déploiement Vercel

```bash
vercel --prod
```

Variables d'environnement à configurer dans le dashboard Vercel :

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Clé(s) Groq séparées par virgule |
| `MONGO_URI` | URI MongoDB Atlas |
| `MONGO_DB` | Nom de la base (ex: `docuflow`) |

---

## Stack Docker (optionnelle)

Pour les équipes souhaitant faire tourner la stack complète en local avec les anciens services Python :

```bash
docker-compose up --build
```

| Interface | URL |
|---|---|
| Application | http://localhost:3000 |
| API Backend | http://localhost:3001 |
| Airflow | http://localhost:8080 (admin/admin) |
| Mongo Express | http://localhost:8081 |

> La stack Node.js + Groq API fonctionne indépendamment de Docker.

---

## Scripts npm

```bash
npm run dev           # Lance frontend + backend en parallèle
npm run install:all   # Installe les dépendances frontend et backend
npm run clean         # Supprime node_modules/, dist/, fichiers temporaires
```

---

## Nettoyage

```bash
npm run clean
```

Supprime `node_modules/`, `dist/`, `__pycache__/`, `.ipynb_checkpoints/`, et les fichiers temporaires.
