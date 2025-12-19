// multiplayer.js

// --- VARIABLES GLOBALES ---
let myPlayerId = null;
let myPseudo = null;
let currentRoomCode = null;
let isHost = false;
let roomChannel = null;

// --- DOM ELEMENTS ---
const lobbyOverlay = document.getElementById('lobby-overlay');
const lobbyStart = document.getElementById('lobby-start');
const lobbyWaiting = document.getElementById('lobby-waiting');
const playersList = document.getElementById('players-list');
const opponentsContainer = document.getElementById('opponents-container');
const displayRoomCode = document.getElementById('display-room-code');
const waitingMessage = document.getElementById('waiting-message');
const btnStartGame = document.getElementById('btn-start-game');
const roomInfoBar = document.getElementById('room-info-bar');
const ingameRoomCode = document.getElementById('ingame-room-code');

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    if (mode === 'private') {
        // Afficher le lobby
        lobbyOverlay.classList.remove('hidden');
        
        // Event Listeners du Lobby
        document.getElementById('btn-create-game').addEventListener('click', createGame);
        document.getElementById('btn-join-game').addEventListener('click', () => {
            const code = document.getElementById('lobby-code-input').value.toUpperCase();
            if (code.length >= 3) joinGame(code);
            else alert("Code trop court !");
        });
        
        // Event Listener pour le bouton "Lancer" (Host seulement)
        btnStartGame.addEventListener('click', launchGame);

        // Event Listeners pour les boutons de partage (Lobby & In-Game)
        setupShareButtons('btn-share-link', 'btn-copy-code');
        setupShareButtons('ingame-share-link', 'ingame-copy-code');

        // Event Listener pour le bouton "Retour" (Quitter la partie)
        const btnLeave = document.getElementById('btn-leave-game');
        if (btnLeave) {
            btnLeave.addEventListener('click', (e) => {
                e.preventDefault(); // Empêcher le lien par défaut
                openLeaveModal();
            });
        }

        // Modal Leave Actions
        document.getElementById('confirm-leave').addEventListener('click', confirmLeaveGame);
        document.getElementById('cancel-leave').addEventListener('click', closeLeaveModal);

        // Auto-fill code from URL
        const codeParam = urlParams.get('code');
        if (codeParam) {
            document.getElementById('lobby-code-input').value = codeParam;
        }

        // Hook pour le typing (Broadcast)
        document.addEventListener('keydown', () => {
            if (currentRoomCode && !isGameOver) {
                sendTypingSignal();
            }
        });
    }
});

function setupShareButtons(linkBtnId, codeBtnId) {
    const btnShare = document.getElementById(linkBtnId);
    if (btnShare) {
        btnShare.addEventListener('click', () => {
            if (currentRoomCode) {
                const url = `${window.location.origin}${window.location.pathname}?mode=private&code=${currentRoomCode}`;
                navigator.clipboard.writeText(url).then(() => {
                    // Bounce animation
                    btnShare.classList.add('bounce');
                    setTimeout(() => btnShare.classList.remove('bounce'), 500);
                });
            }
        });
    }

    const btnCopyCode = document.getElementById(codeBtnId);
    if (btnCopyCode) {
        btnCopyCode.addEventListener('click', () => {
            if (currentRoomCode) {
                navigator.clipboard.writeText(currentRoomCode).then(() => {
                    // Bounce animation
                    btnCopyCode.classList.add('bounce');
                    setTimeout(() => btnCopyCode.classList.remove('bounce'), 500);
                });
            }
        });
    }
}

// --- LOGIQUE LOBBY ---

async function createGame() {
    const btn = document.getElementById('btn-create-game');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Création...";

    try {
        const pseudoInput = document.getElementById('player-pseudo').value.trim();
        const pseudo = pseudoInput || "Joueur " + Math.floor(Math.random() * 1000);
        myPseudo = pseudo;
        
        // 1. Générer un code unique (5 caractères)
        const code = Math.random().toString(36).substring(2, 7).toUpperCase();
        
        // 2. Choisir un mot aléatoire (On utilise la liste locale de game.js)
        // Assurons-nous que les dictionnaires sont chargés
        if (typeof COMMON_WORDS === 'undefined' || COMMON_WORDS.length === 0) {
            if (typeof loadDictionaries === 'function') {
                await loadDictionaries();
            } else {
                console.warn("loadDictionaries non disponible, utilisation fallback");
                COMMON_WORDS = ["POMME", "MONDE"];
            }
        }
        
        const mot = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];

        // 3. Créer la partie
        const { data: partyData, error: partyError } = await supabaseClient
            .from('parties')
            .insert({ 
                code: code, 
                mot_a_trouver: mot, 
                statut: 'attente' 
            })
            .select()
            .single();

        if (partyError) {
            console.error(partyError);
            alert("Erreur création partie (Code: " + partyError.code + ")");
            btn.disabled = false;
            btn.textContent = originalText;
            return;
        }

        currentRoomCode = code;
        isHost = true;

        // 4. S'ajouter comme joueur
        await joinLobbyAsPlayer(partyData.id, pseudo, true);
        
        // 5. Afficher la salle d'attente
        showWaitingRoom(code);
        
        // Rétablir le bouton (même s'il est caché ensuite)
        btn.disabled = false;
        btn.textContent = originalText;

    } catch (e) {
        console.error("Erreur createGame:", e);
        alert("Une erreur est survenue : " + e.message);
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function joinGame(code) {
    const btn = document.getElementById('btn-join-game');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Connexion...";

    try {
        const pseudoInput = document.getElementById('player-pseudo').value.trim();
        const pseudo = pseudoInput || "Invité " + Math.floor(Math.random() * 1000);
        myPseudo = pseudo;

        // 1. Trouver la partie
        const { data: party, error } = await supabaseClient
            .from('parties')
            .select('*')
            .eq('code', code)
            .single();

        if (error || !party) {
            alert("Partie introuvable !");
            btn.disabled = false;
            btn.textContent = originalText;
            return;
        }

        // On autorise à rejoindre même si c'est "en_cours"
        // if (party.statut !== 'attente') { ... }

        currentRoomCode = code;
        isHost = false;

        // 2. S'ajouter
        await joinLobbyAsPlayer(party.id, pseudo, false);

        // 3. Si la partie est déjà en cours, on lance direct
        if (party.statut === 'en_cours') {
            startGameMultiplayer(party.mot_a_trouver);
        } else {
            // Sinon on affiche la salle d'attente
            showWaitingRoom(code);
        }
        
        btn.disabled = false;
        btn.textContent = originalText;

    } catch (e) {
        console.error("Erreur joinGame:", e);
        alert("Erreur de connexion : " + e.message);
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function joinLobbyAsPlayer(partyId, pseudo, hostStatus) {
    const { data: player, error } = await supabaseClient
        .from('joueurs')
        .insert({ 
            pseudo: pseudo, 
            partie_id: partyId, 
            est_host: hostStatus 
        })
        .select()
        .single();

    if (error) {
        console.error(error);
        return;
    }

    myPlayerId = player.id;
    subscribeToRoom(partyId);
    
    // Charger les joueurs déjà présents
    refreshPlayerList(partyId);
}

function showWaitingRoom(code) {
    lobbyStart.classList.add('hidden');
    lobbyWaiting.classList.remove('hidden');
    displayRoomCode.textContent = code;
    
    if (isHost) {
        btnStartGame.classList.remove('hidden');
        waitingMessage.classList.add('hidden');
    } else {
        btnStartGame.classList.add('hidden');
        waitingMessage.classList.remove('hidden');
    }
}

async function refreshPlayerList(partyId) {
    const { data: players } = await supabaseClient
        .from('joueurs')
        .select('*')
        .eq('partie_id', partyId);
    
    updatePlayerListUI(players);
}

function updatePlayerListUI(players) {
    playersList.innerHTML = players.map(p => 
        `<div style="padding: 5px; border-bottom: 1px solid #eee;">
            ${p.pseudo} ${p.est_host ? '👑' : ''}
        </div>`
    ).join('');
}

// --- REALTIME & JEU ---

function subscribeToRoom(partyId) {
    roomChannel = supabaseClient.channel('room_' + partyId);

    roomChannel
        // Écouter les nouveaux joueurs (INSERT), départs (DELETE) et changements de statut/host (UPDATE)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'joueurs', filter: `partie_id=eq.${partyId}` }, (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE' || payload.eventType === 'UPDATE') {
                refreshPlayerList(partyId);
            }
        })
        // Écouter le lancement du jeu
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'parties', filter: `id=eq.${partyId}` }, (payload) => {
            if (payload.new.statut === 'en_cours') {
                startGameMultiplayer(payload.new.mot_a_trouver);
            }
        })
        // Écouter les essais des adversaires
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'essais', filter: `partie_id=eq.${partyId}` }, (payload) => {
            if (payload.new.joueur_id !== myPlayerId) {
                handleOpponentGuess(payload.new);
            }
        })
        // Écouter le typing (Broadcast)
        .on('broadcast', { event: 'typing' }, (payload) => {
            if (payload.id !== myPlayerId) {
                showTypingIndicator(payload);
            }
        })
        // Écouter les mises à jour d'état (typing progress)
        .on('broadcast', { event: 'state_update' }, (payload) => {
            console.log("Reçu state_update:", payload); // DEBUG
            if (payload.id !== myPlayerId) {
                handleOpponentStateUpdate(payload);
            }
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("Connecté au canal temps réel !");
            }
        });
}

async function launchGame() {
    // Le host lance la partie
    // On récupère l'ID de la partie via le code (ou on le stocke globalement)
    // Pour faire simple, on refait un select ou on stocke l'ID. 
    // Optimisation : stocker partyId globalement.
    // Mais ici on va utiliser le code pour retrouver l'ID si besoin, ou juste update via le code si unique.
    
    await supabaseClient
        .from('parties')
        .update({ statut: 'en_cours' })
        .eq('code', currentRoomCode);
}

function startGameMultiplayer(mot) {
    lobbyOverlay.classList.add('hidden');
    // Lancer le jeu avec le mot imposé
    initGame(mot);
    
    // Initialiser l'interface des adversaires
    setupOpponentsUI();
}

async function setupOpponentsUI() {
    // Récupérer la liste des autres joueurs
    const { data: players } = await supabaseClient
        .from('parties')
        .select('joueurs(*)')
        .eq('code', currentRoomCode)
        .single();
        
    const opponents = players.joueurs.filter(p => p.id !== myPlayerId);
    
    opponentsContainer.innerHTML = opponents.map(p => `
        <div class="opponent-card" id="opp-${p.id}">
            <div class="opponent-name">${p.pseudo}</div>
            <div class="mini-grid" id="grid-${p.id}" style="--mini-cols: ${wordLength}">
                ${Array(6).fill(0).map(() => `
                    <div class="mini-row">
                        ${Array(wordLength).fill('<div class="mini-tile"></div>').join('')}
                    </div>
                `).join('')}
            </div>
            <div class="typing-indicator" id="typing-${p.id}"></div>
        </div>
    `).join('');
}

// --- INTERACTION JEU -> MULTI ---

// Appelée par game.js quand le joueur valide une ligne
window.sendMultiplayerGuess = async function(guessPattern, rowIndex) {
    if (!currentRoomCode) return;

    // Retrouver l'ID de la partie (on pourrait le stocker mieux)
    const { data: party } = await supabaseClient.from('parties').select('id').eq('code', currentRoomCode).single();
    
    if (party) {
        await supabaseClient.from('essais').insert({
            partie_id: party.id,
            joueur_id: myPlayerId,
            numero_ligne: rowIndex,
            pattern: guessPattern // ex: "20102"
        });
    }
};

// Appelée par game.js pour le typing
let typingTimeout = null;
function sendTypingSignal() {
    if (typingTimeout) return; // Limiter les envois
    
    roomChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user: myPseudo, id: myPlayerId }
    });

    typingTimeout = setTimeout(() => { typingTimeout = null; }, 2000);
}

// Appelée par game.js pour envoyer l'état (lettres remplies)
let stateTimeout = null;
window.sendMultiplayerState = function(filledCount, rowIndex) {
    if (stateTimeout) clearTimeout(stateTimeout);
    
    // Debounce léger pour éviter de spammer à chaque frappe rapide
    stateTimeout = setTimeout(() => {
        if (roomChannel) {
            roomChannel.send({
                type: 'broadcast',
                event: 'state_update',
                payload: { 
                    user: myPseudo,
                    id: myPlayerId,
                    row: rowIndex,
                    filled: filledCount
                }
            });
        }
    }, 50);
};

// --- RECEPTION MULTI -> JEU ---

function handleOpponentStateUpdate(payload) {
    // payload: { user, id, row, filled }
    let card = null;

    // 1. Essayer par ID (Nouvelle version)
    if (payload.id) {
        card = document.getElementById(`opp-${payload.id}`);
    }

    // 2. Fallback par Pseudo (Ancienne version ou si ID manquant)
    if (!card && payload.user) {
        const cards = document.querySelectorAll('.opponent-card');
        cards.forEach(c => {
            if (c.querySelector('.opponent-name').textContent === payload.user) {
                card = c;
            }
        });
    }

    if (card) {
        const miniGrid = card.querySelector('.mini-grid');
        if (miniGrid && miniGrid.children[payload.row]) {
            const row = miniGrid.children[payload.row];
            const tiles = row.children;
            
            for (let i = 0; i < tiles.length; i++) {
                if (i < payload.filled) {
                    tiles[i].classList.add('filled');
                } else {
                    tiles[i].classList.remove('filled');
                }
            }
        }
    }
}

function handleOpponentGuess(essai) {
    // essai contient: joueur_id, numero_ligne, pattern (ex: "20102")
    const gridId = `grid-${essai.joueur_id}`;
    const miniGrid = document.getElementById(gridId);
    
    if (miniGrid) {
        const row = miniGrid.children[essai.numero_ligne];
        const tiles = row.children;
        const pattern = essai.pattern; // string "20102"
        
        for (let i = 0; i < pattern.length; i++) {
            tiles[i].classList.remove('filled'); // Nettoyer l'état de typing
            const val = pattern[i];
            if (val === '2') tiles[i].classList.add('correct');
            else if (val === '1') tiles[i].classList.add('present');
            else tiles[i].classList.add('absent');
        }
    }
}

function showTypingIndicator(payload) {
    // Trouver l'adversaire par ID
    const card = document.getElementById(`opp-${payload.id}`);
    if (card) {
        const indicator = card.querySelector('.typing-indicator');
        indicator.textContent = "...";
        setTimeout(() => { indicator.textContent = ""; }, 2000);
    }
}

// --- RESTART LOGIC ---

window.triggerMultiplayerRestart = async function() {
    if (!isHost) {
        alert("Seul l'hôte peut relancer la partie !");
        return;
    }
    
    // Choisir un nouveau mot
    if (COMMON_WORDS.length === 0) await loadDictionaries();
    const mot = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];
    
    // Retrouver l'ID de la partie
    const { data: party } = await supabaseClient.from('parties').select('id').eq('code', currentRoomCode).single();
    
    if (party) {
        // 1. Supprimer les anciens essais
        await supabaseClient.from('essais').delete().eq('partie_id', party.id);
        
        // 2. Mettre à jour la partie (ce qui va trigger le restart chez tout le monde)
        await supabaseClient
            .from('parties')
            .update({ 
                mot_a_trouver: mot,
                statut: 'en_cours', // Force update event
                fin_round_at: null 
            })
            .eq('id', party.id);
    }
};

// --- LEAVE GAME LOGIC ---

async function leaveGame() {
    if (!currentRoomCode) {
        // Si pas en partie, retour simple
        window.location.href = 'index.html';
        return;
    }

    if (!confirm("Voulez-vous vraiment quitter la partie ?")) {
        return;
    }

    try {
        // 1. Récupérer la partie et les joueurs
        const { data: party } = await supabaseClient
            .from('parties')
            .select('id, joueurs(*)')
            .eq('code', currentRoomCode)
            .single();

        if (party) {
            const players = party.joueurs;
            const remainingPlayers = players.filter(p => p.id !== myPlayerId);

            // 2. Si je suis le dernier joueur -> Supprimer la partie
            if (remainingPlayers.length === 0) {
                await supabaseClient.from('parties').delete().eq('id', party.id);
            } else {
                // 3. Si je suis l'hôte -> Transférer la couronne
                if (isHost) {
                    const newHost = remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)];
                    await supabaseClient
                        .from('joueurs')
                        .update({ est_host: true })
                        .eq('id', newHost.id);
                }

                // 4. Me supprimer de la liste des joueurs
                await supabaseClient.from('joueurs').delete().eq('id', myPlayerId);
            }
        }
    } catch (e) {
        console.error("Erreur lors du départ:", e);
    }

    // 5. Redirection
    window.location.href = 'index.html';
}

// --- NEW UI FUNCTIONS (APPENDED) ---

function updateIngamePlayerList(players) {
    const list = document.getElementById('ingame-players-content');
    if (!list) return;

    // Update Room Code in Sidebar
    const codeDisplay = document.getElementById('sidebar-room-code');
    if (codeDisplay && currentRoomCode) {
        codeDisplay.textContent = currentRoomCode;
    }

    list.innerHTML = players.map(p => {
        const isMe = p.id === myPlayerId;
        const isHost = p.est_host;
        const avatarLetter = p.pseudo ? p.pseudo.charAt(0).toUpperCase() : '?';
        
        return `
            <div class="ingame-player-card ${isMe ? 'is-me' : ''}">
                <div class="ingame-player-avatar">${avatarLetter}</div>
                <div class="ingame-player-info">
                    <div class="ingame-player-name">
                        ${p.pseudo} ${isHost ? '👑' : ''}
                    </div>
                    <div class="ingame-player-status">
                        ${isMe ? '(Moi)' : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Override refreshPlayerList to update both lists
window.refreshPlayerList = async function(partyId) {
    const { data: players } = await supabaseClient
        .from('joueurs')
        .select('*')
        .eq('partie_id', partyId);
    
    if (players) {
        updatePlayerListUI(players);
        updateIngamePlayerList(players);
    }
};

// Override startGameMultiplayer to show the list
const originalStartGameMultiplayer = window.startGameMultiplayer;
window.startGameMultiplayer = function(mot) {
    lobbyOverlay.classList.add('hidden');
    initGame(mot);
    setupOpponentsUI();
    
    // Show Sidebar
    document.getElementById('ingame-sidebar').classList.remove('hidden');
    
    // Update list immediately
    if (currentRoomCode) {
        supabaseClient.from('parties').select('id').eq('code', currentRoomCode).single()
            .then(({data}) => {
                if(data) refreshPlayerList(data.id);
            });
    }
};

// --- EVENT LISTENERS FIX ---
document.addEventListener('DOMContentLoaded', () => {
    // Fix for Leave Modal
    const btnLeave = document.getElementById('btn-leave-game');
    if (btnLeave) {
        const newBtn = btnLeave.cloneNode(true);
        btnLeave.parentNode.replaceChild(newBtn, btnLeave);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openLeaveModal();
        });
    }

    const confirmLeave = document.getElementById('confirm-leave');
    if (confirmLeave) confirmLeave.addEventListener('click', confirmLeaveGame);
    
    const cancelLeave = document.getElementById('cancel-leave');
    if (cancelLeave) cancelLeave.addEventListener('click', closeLeaveModal);

    // Fix for Share Buttons (Sidebar)
    setupShareButtons('sidebar-share-link', 'sidebar-copy-code');
    // Also keep lobby buttons working
    setupShareButtons('btn-share-link', 'btn-copy-code');
});

function openLeaveModal() {
    const modal = document.getElementById('leave-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeLeaveModal() {
    const modal = document.getElementById('leave-modal');
    if (modal) modal.classList.add('hidden');
}

function confirmLeaveGame() {
    closeLeaveModal();
    leaveGame();
}

function setupShareButtons(linkBtnId, codeBtnId) {
    const btnShare = document.getElementById(linkBtnId);
    if (btnShare) {
        btnShare.addEventListener('click', () => {
            if (currentRoomCode) {
                const url = `${window.location.origin}${window.location.pathname}?mode=private&code=${currentRoomCode}`;
                navigator.clipboard.writeText(url).then(() => {
                    // Bounce animation
                    btnShare.classList.add('bounce');
                    setTimeout(() => btnShare.classList.remove('bounce'), 500);
                });
            }
        });
    }

    const btnCopyCode = document.getElementById(codeBtnId);
    if (btnCopyCode) {
        btnCopyCode.addEventListener('click', () => {
            if (currentRoomCode) {
                navigator.clipboard.writeText(currentRoomCode).then(() => {
                    // Bounce animation
                    btnCopyCode.classList.add('bounce');
                    setTimeout(() => btnCopyCode.classList.remove('bounce'), 500);
                });
            }
        });
    }
}
