#!/usr/bin/env python3
"""Quick visual comparison of before/after results."""

import json

print("=" * 60)
print("BEFORE vs AFTER - Key Fields Comparison")
print("=" * 60)

# Load old results
with open('data/results/KAOUTAR_CERTIFICAT DE SCOLARITÉ (1)_extracted.json', 'r', encoding='utf-8') as f:
    old = json.load(f)

# Load new results  
with open('data/results_improved/KAOUTAR_CERTIFICAT DE SCOLARITÉ (1)_extracted.json', 'r', encoding='utf-8') as f:
    new = json.load(f)

old_data = old['extracted_data'][0]
new_data = new['extracted_data'][0]

print("\n📋 NAME:")
print(f"   BEFORE: {old_data['additional_info'].get('nom', 'N/A')}")
print(f"   AFTER:  {new_data['additional_info'].get('nom_complet', 'N/A')}")

print("\n🔢 SIREN:")
print(f"   BEFORE: '{old_data.get('siren', 'N/A')}' (empty)")
print(f"   AFTER:  {new_data.get('siren', 'N/A')} ✓")

print("\n📞 PHONE:")
print(f"   BEFORE: {old_data['additional_info'].get('telephone', 'N/A')}")
print(f"   AFTER:  {new_data['additional_info']['coordonnées'].get('téléphone', 'N/A')}")

print("\n🎂 BIRTH DATE:")
print(f"   BEFORE: {old_data['additional_info'].get('date_de_naissance', 'N/A')}")
print(f"   AFTER:  {new_data['additional_info'].get('date_de_naissance', 'N/A')}")

print("\n🏠 ADDRESS:")
print(f"   BEFORE: {old_data['additional_info'].get('adresse', 'N/A')}")
addr = new_data['additional_info'].get('adresse', {})
print(f"   AFTER:  {addr.get('rue', '')}, {addr.get('code_postal', '')} {addr.get('ville', '')}")

print("\n🏢 TVA:")
print(f"   BEFORE: {old_data['additional_info'].get('tva', 'N/A')}")
print(f"   AFTER:  {new_data['additional_info'].get('tva_intracommunautaire', 'N/A')}")

print("\n" + "=" * 60)
print("✅ IMPROVEMENT SUMMARY:")
print("=" * 60)
print("• OCR errors corrected (KAOUT/Æ → KAOUTAR)")
print("• Missing SIREN extracted")
print("• Phone number corrected")
print("• Dates completed and formatted")
print("• Address fully extracted with structure")
print("• TVA completed")
print("• Better organized nested structure")
print("=" * 60)
