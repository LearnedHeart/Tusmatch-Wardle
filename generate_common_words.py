import csv
import unicodedata

def remove_accents(input_str):
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])

def load_allowed_words(filename):
    allowed = set()
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            for line in f:
                # Format is "WORD", or "WORD"
                clean = line.strip().replace('"', '').replace(',', '')
                if clean:
                    allowed.add(clean.upper())
    except FileNotFoundError:
        print(f"Erreur: Le fichier {filename} est introuvable.")
        return set()
    return allowed

def process_lexique(lexique_path, allowed_words):
    word_freqs = {}
    
    try:
        with open(lexique_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter='\t')
            for row in reader:
                word = row['ortho']
                
                # Normalize: remove accents and uppercase
                word_clean = remove_accents(word).upper()
                
                # Check if in allowed list
                if word_clean in allowed_words:
                    try:
                        # Summing frequencies from films and books
                        freq = float(row['freqfilms2']) + float(row['freqlivres'])
                    except ValueError:
                        freq = 0.0
                    
                    if word_clean in word_freqs:
                        word_freqs[word_clean] += freq
                    else:
                        word_freqs[word_clean] = freq
    except FileNotFoundError:
        print(f"Erreur: Le fichier {lexique_path} est introuvable.")
        return {}
                    
    return word_freqs

def main():
    mots_path = 'mots.txt'
    lexique_path = 'Lexique383.tsv'
    output_filename = 'mots_courants.txt'

    print("Chargement des mots autorisés...")
    allowed = load_allowed_words(mots_path)
    if not allowed:
        return
    print(f"{len(allowed)} mots autorisés trouvés.")
    
    print("Lecture de Lexique383...")
    freqs = process_lexique(lexique_path, allowed)
    print(f"{len(freqs)} mots trouvés dans le lexique correspondant aux mots autorisés.")
    
    # Sort by frequency desc
    sorted_words = sorted(freqs.items(), key=lambda x: x[1], reverse=True)
    
    # Take top 20000
    top_20k = sorted_words[:20000]
    
    # Write to output
    with open(output_filename, 'w', encoding='utf-8') as f:
        for word, freq in top_20k:
            # Writing in the format "WORD",
            f.write(f'"{word}",\n')
            
    print(f"Fichier {output_filename} généré avec {len(top_20k)} mots.")

if __name__ == "__main__":
    main()
