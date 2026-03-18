import os
import random
import subprocess
import csv
import time
from datetime import datetime, timedelta
from faker import Faker
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw
import numpy as np
import requests

fake = Faker("fr_FR")

API_KEY = "d56af67c-06f2-45c7-aaf6-7c06f225c790"
BASE_DIR = "dataset"
SCENARIOS = ["legit", "fake_siret", "fake_amount", "expired", "scan"]

# Création dossiers
for folder in ["train", "test"]:
    for scenario in SCENARIOS:
        os.makedirs(f"{BASE_DIR}/{folder}/{scenario}", exist_ok=True)



# Recherches par nom d'entreprise (grandes enseignes et PME)
COMPANY_SEARCHES = [
    "carrefour",
    "leclerc",
    "auchan",
    "intermarche",
    "lidl",
    "orange",
    "bouygues",
    "sfr",
    "total",
    "engie",
    "edf",
    "sncf",
    "air france",
    "renault",
    "peugeot",
    "michelin",
    "danone",
    "nestle",
    "loreal",
    "lvmh",
    "capgemini",
    "sopra",
    "atos",
    "thales",
    "airbus",
    "dassault",
    "vinci",
    "bouygues construction",
    "eiffage",
    "veolia",
    "suez",
    "accor",
    "sodexo",
    "publicis",
    "havas",
    "fnac",
    "darty",
    "boulanger",
    "leroy merlin",
    "castorama",
    "decathlon",
    "go sport",
    "la poste",
    "chronopost",
    "ups france",
    "dhl",
    "fedex",
    "manpower",
    "adecco",
    "randstad",
]

# Recherches par code NAF (secteurs d'activité)
NAF_CODES = {
    "47.11F": "Hypermarchés",
    "62.01Z": "Programmation informatique",
    "62.02A": "Conseil en systèmes informatiques",
    "70.22Z": "Conseil en gestion",
    "41.20A": "Construction de bâtiments résidentiels",
    "41.20B": "Construction de bâtiments non résidentiels",
    "43.21A": "Travaux d'installation électrique",
    "56.10A": "Restauration traditionnelle",
    "56.10B": "Cafétérias",
    "55.10Z": "Hôtels",
    "49.41A": "Transports routiers de fret",
    "86.10Z": "Activités hospitalières",
    "85.20Z": "Enseignement primaire",
    "64.19Z": "Autres intermédiations monétaires",
    "66.12Z": "Courtage de valeurs mobilières",
    "68.20A": "Location de logements",
    "68.20B": "Location de terrains",
    "46.90Z": "Commerce de gros non spécialisé",
    "45.11Z": "Commerce de voitures",
    "73.11Z": "Activités des agences de publicité",
    "74.10Z": "Activités spécialisées de design",
    "71.12B": "Ingénierie",
    "69.10Z": "Activités juridiques",
    "69.20Z": "Activités comptables",
    "18.12Z": "Autre imprimerie",
    "25.62A": "Décolletage",
    "26.11Z": "Fabrication de composants électroniques",
    "28.11Z": "Fabrication de moteurs",
    "10.71A": "Fabrication industrielle de pain",
}

# Départements pour diversité géographique
DEPARTEMENTS = [
    "75",  # Paris
    "92",  # Hauts-de-Seine
    "69",  # Rhône (Lyon)
    "13",  # Bouches-du-Rhône (Marseille)
    "31",  # Haute-Garonne (Toulouse)
    "33",  # Gironde (Bordeaux)
    "59",  # Nord (Lille)
    "44",  # Loire-Atlantique (Nantes)
    "67",  # Bas-Rhin (Strasbourg)
    "06",  # Alpes-Maritimes (Nice)
    "34",  # Hérault (Montpellier)
    "35",  # Ille-et-Vilaine (Rennes)
]


# =============================================================================
# FONCTIONS SIRET
# =============================================================================
#Calcule le checksum de Luhn.
def luhn_checksum(s):
    
    digits = [int(d) for d in s]
    for i in range(0, len(digits), 2):
        digits[i] *= 2
        if digits[i] > 9:
            digits[i] -= 9
    return (10 - (sum(digits) % 10)) % 10

#Vérifie si un SIRET est valide.
def is_valid_siret(siret):
    
    if not siret or len(siret) != 14 or not siret.isdigit():
        return False
    total = 0
    for i, c in enumerate(siret):
        d = int(c)
        if i % 2 == 0:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0

#Génère un SIRET fictif valide
def generate_valid_siret():
    
    siren = ''.join(str(random.randint(0, 9)) for _ in range(8))
    siren += str(luhn_checksum(siren + '0'))
    nic = ''.join(str(random.randint(0, 9)) for _ in range(4))
    base = siren + nic
    for last in range(10):
        candidate = base + str(last)
        if is_valid_siret(candidate):
            return candidate
    return base + '0'


def generate_invalid_siret():
    """Génère un SIRET invalide."""
    valid = generate_valid_siret()
    last = int(valid[-1])
    fake_last = (last + random.randint(1, 9)) % 10
    return valid[:-1] + str(fake_last)


def generate_tva_intra(siren):
    """Génère un numéro de TVA intracommunautaire."""
    if len(siren) >= 9:
        siren_9 = siren[:9]
        cle = (12 + 3 * (int(siren_9) % 97)) % 97
        return f"FR {cle:02d} {siren_9}"
    return f"FR {random.randint(10, 99)} {random.randint(100000000, 999999999)}"


# =============================================================================
# API INSEE - RÉCUPÉRATION ENTREPRISES
# =============================================================================


BASE_URL = "https://api.insee.fr/api-sirene/3.11/siret"


def safe_request(params):
    headers = {
        "X-INSEE-Api-Key-Integration": API_KEY
    }

    try:
        res = requests.get(BASE_URL, headers=headers, params=params, timeout=10)

        if res.status_code == 200:
            return res.json()

        elif res.status_code == 429:
            print(" Rate limit atteint, pause...")
            time.sleep(2)
            return None

        else:
            print(f" Erreur API: {res.status_code}")
            return None

    except Exception as e:
        print(f" Exception API: {e}")
        return None



def fetch_companies_by_name(name, limit=10):
    params = {
        "q": f'denominationUniteLegale:{name}',
        "nombre": limit
    }

    data = safe_request(params)
    return parse_etablissements(data) if data else []



def fetch_companies_by_naf(naf_code, limit=15):
    params = {
       "q": f'activitePrincipaleUniteLegale:{naf_code}',
        "nombre": limit
    }

    data = safe_request(params)
    return parse_etablissements(data) if data else []




def fetch_companies_by_location(departement, limit=15):
    params = {
        "q": f'codePostalEtablissement:{departement}*',
        "nombre": limit
    }

    data = safe_request(params)
    return parse_etablissements(data) if data else []



def parse_etablissements(data):
    companies = []

    if not data:
        return companies

    for etab in data.get("etablissements", []):
        siret = etab.get("siret")
        if not siret or len(siret) != 14:
            continue

        unite = etab.get("uniteLegale", {})
        adresse = etab.get("adresseEtablissement", {})

        nom = (
            unite.get("denominationUniteLegale") or
            unite.get("denominationUsuelle1UniteLegale") or
            f"{unite.get('prenomUsuelUniteLegale','')} {unite.get('nomUniteLegale','')}".strip()
        )

        if not nom:
            continue

        rue = f"{adresse.get('numeroVoieEtablissement','')} {adresse.get('typeVoieEtablissement','')} {adresse.get('libelleVoieEtablissement','')}".strip()
        cp = adresse.get("codePostalEtablissement", "")
        ville = adresse.get("libelleCommuneEtablissement", "")

        full_address = f"{rue}, {cp} {ville}".strip(", ")

        companies.append({
            "siret": siret,
            "siren": etab.get("siren", siret[:9]),
            "company": nom.upper(),
            "address": full_address if full_address else fake.address().replace("\n", ", "),
            "cp": cp,
            "ville": ville,
            "naf": etab.get("activitePrincipaleEtablissement", ""),
        })

    return companies




def fetch_all_companies(max_total=300):
    all_companies = []
    seen = set()

    print("\n📡 Récupération entreprises...")

    #  Par nom
    for name in COMPANY_SEARCHES:
        if len(all_companies) >= max_total:
            break

        results = fetch_companies_by_name(name)

        for c in results:
            if c["siret"] not in seen:
                seen.add(c["siret"])
                all_companies.append(c)

        time.sleep(0.3)

    print(f"→ Après noms: {len(all_companies)}")

    # Par NAF
    for naf in list(NAF_CODES.keys())[:15]:
        if len(all_companies) >= max_total:
            break

        results = fetch_companies_by_naf(naf)

        for c in results:
            if c["siret"] not in seen:
                seen.add(c["siret"])
                all_companies.append(c)

        time.sleep(0.3)

    print(f"→ Après NAF: {len(all_companies)}")

    # Par département
    for dept in DEPARTEMENTS:
        if len(all_companies) >= max_total:
            break

        results = fetch_companies_by_location(dept)

        for c in results:
            if c["siret"] not in seen:
                seen.add(c["siret"])
                all_companies.append(c)

        time.sleep(0.3)

    print(f"Total final: {len(all_companies)} entreprises")

    return all_companies

def save_companies_to_csv(companies, filename="dataset_entreprises.csv"):
    """Sauvegarde les entreprises dans un fichier CSV."""
    with open(filename, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "siret", "siren", "nom", "adresse", "code_postal", 
            "ville", "naf", "tva_intra", "email", "telephone"
        ])
        
        for c in companies:
            writer.writerow([
                c["siret"],
                c["siren"],
                c["company"],
                c["address"],
                c.get("cp", ""),
                c.get("ville", ""),
                c.get("naf", ""),
                generate_tva_intra(c["siren"]),
                fake.company_email(),
                fake.phone_number()
            ])
    
    print(f" CSV sauvegardé: {filename}")


# =============================================================================
# RÉCUPÉRATION INITIALE
# =============================================================================

print(" Démarrage du générateur de factures\n")
REAL_COMPANIES = fetch_all_companies(max_total=300)

if REAL_COMPANIES:
    save_companies_to_csv(REAL_COMPANIES)
    
    # Statistiques
    print("\n Statistiques des entreprises récupérées:")
    villes = {}
    for c in REAL_COMPANIES:
        v = c.get("ville", "Inconnu")
        villes[v] = villes.get(v, 0) + 1
    
    top_villes = sorted(villes.items(), key=lambda x: -x[1])[:10]
    for ville, count in top_villes:
        print(f"   • {ville}: {count}")
else:
    print(" Aucune entreprise récupérée, utilisation de données fictives")




INVOICE_STYLES = [
    {
        "name": "classic",
        "primary": colors.HexColor("#2C3E50"),
        "secondary": colors.HexColor("#3498DB"),
        "accent": colors.HexColor("#E74C3C"),
        "bg": colors.HexColor("#ECF0F1")
    },
    {
        "name": "modern",
        "primary": colors.HexColor("#1A1A2E"),
        "secondary": colors.HexColor("#16213E"),
        "accent": colors.HexColor("#E94560"),
        "bg": colors.HexColor("#F5F5F5")
    },
    {
        "name": "corporate",
        "primary": colors.HexColor("#0D47A1"),
        "secondary": colors.HexColor("#1976D2"),
        "accent": colors.HexColor("#FF6F00"),
        "bg": colors.HexColor("#E3F2FD")
    },
    {
        "name": "elegant",
        "primary": colors.HexColor("#212121"),
        "secondary": colors.HexColor("#424242"),
        "accent": colors.HexColor("#C9A227"),
        "bg": colors.HexColor("#FAFAFA")
    },
    {
        "name": "fresh",
        "primary": colors.HexColor("#00695C"),
        "secondary": colors.HexColor("#00897B"),
        "accent": colors.HexColor("#FF5722"),
        "bg": colors.HexColor("#E0F2F1")
    }
]



# GÉNÉRATION DES DONNÉES

#Génère les données d'une facture.
def generate_data(scenario="legit"):
  
    today = datetime.now()
    style = random.choice(INVOICE_STYLES)
    
    # Sélection entreprise
    if REAL_COMPANIES and scenario != "fake_siret":
        company_data = random.choice(REAL_COMPANIES)
        siret = company_data["siret"]
        company = company_data["company"]
        address = company_data["address"]
        siren = company_data["siren"]
    else:
        siret = generate_valid_siret()
        company = fake.company()
        address = fake.address().replace("\n", ", ")
        siren = siret[:9]
    
    data = {
        "company": company,
        "address": address,
        "siret": siret,
        "tva_intra": generate_tva_intra(siren),
        "client": fake.name(),
        "client_company": fake.company() if random.random() > 0.4 else None,
        "client_address": fake.address().replace("\n", ", "),
        "invoice_num": f"FA-{today.year}-{random.randint(10000, 99999)}",
        "date": today.strftime("%d/%m/%Y"),
        "due_date": (today + timedelta(days=30)).strftime("%d/%m/%Y"),
        "items": [],
        "tva_rate": random.choice([0.055, 0.10, 0.20]),
        "style": style,
        "payment_method": random.choice([
            "Virement bancaire", "Chèque", "Carte bancaire", 
            "Prélèvement SEPA", "Espèces"
        ]),
        "iban": f"FR76 {random.randint(1000,9999)} {random.randint(1000,9999)} {random.randint(1000,9999)} {random.randint(1000,9999)} {random.randint(100,999)}",
        "bic": fake.lexify(text="????FR??XXX").upper()
    }
    
    # Lignes de facturation
    services = [
        "Prestation de conseil", "Développement logiciel", "Design graphique",
        "Formation professionnelle", "Maintenance", "Audit technique",
        "Marketing digital", "Rédaction", "Support client",
        "Gestion de projet", "Analyse de données", "Hébergement web",
        "Licence logicielle", "Location matériel", "Transport",
        "Installation", "Réparation", "Nettoyage", "Sécurité"
    ]
    
    for _ in range(random.randint(1, 5)):
        data["items"].append({
            "desc": random.choice(services),
            "qty": random.randint(1, 20),
            "unit": random.choice(["unité", "heure", "jour", "mois", "forfait"]),
            "unit_price": round(random.uniform(50, 800), 2)
        })
    
    # Anomalies
    if scenario == "fake_siret":
        data["siret"] = generate_invalid_siret()
    elif scenario == "fake_amount":
        data["fake_total"] = True
    elif scenario == "expired":
        old = today - timedelta(days=random.randint(800, 2000))
        data["date"] = old.strftime("%d/%m/%Y")
        data["due_date"] = (old + timedelta(days=30)).strftime("%d/%m/%Y")
    
    return data


#Création de pdf
  #Crée une facture PDF professionnelle.
def create_pdf(data, filename, scenario):
  
    c = canvas.Canvas(filename, pagesize=A4)
    w, h = A4
    style = data["style"]
    margin = 2 * cm
    
   
    c.setFillColor(style["bg"])
    c.rect(0, h - 4.5 * cm, w, 4.5 * cm, fill=True, stroke=False)
    
    c.setFillColor(style["primary"])
    c.rect(0, h - 0.5 * cm, w, 0.5 * cm, fill=True, stroke=False)
    

    c.setFillColor(style["primary"])
    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin, h - 2 * cm, data["company"][:40])
    
    c.setFillColor(colors.HexColor("#555555"))
    c.setFont("Helvetica", 9)
    c.drawString(margin, h - 2.5 * cm, data["address"][:60])
    c.drawString(margin, h - 2.9 * cm, f"SIRET: {data['siret']}  |  TVA: {data['tva_intra']}")
    
    # Titre FACTURE
    c.setFillColor(style["accent"])
    c.setFont("Helvetica-Bold", 24)
    c.drawRightString(w - margin, h - 1.8 * cm, "FACTURE")
    
    c.setFillColor(style["primary"])
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(w - margin, h - 2.5 * cm, f"N° {data['invoice_num']}")
    
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#666666"))
    c.drawRightString(w - margin, h - 3 * cm, f"Date: {data['date']}")
    c.drawRightString(w - margin, h - 3.4 * cm, f"Échéance: {data['due_date']}")
    
    # Client
    y_client = h - 6 * cm
    c.setStrokeColor(style["secondary"])
    c.setLineWidth(1.5)
    c.roundRect(w - 9 * cm, y_client - 2.2 * cm, 7 * cm, 2.7 * cm, 4, stroke=True, fill=False)
    
    c.setFillColor(style["primary"])
    c.setFont("Helvetica-Bold", 9)
    c.drawString(w - 8.7 * cm, y_client, "FACTURÉ À")
    
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.black)
    y_client -= 0.5 * cm
    
    if data["client_company"]:
        c.setFont("Helvetica-Bold", 9)
        c.drawString(w - 8.7 * cm, y_client, data["client_company"][:28])
        y_client -= 0.4 * cm
    
    c.setFont("Helvetica", 9)
    c.drawString(w - 8.7 * cm, y_client, data["client"])
    y_client -= 0.4 * cm
    c.drawString(w - 8.7 * cm, y_client, data["client_address"][:35])
    
    
    y_table = h - 9.5 * cm
    
    c.setFillColor(style["primary"])
    c.rect(margin, y_table - 0.6 * cm, w - 2 * margin, 0.8 * cm, fill=True, stroke=False)
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(margin + 0.3 * cm, y_table - 0.35 * cm, "DESCRIPTION")
    c.drawString(10.5 * cm, y_table - 0.35 * cm, "QTÉ")
    c.drawString(12.5 * cm, y_table - 0.35 * cm, "P.U. HT")
    c.drawString(15.5 * cm, y_table - 0.35 * cm, "TOTAL HT")
    
    y_line = y_table - 1.1 * cm
    total_ht = 0
    alternate = False
    
    for item in data["items"]:
        line_total = round(item["qty"] * item["unit_price"], 2)
        total_ht += line_total
        
        if alternate:
            c.setFillColor(colors.HexColor("#F5F5F5"))
            c.rect(margin, y_line - 0.2 * cm, w - 2 * margin, 0.55 * cm, fill=True, stroke=False)
        
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 9)
        c.drawString(margin + 0.3 * cm, y_line, item["desc"][:35])
        c.drawString(10.5 * cm, y_line, f"{item['qty']} {item['unit']}")
        c.drawString(12.5 * cm, y_line, f"{item['unit_price']:.2f} €")
        c.drawString(15.5 * cm, y_line, f"{line_total:.2f} €")
        
        y_line -= 0.55 * cm
        alternate = not alternate
    
  
    y_totals = y_line - 0.8 * cm
    
    tva_amount = round(total_ht * data["tva_rate"], 2)
    total_ttc = round(total_ht + tva_amount, 2)
    
    if scenario == "fake_amount" or data.get("fake_total"):
        total_ttc += random.randint(50, 350)
    
    c.setFillColor(colors.HexColor("#FAFAFA"))
    c.rect(12.5 * cm, y_totals - 1.8 * cm, w - 12.5 * cm - margin, 2.3 * cm, fill=True, stroke=False)
    
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 9)
    c.drawString(12.8 * cm, y_totals, "Total HT:")
    c.drawRightString(w - margin - 0.3 * cm, y_totals, f"{total_ht:.2f} €")
    
    c.drawString(12.8 * cm, y_totals - 0.5 * cm, f"TVA ({int(data['tva_rate']*100)}%):")
    c.drawRightString(w - margin - 0.3 * cm, y_totals - 0.5 * cm, f"{tva_amount:.2f} €")
    
    c.setFillColor(style["primary"])
    c.rect(12.5 * cm, y_totals - 1.5 * cm, w - 12.5 * cm - margin, 0.65 * cm, fill=True, stroke=False)
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(12.8 * cm, y_totals - 1.3 * cm, "TOTAL TTC:")
    c.drawRightString(w - margin - 0.3 * cm, y_totals - 1.3 * cm, f"{total_ttc:.2f} €")
    
  
    y_pay = y_totals - 3 * cm
    c.setFillColor(style["primary"])
    c.setFont("Helvetica-Bold", 9)
    c.drawString(margin, y_pay, "INFORMATIONS DE PAIEMENT")
    
    c.setStrokeColor(style["accent"])
    c.setLineWidth(2)
    c.line(margin, y_pay - 0.15 * cm, margin + 3.5 * cm, y_pay - 0.15 * cm)
    
    c.setFillColor(colors.HexColor("#444444"))
    c.setFont("Helvetica", 8)
    c.drawString(margin, y_pay - 0.55 * cm, f"Mode: {data['payment_method']}")
    c.drawString(margin, y_pay - 0.95 * cm, f"IBAN: {data['iban']}")
    c.drawString(margin, y_pay - 1.35 * cm, f"BIC: {data['bic']}")
    
    # Footer
    c.setFillColor(style["primary"])
    c.rect(0, 0, w, 1.2 * cm, fill=True, stroke=False)
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 6)
    c.drawCentredString(w / 2, 0.6 * cm, f"{data['company'][:35]} - SIRET {data['siret']} - {data['tva_intra']}")
    c.drawCentredString(w / 2, 0.25 * cm, "Pénalités de retard: 3x taux légal | Indemnité forfaitaire: 40€")
    
    c.save()


#Applique des effets de scan réalistes.
def apply_scan_effect(path):
    
    img = Image.open(path).convert("RGB")
    
    if random.random() > 0.3:
        img = img.rotate(random.uniform(-2.5, 2.5), fillcolor=(255, 255, 255), expand=True)
    
    if random.random() > 0.4:
        img = img.filter(ImageFilter.GaussianBlur(random.uniform(0.3, 1.2)))
    
    if random.random() > 0.3:
        img = ImageEnhance.Brightness(img).enhance(random.uniform(0.92, 1.08))
        img = ImageEnhance.Contrast(img).enhance(random.uniform(0.9, 1.1))
    
    if random.random() > 0.5:
        arr = np.array(img)
        noise = np.random.normal(0, random.randint(3, 10), arr.shape)
        arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr)
    
    if random.random() > 0.7:
        draw = ImageDraw.Draw(img)
        for _ in range(random.randint(1, 3)):
            x, y = random.randint(0, img.width), random.randint(0, img.height)
            r = random.randint(1, 4)
            gray = random.randint(200, 240)
            draw.ellipse([x-r, y-r, x+r, y+r], fill=(gray, gray, gray))
    
    return img


# =============================================================================
# GÉNÉRATION DATASET
# =============================================================================
#Génère le dataset de factures.
def generate_dataset(n=50, dataset_type="train"):
  
    poppler = r"C:\Users\HP\Downloads\Release-25.12.0-0\poppler-25.12.0\Library\bin\pdftoppm.exe"
    
    print(f"\n{'='*60}")
    print(f"  Génération {dataset_type.upper()}: {n} documents")
    print(f"{'='*60}")
    
    stats = {s: 0 for s in SCENARIOS}
    
    for i in range(n):
        scenario = random.choice(SCENARIOS)
        stats[scenario] += 1
        
        data = generate_data(scenario)
        pdf = os.path.abspath(f"{BASE_DIR}/{dataset_type}/{scenario}/invoice_{i:04d}.pdf")
        
        create_pdf(data, pdf, scenario)
        
        if scenario == "scan":
            base = os.path.splitext(pdf)[0]
            
            try:
                subprocess.run([poppler, "-jpeg", "-r", "150", pdf, base], 
                             capture_output=True, timeout=30)
                
                img_path = base + "-1.jpg"
                
                if os.path.exists(img_path):
                    img = apply_scan_effect(img_path)
                    final = pdf.replace(".pdf", ".jpg")
                    img.save(final, quality=random.randint(75, 92))
                    
                    if os.path.exists(img_path):
                        os.remove(img_path)
                    if os.path.exists(pdf):
                        os.remove(pdf)
            except Exception as e:
                print(f"   Erreur scan {i}: {e}")
        
        if (i + 1) % 25 == 0:
            print(f"  ✓ {i+1}/{n} générés...")
    
    print(f"\n Répartition {dataset_type}:")
    for scenario, count in stats.items():
        print(f"   • {scenario}: {count}")




if __name__ == "__main__":
    generate_dataset(100, "train")
    generate_dataset(30, "test")
    
    print("\n" + "=" * 60)
    print("  DATASET GÉNÉRÉ AVEC SUCCÈS !")
    print("=" * 60)
