// game.js

// --- SUPABASE CONFIGURATION ---
// REMPLACE CES VALEURS PAR CELLES DE TON PROJET SUPABASE
const supabaseUrl = 'https://mimieikswytpoouowlye.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbWllaWtzd3l0cG9vdW93bHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2OTc4MTYsImV4cCI6MjA4MTI3MzgxNn0.Jvg5YSZCW_5kbGRwkGD0e6k5QGcSlfpY4QtvwDzJUq4';
// On utilise un nom différent pour éviter les conflits avec la librairie globale 'supabase'
let supabaseClient = null;

if (typeof createClient !== 'undefined') {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
} else if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
} else {
    console.error("Impossible d'initialiser Supabase : createClient introuvable.");
}

// --- CONFIGURATION ---
let wordLength = 5;
const MAX_GUESSES = 6;
let DICTIONARY = []; // Mots valides pour les essais (mots.txt)
let COMMON_WORDS = []; // Mots cibles possibles (mots_courants.txt)

// Variables globales
let targetWord = "";
let currentGuess = [];
let guesses = [];
let isGameOver = false;
let currentHints = [];

const grid = document.getElementById("grid");
const themeBtn = document.getElementById("themeToggle");

async function loadDictionaries() {
    try {
        // Charger le dictionnaire complet (mots valides)
        const responseDict = await fetch('mots.txt');
        const textDict = await responseDict.text();
        DICTIONARY = textDict.split('\n')
            .map(line => {
                let clean = line.trim();
                if (clean.endsWith(',')) clean = clean.slice(0, -1);
                return clean.replace(/^"|"$/g, '');
            })
            .filter(word => word.length > 0);

        // Charger les mots courants (mots cibles)
        const responseCommon = await fetch('mots_courants.txt');
        const textCommon = await responseCommon.text();
        COMMON_WORDS = textCommon.split('\n')
            .map(line => {
                let clean = line.trim();
                if (clean.endsWith(',')) clean = clean.slice(0, -1);
                return clean.replace(/^"|"$/g, '');
            })
            .filter(word => word.length > 0);

    } catch (e) {
        console.error("Erreur chargement dictionnaires:", e);
        // Fallback
        DICTIONARY = ["POMME", "MONDE", "TESTS"];
        COMMON_WORDS = ["POMME", "MONDE"];
    }
}

// --- LOCAL DAILY WORD LOGIC ---
// Générateur pseudo-aléatoire basé sur une graine (seed)
function seededRandom(seed) {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function getDailyWord(offset = 0) {
    if (COMMON_WORDS.length === 0) return "ERREUR";

    const now = new Date();
    // Ajouter l'offset en jours
    now.setDate(now.getDate() + offset);

    // Créer une chaîne de date locale YYYY-MM-DD
    // Cela garantit que c'est basé sur le fuseau horaire de l'utilisateur
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    // Créer un hash simple de la date pour servir de graine
    let seed = 0;
    for (let i = 0; i < dateString.length; i++) {
        seed = ((seed << 5) - seed) + dateString.charCodeAt(i);
        seed |= 0; // Convertir en entier 32 bits
    }

    // Générer un nombre aléatoire avec cette graine
    const rand = seededRandom(seed);
    
    // Choisir un index aléatoire dans la liste
    const index = Math.floor(rand * COMMON_WORDS.length);
    
    console.log(`Date: ${dateString}, Seed: ${seed}, Index: ${index}, Mot: ${COMMON_WORDS[index]}`);
    return COMMON_WORDS[index];
}

// Fonction de test pour le développeur
window.testNextDay = function(days = 1) {
    console.log(`Test: Récupération du mot dans ${days} jours...`);
    const word = getDailyWord(days);
    if (word) {
        console.log(`Le mot dans ${days} jours sera : ${word}`);
        alert(`Le mot dans ${days} jours sera : ${word}`);
    } else {
        console.log("Impossible de récupérer le mot.");
    }
};

// --- INITIALISATION ---
async function initGame(customWord = null) {
    if (DICTIONARY.length === 0 || COMMON_WORDS.length === 0) {
        await loadDictionaries();
    }
    
    if (customWord) {
        targetWord = customWord.toUpperCase();
    } else {
        // Récupérer le mot du jour localement (basé sur la date)
        let dailyWord = getDailyWord();
        
        if (dailyWord) {
            targetWord = dailyWord.toUpperCase();
            console.log("Mot du jour chargé (Local) :", targetWord);
        } else {
            // Fallback ultime
            targetWord = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];
        }
    }
    wordLength = targetWord.length;
    
    // Reset variables
    currentGuess = Array(wordLength).fill("");
    guesses = [];
    isGameOver = false;
    
    // Init hints
    updateHintsFromHistory();
    currentGuess[0] = targetWord[0];

    // Création de la grille HTML
    grid.innerHTML = "";
    grid.style.setProperty('--cols', wordLength);
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
    
    // Charger le thème (par défaut '' -> Colorful)
    const savedTheme = localStorage.getItem('theme') || '';
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
            // Supprimer temporairement le hint pour cette tentative
            // Il sera restauré au prochain tour grâce à updateHintsFromHistory()
            currentHints[i] = null; 
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

    // Envoyer l'état au multijoueur si actif
    if (typeof window.sendMultiplayerState === 'function') {
        const filledCount = currentGuess.filter(l => l !== "").length;
        window.sendMultiplayerState(filledCount, guesses.length);
    }
}

function updateHintsFromHistory() {
    // Réinitialiser les hints
    currentHints = Array(wordLength).fill(null);
    // Toujours donner la première lettre
    if (targetWord && targetWord.length > 0) {
        currentHints[0] = targetWord[0];
    }
    
    // Parcourir tous les essais précédents pour trouver les lettres bien placées
    guesses.forEach(guess => {
        for (let i = 0; i < wordLength; i++) {
            if (guess[i] === targetWord[i]) {
                currentHints[i] = guess[i];
            }
        }
    });
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

    // --- MULTIPLAYER HOOK ---
    if (typeof window.sendMultiplayerGuess === 'function') {
        const pattern = result.map(r => r === 'correct' ? '2' : r === 'present' ? '1' : '0').join('');
        window.sendMultiplayerGuess(pattern, guesses.length);
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
    
    // Session Save Hook
    if (typeof window.saveGuessesToSession === 'function') {
        window.saveGuessesToSession();
    }
    
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
                // Recalculer les indices basés sur l'historique complet
                updateHintsFromHistory();

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
    
    // Multiplayer Hook
    if (typeof window.triggerMultiplayerRestart === 'function' && window.currentRoomCode) {
        window.triggerMultiplayerRestart();
    } else {
        initGame();
    }
});

shareBtn.addEventListener('click', () => {
    // Placeholder for share functionality
    alert("Fonctionnalité de partage bientôt disponible !");
});

// Gestion du bouton Thème (affiche le label du thème)
const themes = ['', 'claire', 'sombre'];
function themeLabel(cls) {
    if (!cls || cls === '') return 'Coloré';
    if (cls === 'claire') return 'Claire';
    if (cls === 'sombre') return 'Sombre';
    return 'Coloré';
}

// Initialiser label bouton thème
const savedThemeBtn = localStorage.getItem('theme') || '';
document.body.className = savedThemeBtn;
themeBtn.textContent = themeLabel(savedThemeBtn);

themeBtn.addEventListener('click', () => {
    let currentTheme = document.body.className || '';
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


// --- SESSION RESTORATION HELPERS ---

window.saveGuessesToSession = function() {
    if (typeof currentRoomCode !== 'undefined' && currentRoomCode) {
        sessionStorage.setItem('tusmatch_guesses_' + currentRoomCode, JSON.stringify(guesses));
    }
};

window.restoreGuess = function(guessWord) {
    if (!targetWord) return;
    
    // Set current guess
    currentGuess = guessWord.split("");
    const guessParts = [...currentGuess];
    const targetParts = targetWord.split("");
    const row = grid.children[guesses.length];
    
    const result = Array(wordLength).fill("absent");
    
    // 1. Verts
    for (let i = 0; i < wordLength; i++) {
        if (guessParts[i] === targetParts[i]) {
            result[i] = "correct";
            targetParts[i] = null;
            guessParts[i] = null;
        }
    }
    
    // 2. Jaunes
    for (let i = 0; i < wordLength; i++) {
        if (guessParts[i] && targetParts.includes(guessParts[i])) {
            result[i] = "present";
            targetParts[targetParts.indexOf(guessParts[i])] = null;
        }
    }

    // UI Update (Instant)
    result.forEach((status, i) => {
        const tile = row.children[i];
        tile.textContent = currentGuess[i];
        tile.classList.add(status);
        tile.classList.add("flip"); 
        
        // Keyboard
        const key = document.querySelector(`.key[data-key="${currentGuess[i]}"]`);
        if (key) {
            const oldClass = key.classList.contains("correct") ? "correct" : 
                             key.classList.contains("present") ? "present" : "absent";
            if (status === "correct") key.className = "key correct";
            else if (status === "present" && oldClass !== "correct") key.className = "key present";
            else if (status === "absent" && !key.classList.contains("correct") && !key.classList.contains("present")) key.classList.add("absent");
        }
    });

    guesses.push(guessWord);
    
    if (guessWord === targetWord) {
        isGameOver = true;
    } else if (guesses.length >= MAX_GUESSES) {
        isGameOver = true;
    }
    
    currentGuess = [];
    updateHintsFromHistory();
    // Prepare next row
    if (!isGameOver) {
        currentGuess = Array(wordLength).fill("");
        if (currentHints[0]) {
            currentGuess[0] = currentHints[0];
        }
        updateGrid();
    }
};

window.loadGuessesFromSession = function() {
    if (typeof currentRoomCode !== 'undefined' && currentRoomCode) {
        const stored = sessionStorage.getItem('tusmatch_guesses_' + currentRoomCode);
        if (stored) {
            const savedGuesses = JSON.parse(stored);
            // Clear current grid first if needed, but usually we call this on fresh init
            savedGuesses.forEach(g => window.restoreGuess(g));
        }
    }
};
// Lancer le jeu (sauf si mode privé, on attend le lobby)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('mode') !== 'private') {
    initGame();
}