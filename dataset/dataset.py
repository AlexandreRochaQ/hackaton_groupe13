import os
import random
import subprocess
from datetime import datetime, timedelta
from faker import Faker
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw
import numpy as np

fake = Faker("fr_FR")

BASE_DIR = "dataset"
SCENARIOS = ["legit", "fake_siret", "fake_amount", "expired", "scan"]

for folder in ["train", "test"]:
    for scenario in SCENARIOS:
        os.makedirs(f"{BASE_DIR}/{folder}/{scenario}", exist_ok=True)


def luhn_checksum(siret_base):
    """Calcule la clé de Luhn pour un SIRET valide."""
    digits = [int(d) for d in siret_base]
    for i in range(1, len(digits), 2):
        digits[i] *= 2
        if digits[i] > 9:
            digits[i] -= 9
    total = sum(digits)
    return (10 - (total % 10)) % 10


def generate_valid_siret():
    """Génère un SIRET avec clé de contrôle valide."""
    siren = ''.join([str(random.randint(0, 9)) for _ in range(8)])
    siren += str(luhn_checksum(siren))
    nic = ''.join([str(random.randint(0, 9)) for _ in range(4)])
    siret_base = siren + nic
    return siret_base + str(luhn_checksum(siret_base))


def generate_invalid_siret():
    """Génère un SIRET avec clé de contrôle INVALIDE."""
    valid = generate_valid_siret()
    # Altère le dernier chiffre pour casser la clé
    last_digit = int(valid[-1])
    fake_digit = (last_digit + random.randint(1, 9)) % 10
    return valid[:-1] + str(fake_digit)


def generate_data(scenario="legit"):
    today = datetime.now()
    
    data = {
        "company": fake.company(),
        "address": fake.address().replace("\n", ", "),
        "siret": generate_valid_siret(),
        "client": fake.name(),
        "client_address": fake.address().replace("\n", ", "),
        "invoice_num": f"FA-{random.randint(1000, 9999)}-{today.year}",
        "date": today.strftime("%d/%m/%Y"),
        "due_date": (today + timedelta(days=30)).strftime("%d/%m/%Y"),
        "items": [],
        "tva": 0.2
    }
    
    # Génère 1 à 5 lignes de facturation
    for _ in range(random.randint(1, 5)):
        data["items"].append({
            "desc": fake.bs().capitalize(),
            "qty": random.randint(1, 10),
            "unit_price": random.randint(50, 500)
        })
    
    # Applique les anomalies selon le scénario
    if scenario == "fake_siret":
        data["siret"] = generate_invalid_siret()
    
    elif scenario == "fake_amount":
        # Montants incohérents (TVA mal calculée ou total erroné)
        data["fake_total"] = True
    
    elif scenario == "expired":
        # Date très ancienne
        old_date = today - timedelta(days=random.randint(365*3, 365*5))
        data["date"] = old_date.strftime("%d/%m/%Y")
        data["due_date"] = (old_date + timedelta(days=30)).strftime("%d/%m/%Y")
    
    return data


def create_pdf(data, filename, scenario="legit"):
    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4
    
    # En-tête entreprise
    c.setFont("Helvetica-Bold", 16)
    c.drawString(2*cm, height - 2*cm, data["company"])
    c.setFont("Helvetica", 10)
    c.drawString(2*cm, height - 2.6*cm, data["address"][:50])
    c.drawString(2*cm, height - 3.1*cm, f"SIRET : {data['siret']}")
    
    # Titre FACTURE
    c.setFont("Helvetica-Bold", 24)
    c.drawString(width - 6*cm, height - 2.5*cm, "FACTURE")
    c.setFont("Helvetica", 10)
    c.drawString(width - 6*cm, height - 3.2*cm, f"N° {data['invoice_num']}")
    c.drawString(width - 6*cm, height - 3.7*cm, f"Date : {data['date']}")
    c.drawString(width - 6*cm, height - 4.2*cm, f"Échéance : {data['due_date']}")
    
    # Client
    c.setFont("Helvetica-Bold", 11)
    c.drawString(width - 8*cm, height - 6*cm, "Facturé à :")
    c.setFont("Helvetica", 10)
    c.drawString(width - 8*cm, height - 6.5*cm, data["client"])
    c.drawString(width - 8*cm, height - 7*cm, data["client_address"][:40])
    
    # Tableau des prestations
    y = height - 9*cm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(2*cm, y, "Description")
    c.drawString(10*cm, y, "Qté")
    c.drawString(12*cm, y, "P.U. HT")
    c.drawString(15*cm, y, "Total HT")
    
    c.line(2*cm, y - 0.3*cm, width - 2*cm, y - 0.3*cm)
    
    y -= 0.8*cm
    c.setFont("Helvetica", 10)
    total_ht = 0
    
    for item in data["items"]:
        line_total = item["qty"] * item["unit_price"]
        total_ht += line_total
        
        c.drawString(2*cm, y, item["desc"][:35])
        c.drawString(10*cm, y, str(item["qty"]))
        c.drawString(12*cm, y, f"{item['unit_price']} €")
        c.drawString(15*cm, y, f"{line_total} €")
        y -= 0.6*cm
    
    # Totaux
    y -= 1*cm
    c.line(12*cm, y + 0.5*cm, width - 2*cm, y + 0.5*cm)
    
    tva_amount = int(total_ht * data["tva"])
    total_ttc = total_ht + tva_amount
    
    # Anomalie fake_amount : erreur volontaire
    if scenario == "fake_amount" or data.get("fake_total"):
        displayed_ttc = total_ttc + random.randint(100, 500)  # Erreur
    else:
        displayed_ttc = total_ttc
    
    c.setFont("Helvetica", 10)
    c.drawString(12*cm, y, "Total HT :")
    c.drawString(15*cm, y, f"{total_ht} €")
    
    c.drawString(12*cm, y - 0.5*cm, f"TVA ({int(data['tva']*100)}%) :")
    c.drawString(15*cm, y - 0.5*cm, f"{tva_amount} €")
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(12*cm, y - 1.2*cm, "Total TTC :")
    c.drawString(15*cm, y - 1.2*cm, f"{displayed_ttc} €")
    
    # Pied de page
    c.setFont("Helvetica", 8)
    c.drawString(2*cm, 2*cm, "Conditions de paiement : 30 jours nets")
    c.drawString(2*cm, 1.5*cm, f"RIB : FR76 {random.randint(1000,9999)} {random.randint(1000,9999)} {random.randint(10000000000,99999999999)}")
    c.showPage()
    c.save()


def apply_scan_effect(image_path):
    """Applique des effets réalistes de scan."""
    img = Image.open(image_path).convert("RGB")
    
    # Rotation légère (désalignement)
    if random.random() > 0.3:
        angle = random.uniform(-3, 3)
        img = img.rotate(angle, fillcolor=(255, 255, 255), expand=True)
    
    # Flou gaussien
    if random.random() > 0.4:
        blur_radius = random.uniform(0.5, 2.5)
        img = img.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    
    # Variation de luminosité/contraste
    if random.random() > 0.3:
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(random.uniform(0.85, 1.15))
        
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(random.uniform(0.8, 1.2))
    
    # Bruit (grain de scan)
    if random.random() > 0.5:
        img_array = np.array(img)
        noise = np.random.normal(0, random.randint(5, 15), img_array.shape)
        img_array = np.clip(img_array + noise, 0, 255).astype(np.uint8)
        img = Image.fromarray(img_array)
    
    # Taches/marques (simule poussière ou pliures)
    if random.random() > 0.6:
        draw = ImageDraw.Draw(img)
        for _ in range(random.randint(1, 5)):
            x = random.randint(0, img.width)
            y = random.randint(0, img.height)
            r = random.randint(2, 8)
            gray = random.randint(180, 220)
            draw.ellipse([x-r, y-r, x+r, y+r], fill=(gray, gray, gray))
    
    # Jaunissement léger (vieux document)
    if random.random() > 0.7:
        img_array = np.array(img).astype(float)
        img_array[:, :, 0] = np.clip(img_array[:, :, 0] * 1.02, 0, 255)  # Rouge
        img_array[:, :, 2] = np.clip(img_array[:, :, 2] * 0.95, 0, 255)  # Bleu
        img = Image.fromarray(img_array.astype(np.uint8))
    
    return img


def generate_dataset(n=50, dataset_type="train"):
    poppler_path = r"C:\Users\HP\Downloads\Release-25.12.0-0\poppler-25.12.0\Library\bin\pdftoppm.exe"
    
    for i in range(n):
        scenario = random.choice(SCENARIOS)
        data = generate_data(scenario)
        
        filename_pdf = os.path.abspath(f"{BASE_DIR}/{dataset_type}/{scenario}/doc_{i}.pdf")
        create_pdf(data, filename_pdf, scenario)
        
        # Conversion en image pour scénario "scan"
        if scenario == "scan":
            output_path = os.path.splitext(filename_pdf)[0]
            
            result = subprocess.run([
                poppler_path,
                "-jpeg",
                "-r", "150",
                filename_pdf,
                output_path
            ], capture_output=True, text=True)

            print("STDOUT:", result.stdout)
            print("STDERR:", result.stderr)
            
            img_path = output_path + "-1.jpg"
            
            if os.path.exists(img_path):
                img = apply_scan_effect(img_path)
                final_path = filename_pdf.replace(".pdf", ".jpg")
                img.save(final_path, quality=random.randint(70, 90))
                
                if img_path != final_path:
                    os.remove(img_path)
                os.remove(filename_pdf)
            else:
                print(f"⚠️ Conversion échouée pour {filename_pdf}")


# Génération
generate_dataset(100, "train")
generate_dataset(30, "test")

print("✅ Dataset généré avec succès")
