// game.js

// --- CONFIGURATION ---
let wordLength = 5;
const MAX_GUESSES = 6;
let DICTIONARY = [];

// Variables globales
let targetWord = "";
let currentGuess = [];
let guesses = [];
let isGameOver = false;
let currentHints = [];

const grid = document.getElementById("grid");
const themeBtn = document.getElementById("themeToggle");

async function loadDictionary() {
    try {
        const response = await fetch('mots.txt');
        const text = await response.text();
        return text.split('\n')
            .map(line => {
                let clean = line.trim();
                if (clean.endsWith(',')) clean = clean.slice(0, -1);
                return clean.replace(/^"|"$/g, '');
            })
            .filter(word => word.length > 0);
    } catch (e) {
        console.error("Erreur chargement dictionnaire:", e);
        return ["POMME", "MONDE"];
    }
}

// --- INITIALISATION ---
async function initGame(customWord = null) {
    if (DICTIONARY.length === 0) {
        DICTIONARY = await loadDictionary();
    }
    
    if (customWord) {
        targetWord = customWord.toUpperCase();
    } else {
        targetWord = DICTIONARY[Math.floor(Math.random() * DICTIONARY.length)];
    }
    wordLength = targetWord.length;
    
    // Reset variables
    currentGuess = Array(wordLength).fill("");
    guesses = [];
    isGameOver = false;
    
    // Init hints
    currentHints = Array(wordLength).fill(null);
    currentHints[0] = targetWord[0];
    currentGuess[0] = targetWord[0];

    // Création de la grille HTML
    grid.innerHTML = "";
    for (let i = 0; i < MAX_GUESSES; i++) {
        const row = document.createElement("div");
        row.className = "row";
        // row.style.gridTemplateColumns = `repeat(${wordLength}, 1fr)`; // Removed for Flexbox
        for (let j = 0; j < wordLength; j++) {
            const tile = document.createElement("div");
            tile.className = "tile";
            // La première lettre est donnée pour la ligne active (style Tusmo)
            if (i === 0 && j === 0) {
                tile.textContent = targetWord[0];
                tile.classList.add("given", "start-tile");
            }
            row.appendChild(tile);
        }
        grid.appendChild(row);
    }
    
    // Charger le thème (par défaut 'colorful')
    const savedTheme = localStorage.getItem('theme') || 'colorful';
    document.body.className = savedTheme;

    updateGrid();
}

// --- LOGIQUE DE JEU ---

// Gestion Clavier Physique
document.addEventListener("keydown", (e) => {
    if (isGameOver) return;
    
    const key = e.key;
    if (key === "Enter") handleEnter();
    else if (key === "Backspace") handleBackspace();
    else if (/^[a-zA-Z]$/.test(key)) handleInput(key.toUpperCase());
});

// Gestion Clavier Virtuel
document.getElementById("keyboard").addEventListener("click", (e) => {
    if (isGameOver) return;
    
    const target = e.target;
    if (!target.classList.contains("key")) return;
    
    const key = target.dataset.key;
    if (key === "Enter") handleEnter();
    else if (key === "Backspace") handleBackspace();
    else handleInput(key);
});

function handleInput(letter) {
    const index = currentGuess.findIndex((val) => val === "");
    if (index === -1) return;
    currentGuess[index] = letter;
    updateGrid();
}

function handleBackspace() {
    for (let i = wordLength - 1; i >= 0; i--) {
        if (currentGuess[i]) {
            currentGuess[i] = "";
            currentHints[i] = null; // Remove the hint as well
            break;
        }
    }
    updateGrid();
}

function handleEnter() {
    const guessString = currentGuess.join("");
    const filled = currentGuess.filter(Boolean).length;
    if (filled !== wordLength) {
        animateShake();
        return;
    }
    
    // Vérification basique si mot existe (optionnel pour ce prototype)
    if (!DICTIONARY.includes(guessString)) {
        alert("Mot inconnu !"); // À remplacer par une jolie notification
        animateShake();
        return;
    }

    submitGuess();
}

function updateGrid() {
    const row = grid.children[guesses.length];
    const tiles = row.children;
    
    for (let i = 0; i < wordLength; i++) {
        const letter = currentGuess[i];
        const hint = currentHints[i];
        
        // Display content: either the typed letter or the hint
        const content = letter || hint || "";
        
        // Determine if this tile should be marked as a start tile (hint)
        // The first letter (index 0) is always colored (start-tile) if it matches
        const isStartTile = (i === 0 && hint && content === hint);

        tiles[i].textContent = content;

        if (letter) {
            tiles[i].dataset.state = "active";
        } else {
            delete tiles[i].dataset.state;
        }

        if (isStartTile) {
            tiles[i].classList.add("start-tile");
        } else {
            tiles[i].classList.remove("start-tile");
        }
    }
}

function submitGuess() {
    const guessParts = [...currentGuess];
    const targetParts = targetWord.split("");
    const row = grid.children[guesses.length];
    
    // Algorithme de vérification (Vert, Jaune, Gris)
    const result = Array(wordLength).fill("absent");
    
    // 1. Trouver les VERTS (Bien placés)
    for (let i = 0; i < wordLength; i++) {
        if (guessParts[i] === targetParts[i]) {
            result[i] = "correct";
            targetParts[i] = null; // Marquer comme utilisé
            guessParts[i] = null;
        }
    }
    
    // 2. Trouver les JAUNES (Mal placés)
    for (let i = 0; i < wordLength; i++) {
        if (guessParts[i] && targetParts.includes(guessParts[i])) {
            result[i] = "present";
            targetParts[targetParts.indexOf(guessParts[i])] = null;
        }
    }
    
    // ANIMATION DE RÉVÉLATION (Flip successif)
    result.forEach((status, i) => {
        setTimeout(() => {
            const tile = row.children[i];
            tile.classList.add("flip");
            
            // Changer la couleur à mi-chemin de l'animation
            setTimeout(() => {
                tile.classList.add(status);
                // Mettre à jour le clavier
                const key = document.querySelector(`.key[data-key="${currentGuess[i]}"]`);
                if (key) {
                    // Logique de priorité couleur clavier : Vert > Jaune > Gris
                    const oldClass = key.classList.contains("correct") ? "correct" : 
                                     key.classList.contains("present") ? "present" : "absent";
                                     
                    if (status === "correct") key.className = "key correct";
                    else if (status === "present" && oldClass !== "correct") key.className = "key present";
                    else if (status === "absent" && oldClass === "absent") key.className = "key absent"; // Default
                    else if (status === "absent" && !key.classList.contains("correct") && !key.classList.contains("present")) key.classList.add("absent");
                }
            }, 250);
        }, i * 150); // Délai en cascade
    });

    const guessString = currentGuess.join("");
    guesses.push(guessString);
    
    // Vérification Victoire/Défaite après l'animation
    setTimeout(() => {
        if (guessString === targetWord) {
            showEndScreen(true, targetWord);
            isGameOver = true;
        } else if (guesses.length === MAX_GUESSES) {
            showEndScreen(false, targetWord);
            isGameOver = true;
        } else {
            // Copier les lettres correctes (sans style) vers la ligne suivante
            if (guesses.length < MAX_GUESSES) {
                // Prepare hints for next round
                currentHints = Array(wordLength).fill(null);
                currentHints[0] = targetWord[0];
                
                for (let i = 0; i < wordLength; i++) {
                    if (result[i] === 'correct') {
                        currentHints[i] = guessString[i];
                    }
                }

                currentGuess = Array(wordLength).fill("");
                // Only pre-fill the first letter if it's a hint
                if (currentHints[0]) {
                    currentGuess[0] = currentHints[0];
                }
                
                updateGrid();
            }
        }
    }, wordLength * 150 + 500);
}

function animateShake() {
    const row = grid.children[guesses.length];
    row.querySelectorAll('.tile').forEach(tile => {
        tile.classList.add('shake');
        setTimeout(() => tile.classList.remove('shake'), 500);
    });
}

// --- END SCREEN ---
const endModal = document.getElementById('endModal');
const endTitle = document.getElementById('endTitle');
const endMessage = document.getElementById('endMessage');
const wordDisplay = document.getElementById('wordDisplay');
const restartBtn = document.getElementById('restartBtn');
const shareBtn = document.getElementById('shareBtn');

function showEndScreen(victory, word) {
    endModal.classList.remove('hidden');
    endModal.classList.remove('victory', 'defeat');
    endModal.classList.add(victory ? 'victory' : 'defeat');

    if (victory) {
        endTitle.textContent = "Victoire !";
        endMessage.textContent = "Bien joué, tu as trouvé le mot !";
        wordDisplay.style.display = 'none';
    } else {
        endTitle.textContent = "Défaite...";
        endMessage.textContent = "Dommage, le mot était :";
        wordDisplay.textContent = word;
        wordDisplay.style.display = 'block';
    }
}

restartBtn.addEventListener('click', () => {
    endModal.classList.add('hidden');
    initGame();
});

shareBtn.addEventListener('click', () => {
    // Placeholder for share functionality
    alert("Fonctionnalité de partage bientôt disponible !");
});

// Gestion du bouton Thème (affiche le label du thème)
const themes = ['', 'dark', 'colorful'];
function themeLabel(cls) {
    if (!cls || cls === '') return 'Light';
    if (cls === 'dark') return 'Dark';
    if (cls === 'colorful') return 'Colorful';
    return 'Light';
}

// Initialiser label bouton thème
const savedThemeBtn = localStorage.getItem('theme') || document.body.className || '';
themeBtn.textContent = themeLabel(savedThemeBtn);

themeBtn.addEventListener('click', () => {
    let currentTheme = localStorage.getItem('theme') || document.body.className || '';
    let nextIndex = (themes.indexOf(currentTheme) + 1) % themes.length;
    let newTheme = themes[nextIndex];
    document.body.className = newTheme;
    localStorage.setItem('theme', newTheme);
    themeBtn.textContent = themeLabel(newTheme);
});

// Dev Mode Button
document.getElementById('devModeBtn').addEventListener('click', () => {
    const word = prompt("DEV MODE: Choisir le mot mystère (laisser vide pour annuler) :");
    if (word && word.trim().length > 0) {
        initGame(word.trim());
    }
});

// Lancer le jeu
initGame();