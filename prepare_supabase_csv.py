import csv

input_file = 'mots_courants.txt'
output_file = 'solutions.csv'

print(f"Transformation de {input_file} vers {output_file}...")

try:
    with open(input_file, 'r', encoding='utf-8') as f_in, \
         open(output_file, 'w', encoding='utf-8', newline='') as f_out:
        
        writer = csv.writer(f_out)
        # Écrire l'en-tête pour Supabase
        writer.writerow(['mot'])
        
        count = 0
        for line in f_in:
            # Nettoyage : enlever les espaces, les guillemets et la virgule finale
            clean_word = line.strip().replace('"', '').replace(',', '')
            
            if clean_word:
                writer.writerow([clean_word])
                count += 1
                
    print(f"Succès ! {count} mots ont été écrits dans {output_file}.")
    print("Tu peux maintenant importer ce fichier dans Supabase.")

except FileNotFoundError:
    print(f"Erreur : Le fichier {input_file} est introuvable.")
except Exception as e:
    print(f"Une erreur est survenue : {e}")
