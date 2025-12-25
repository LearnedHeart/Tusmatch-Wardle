// multiplayer.js

// --- VARIABLES GLOBALES ---
let myPlayerId = null;
let myPseudo = null;
let currentRoomCode = null;
let isHost = false;
let roomChannel = null;
let playerCount = 0; // Track number of players for cleanup logic
let currentAvatarIndex = 1;
let selectedGameMode = 'preums';
let currentChronoDuration = 30; // Default duration
let lastRoundVictory = false; // Track local victory state for round end display

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

    // Auto-rejoin Session
    const savedRoom = sessionStorage.getItem('tusmatch_room');
    const savedPlayerId = sessionStorage.getItem('tusmatch_player_id');
    if (savedRoom && savedPlayerId && mode === 'private') {
        rejoinSession(savedRoom, savedPlayerId);
    }

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

        // Avatar Carousel Logic
        const avatarImg = document.querySelector('.avatar-preview-container img');
        const btnPrevAvatar = document.getElementById('btn-prev-avatar');
        const btnNextAvatar = document.getElementById('btn-next-avatar');

        if (btnPrevAvatar && btnNextAvatar && avatarImg) {
            btnPrevAvatar.addEventListener('click', () => {
                currentAvatarIndex--;
                if (currentAvatarIndex < 1) currentAvatarIndex = 12;
                avatarImg.src = `assets/${currentAvatarIndex}.gif`;
            });

            btnNextAvatar.addEventListener('click', () => {
                currentAvatarIndex++;
                if (currentAvatarIndex > 12) currentAvatarIndex = 1;
                avatarImg.src = `assets/${currentAvatarIndex}.gif`;
            });
        }

        // Game Mode Selector Logic
        const modeOptions = document.querySelectorAll('.mode-option');
        const chronoSettings = document.getElementById('chrono-settings');

        modeOptions.forEach(option => {
            option.addEventListener('click', () => {
                if (option.classList.contains('disabled')) return;
                
                // Remove selected from all
                modeOptions.forEach(opt => opt.classList.remove('selected'));
                // Add to clicked
                option.classList.add('selected');
                // Update variable
                selectedGameMode = option.dataset.mode;

                // Show/Hide Chrono Settings
                if (selectedGameMode === 'temps') {
                    chronoSettings.classList.remove('hidden');
                } else {
                    chronoSettings.classList.add('hidden');
                }
            });
        });
        
        // Event Listener pour le bouton "Lancer" (Host seulement)
        btnStartGame.addEventListener('click', launchGame);

        // Event Listener pour le bouton "Retour" du lobby
        const btnLobbyBack = document.getElementById('btn-lobby-back');
        if (btnLobbyBack) {
            btnLobbyBack.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

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
        let pseudo = pseudoInput || "Joueur " + Math.floor(Math.random() * 1000);
        
        // Append Avatar ID
        if (typeof currentAvatarIndex !== 'undefined') {
            pseudo = `${pseudo}|${currentAvatarIndex}`;
        }
        
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

        // Prefix the word with the game mode to sync it with all players
        // Format: "MODE:WORD" or "MODE:DURATION:WORD"
        const modePrefix = (selectedGameMode || 'preums').toUpperCase();
        let motWithMode = `${modePrefix}:${mot}`;

        if (selectedGameMode === 'temps') {
            const durationInput = document.getElementById('chrono-duration');
            const duration = durationInput ? durationInput.value : 30;
            motWithMode = `${modePrefix}:${duration}:${mot}`;
        }

        // 3. Créer la partie
        const { data: partyData, error: partyError } = await supabaseClient
            .from('parties')
            .insert({ 
                code: code, 
                mot_a_trouver: motWithMode, 
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

        // Session Persistence
        sessionStorage.setItem('tusmatch_room', code);
        sessionStorage.setItem('tusmatch_pseudo', pseudo);
        sessionStorage.setItem('tusmatch_is_host', 'true');

        // 4. S'ajouter comme joueur
        await joinLobbyAsPlayer(partyData.id, pseudo, true);
        sessionStorage.setItem('tusmatch_player_id', myPlayerId);
        
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
        let pseudo = pseudoInput || "Invité " + Math.floor(Math.random() * 1000);
        
        // Append Avatar ID
        if (typeof currentAvatarIndex !== 'undefined') {
            pseudo = `${pseudo}|${currentAvatarIndex}`;
        }
        
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

        // Session Persistence
        sessionStorage.setItem('tusmatch_room', code);
        sessionStorage.setItem('tusmatch_pseudo', pseudo);
        sessionStorage.setItem('tusmatch_is_host', 'false');

        // 2. S'ajouter
        await joinLobbyAsPlayer(party.id, pseudo, false);
        sessionStorage.setItem('tusmatch_player_id', myPlayerId);

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
    playersList.innerHTML = players.map(p => {
        const avatarUrl = getAvatarUrl(p.pseudo);
        const displayName = getDisplayName(p.pseudo);
        const hostIcon = p.est_host ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>` : '';
        
        return `
        <div style="padding: 8px; border-bottom: 1px solid var(--tile-border); display: flex; align-items: center; gap: 10px;">
            <img src="${avatarUrl}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 2px solid var(--tile-border);">
            <span>${displayName}</span>
            ${hostIcon}
        </div>`;
    }).join('');
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
        // Écouter le lancement du jeu ou la fin de manche
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'parties', filter: `id=eq.${partyId}` }, (payload) => {
            if (payload.new.statut === 'en_cours') {
                startGameMultiplayer(payload.new.mot_a_trouver);
            } else if (payload.new.statut === 'fin_manche' && payload.new.fin_round_at) {
                handleRoundEnd(payload.new.fin_round_at);
            }
        })
        // Écouter les essais des adversaires
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'essais', filter: `partie_id=eq.${partyId}` }, (payload) => {
            if (payload.new.joueur_id !== myPlayerId) {
                handleOpponentGuess(payload.new);
            }
        })
        // Écouter le typing (Broadcast)
        .on('broadcast', { event: 'typing' }, (event) => {
            const payload = event.payload;
            if (payload && payload.id !== myPlayerId) {
                showTypingIndicator(payload);
            }
        })
        // Écouter les mises à jour d'état (typing progress)
        .on('broadcast', { event: 'state_update' }, (event) => {
            // console.log("Reçu state_update:", event); // DEBUG
            const payload = event.payload;
            if (payload && payload.id !== myPlayerId) {
                handleOpponentStateUpdate(payload);
            }
        })
        // Écouter les réactions
        .on('broadcast', { event: 'reaction' }, (event) => {
            const payload = event.payload;
            if (payload && payload.id !== myPlayerId) {
                showReaction(payload.type, payload.id);
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
    lastRoundVictory = false;
    
    // 1. Hide End Modal if open
    const endModal = document.getElementById('endModal');
    if (endModal) endModal.classList.add('hidden');

    // 2. Clear local session guesses for this room
    if (currentRoomCode) {
        sessionStorage.removeItem('tusmatch_guesses_' + currentRoomCode);
    }

    // 3. Hide Lobby
    lobbyOverlay.classList.add('hidden');
    
    // 4. Parse Mode from Word (Format: "MODE:WORD" or "MODE:DURATION:WORD")
    let realWord = mot;
    let duration = 30; // Default

    if (mot.includes(':')) {
        const parts = mot.split(':');
        // Update global mode variable based on the prefix
        const modePrefix = parts[0].toLowerCase();
        if (['preums', 'libre', 'temps'].includes(modePrefix)) {
            selectedGameMode = modePrefix;
        }
        
        if (modePrefix === 'temps' && parts.length === 3) {
            duration = parseInt(parts[1], 10);
            realWord = parts[2];
            currentChronoDuration = duration; // Store for next round
        } else {
            realWord = parts[1];
        }
    }

    // Set global duration for game.js
    if (typeof window.setChronoDuration === 'function') {
        window.setChronoDuration(duration);
    }

    // 5. Lancer le jeu avec le mot imposé
    initGame(realWord);
    
    // 6. Update Sidebar Mode Display
    const modeDisplay = document.getElementById('sidebar-game-mode');
    if (modeDisplay) {
        const displayMode = selectedGameMode === 'temps' ? 'CHRONO' : 
                            selectedGameMode === 'preums' ? 'PREMIER' : 
                            selectedGameMode.toUpperCase();
        modeDisplay.textContent = displayMode;
    }
    
    // 7. Initialiser l'interface des adversaires
    setupOpponentsUI();

    // 8. Show Sidebar & Toggle
    const sidebar = document.getElementById('ingame-sidebar');
    if (sidebar) sidebar.classList.remove('hidden');
    
    const btnToggle = document.getElementById('btn-toggle-sidebar');
    if (btnToggle) btnToggle.classList.remove('hidden');
    
    // 9. Update list immediately
    if (currentRoomCode) {
        supabaseClient.from('parties').select('id').eq('code', currentRoomCode).single()
            .then(({data}) => {
                if(data) refreshPlayerList(data.id);
            });
    }
}

async function setupOpponentsUI() {
    // Récupérer la liste des autres joueurs
    const { data: players } = await supabaseClient
        .from('parties')
        .select('joueurs(*)')
        .eq('code', currentRoomCode)
        .single();
        
    const opponents = players.joueurs.filter(p => p.id !== myPlayerId);
    
    // Set count class for dynamic sizing
    opponentsContainer.className = ''; // Reset
    opponentsContainer.classList.add(`count-${opponents.length}`);

    opponentsContainer.innerHTML = opponents.map(p => `
        <div class="opponent-card" id="opp-${p.id}">
            <div class="opponent-header" style="display:flex; align-items:center; justify-content:center; gap:5px; margin-bottom:5px;">
                 <img src="${getAvatarUrl(p.pseudo)}" style="width:20px; height:20px; border-radius:50%; object-fit:cover; border:1px solid var(--tile-border);">
                 <div class="opponent-name" style="margin-bottom:0;">${getDisplayName(p.pseudo)}</div>
            </div>
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
            const payload = { 
                user: myPseudo,
                id: myPlayerId,
                row: rowIndex,
                filled: filledCount
            };
            // console.log("Sending State Update:", payload); 
            roomChannel.send({
                type: 'broadcast',
                event: 'state_update',
                payload: payload
            });
        }
    }, 50);
};

// --- RECEPTION MULTI -> JEU ---

function handleOpponentStateUpdate(payload) {
    // payload: { user, id, row, filled }
    // console.log("Processing State Update:", payload);

    let card = null;

    // 1. Essayer par ID
    if (payload.id) {
        card = document.getElementById(`opp-${payload.id}`);
    }

    // 2. Fallback par Pseudo
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
        // Vérification robuste de la ligne
        const rowIndex = payload.row !== undefined ? payload.row : 0; // Fallback 0 si undefined (ne devrait pas arriver)
        
        if (miniGrid && miniGrid.children[rowIndex]) {
            const row = miniGrid.children[rowIndex];
            const tiles = row.children;
            
            for (let i = 0; i < tiles.length; i++) {
                if (i < payload.filled) {
                    tiles[i].classList.add('filled');
                    tiles[i].style.backgroundColor = "var(--filled-tile)"; // Force style
                    tiles[i].style.borderColor = "var(--filled-tile)";
                } else {
                    tiles[i].classList.remove('filled');
                    tiles[i].style.backgroundColor = ""; // Reset
                    tiles[i].style.borderColor = "";
                }
            }
        } else {
            console.warn("Row not found for index:", rowIndex);
        }
    } else {
        console.warn("Opponent card not found for:", payload);
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
            
            // IMPORTANT: Nettoyer les styles inline forcés par handleOpponentStateUpdate
            tiles[i].style.backgroundColor = "";
            tiles[i].style.borderColor = "";

            const val = pattern[i];
            if (val === '2') tiles[i].classList.add('correct');
            else if (val === '1') tiles[i].classList.add('present');
            else tiles[i].classList.add('absent');
        }
    }

    // --- MODE TEMPS TRIGGER ---
    if (selectedGameMode === 'temps') {
        // If an opponent finishes a line, trigger pressure timer for me
        if (typeof window.triggerPressureTimer === 'function') {
            window.triggerPressureTimer(essai.numero_ligne);
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

// --- GAME END & RESTART LOGIC ---

// Renamed from handleMultiplayerEnd to separate notification from UI
window.notifyMultiplayerFinish = async function(victory, word, roundScore) {
    if (!myPlayerId || !currentRoomCode) return;

    lastRoundVictory = victory;

    // 1. Update my status in DB
    const updates = {
        a_fini: true
    };
    
    // Fetch current stats to update score
    const { data: me } = await supabaseClient.from('joueurs').select('victoires, score').eq('id', myPlayerId).single();
    if (me) {
        if (victory) {
            updates.victoires = (me.victoires || 0) + 1;
        }
        // Add calculated round score
        updates.score = (me.score || 0) + (roundScore || 0);
    }

    await supabaseClient
        .from('joueurs')
        .update(updates)
        .eq('id', myPlayerId);

    // 2. Trigger Round End Sequence
    // Logic depends on Game Mode
    // "Temps" mode behaves like "Preums" (Race mode)
    const isLibre = (selectedGameMode === 'libre');
    
    // Check if I should trigger the end
    let shouldTriggerEnd = false;
    
    const { data: party } = await supabaseClient.from('parties').select('id, statut').eq('code', currentRoomCode).single();
    if (party) {
        const { data: players } = await supabaseClient.from('joueurs').select('*').eq('partie_id', party.id);
        
        // Note: my status is already updated to true above, so I am included in this check
        const allFinished = players.every(p => p.a_fini);
        const isRoundOver = party.statut === 'fin_manche';

        if (isRoundOver) {
            // Already over, nothing to do here. 
            // The subscription will handle the UI via handleRoundEnd
            return;
        }

        if (isLibre) {
            // Libre: End only if ALL finished
            if (allFinished) {
                shouldTriggerEnd = true;
            }
        } else {
            // Preums OR Temps: End if I won OR if ALL finished
            if (victory || allFinished) {
                shouldTriggerEnd = true;
            }
        }

        if (shouldTriggerEnd) {
            // Increase delay to 10s to allow for animations (approx 4-5s) + reading time (5s)
            const finTime = new Date(Date.now() + 10000).toISOString();
            await supabaseClient
                .from('parties')
                .update({ 
                    statut: 'fin_manche',
                    fin_round_at: finTime
                })
                .eq('id', party.id);
            
            // We do NOT call showEndScreen here anymore.
            // We wait for the subscription to 'fin_manche' to trigger handleRoundEnd
        }
    }
};

// Kept for backward compatibility if needed, but game.js now calls notifyMultiplayerFinish
window.handleMultiplayerEnd = window.notifyMultiplayerFinish; 


window.triggerMultiplayerRestart = async function() {
    // This function is now called automatically by the host client when timer ends
    // But we keep the check just in case
    if (!isHost) return; 
    
    const btn = document.getElementById('restartBtn');
    if(btn) btn.textContent = "Lancement...";

    // Choisir un nouveau mot
    if (typeof COMMON_WORDS === 'undefined' || COMMON_WORDS.length === 0) await loadDictionaries();
    const rawMot = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];
    
    // Prefix with current mode
    const modePrefix = (selectedGameMode || 'preums').toUpperCase();
    let mot = `${modePrefix}:${rawMot}`;

    if (selectedGameMode === 'temps') {
        // Use stored duration or fallback to 30
        const duration = currentChronoDuration || 30;
        mot = `${modePrefix}:${duration}:${rawMot}`;
    }
    
    // Retrouver l'ID de la partie
    const { data: party } = await supabaseClient.from('parties').select('id').eq('code', currentRoomCode).single();
    
    if (party) {
        // 1. Reset all players status
        await supabaseClient
            .from('joueurs')
            .update({ a_fini: false })
            .eq('partie_id', party.id);

        // 2. Supprimer les anciens essais
        await supabaseClient.from('essais').delete().eq('partie_id', party.id);
        
        // 3. Mettre à jour la partie (ce qui va trigger le restart chez tout le monde)
        await supabaseClient
            .from('parties')
            .update({ 
                mot_a_trouver: mot,
                statut: 'en_cours', 
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

    // Confirmation handled by Modal now
    // if (!confirm("Voulez-vous vraiment quitter la partie ?")) return;

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

    // Sort by score descending for ranking
    const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

    list.innerHTML = sortedPlayers.map((p, index) => {
        const isMe = p.id === myPlayerId;
        const isHost = p.est_host;
        const avatarUrl = getAvatarUrl(p.pseudo);
        const displayName = getDisplayName(p.pseudo);
        
        const hostIcon = isHost ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>` : '';
        
        const statusIcon = p.a_fini 
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` 
            : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>`;
            
        const score = p.score || 0;
        
        // Ranking Logic
        const rank = index + 1;
        let rankColor = '#666'; // Default Grey
        if (rank === 1) rankColor = '#FFD700'; // Gold
        if (rank === 2) rankColor = '#C0C0C0'; // Silver
        if (rank === 3) rankColor = '#CD7F32'; // Bronze
        
        return `
            <div class="ingame-player-card ${isMe ? 'is-me' : ''}">
                <div style="color:${rankColor}; font-weight:bold; margin-right:8px; min-width:20px; font-size:0.9rem;">#${rank}</div>
                <img src="${avatarUrl}" class="ingame-player-avatar-img">
                <div class="ingame-player-info">
                    <div class="ingame-player-name">
                        ${displayName} ${hostIcon}
                    </div>
                    <div class="ingame-player-status">
                        ${isMe ? '<span style="font-size:0.8em; opacity:0.7; margin-right:4px;">(Moi)</span>' : ''} 
                        ${statusIcon} 
                        <span style="margin-left:4px; font-weight:bold;">${score}pts</span>
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
        playerCount = players.length;

        // Host Transfer Logic
        const hasHost = players.some(p => p.est_host);
        if (!hasHost && players.length > 0) {
            // If no host, and I am the first one in the list, I claim host.
            // We sort by created_at to be deterministic if possible, but here we trust the array order (usually insertion order)
            // or we can just check if I am the first one.
            if (players[0].id === myPlayerId) {
                console.log("No host found. Claiming host status...");
                await supabaseClient
                    .from('joueurs')
                    .update({ est_host: true })
                    .eq('id', myPlayerId);
                isHost = true;
                sessionStorage.setItem('tusmatch_is_host', 'true');
            }
        }

        updatePlayerListUI(players);
        updateIngamePlayerList(players);
    }
};

// --- CLEANUP ON CLOSE ---
window.addEventListener('beforeunload', () => {
    if (myPlayerId) {
        // 1. Delete Player
        const headers = {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        };

        // Delete player using keepalive
        fetch(`${supabaseUrl}/rest/v1/joueurs?id=eq.${myPlayerId}`, {
            method: 'DELETE',
            headers: headers,
            keepalive: true
        });

        // 2. If I am the last player (locally known), try to delete the party
        // Note: This is a best-effort. If multiple players leave at once, it might race.
        // But if I am the only one in the list, I should delete the party.
        if (playerCount <= 1 && currentRoomCode) {
             // We need the party ID. We might not have it stored globally except in closure.
             // But we can try to find it via code if we don't have ID.
             // However, fetch needs ID for DELETE usually or a filter.
             // We can filter by code? No, parties table has ID.
             // But we can filter by code in the URL: ?code=eq.CODE
             
             fetch(`${supabaseUrl}/rest/v1/parties?code=eq.${currentRoomCode}`, {
                method: 'DELETE',
                headers: headers,
                keepalive: true
            });
        }
    }
});



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

    // Sidebar Toggle Logic
    const btnToggle = document.getElementById('btn-toggle-sidebar');
    const sidebar = document.getElementById('ingame-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (btnToggle && sidebar) {
        btnToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('visible');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('visible');
        });
    }
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

// --- ANIMATED PLACEHOLDERS (TYPEWRITER EFFECT) ---
document.addEventListener('DOMContentLoaded', () => {
    const pseudoInput = document.getElementById('player-pseudo');
    const codeInput = document.getElementById('lobby-code-input');
    
    if (pseudoInput && codeInput) {
        const pseudos = ['COOLKID67', 'WORDSLAYER', 'TUSMASTER', 'WORDLE_KING', 'GUESS_WHO', 'ALPHA_WOLF', 'NINJA_WORD'];
        // Codes réalistes (Alphanumérique 5 chars)
        const codes = ['XJ9KZ', 'A7B2P', 'K9L1M', 'P4R5T', '9X2Y1', 'M3G4L', 'Q8W7E', 'Z1X2C'];
        
        animateInputPlaceholder(pseudoInput, pseudos, '');
        animateInputPlaceholder(codeInput, codes, '');
    }
});

function animateInputPlaceholder(input, texts, prefix = '') {
    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let currentFullText = prefix + texts[0];

    function type() {
        // Définir le texte cible actuel
        const targetText = prefix + texts[textIndex];
        
        if (isDeleting) {
            // Suppression
            currentFullText = targetText.substring(0, charIndex);
            charIndex--;
        } else {
            // Écriture
            currentFullText = targetText.substring(0, charIndex + 1);
            charIndex++;
        }

        input.setAttribute('placeholder', currentFullText);

        let typeSpeed = 100; // Vitesse de frappe normale

        if (!isDeleting && charIndex === targetText.length) {
            // Fin du mot : Pause longue avant d'effacer
            typeSpeed = 2000;
            isDeleting = true;
        } else if (isDeleting && charIndex < prefix.length) {
            // Fin de suppression (on a gardé le préfixe ou tout effacé)
            // Ici on efface jusqu'à la fin du préfixe pour garder "Ex: " ? 
            // Non, effaçons tout pour réécrire "Ex: NouveauMot" proprement ou juste le mot.
            // Simplification : on efface jusqu'au préfixe.
            isDeleting = false;
            textIndex = (textIndex + 1) % texts.length;
            typeSpeed = 500;
            // Reset charIndex pour recommencer à écrire après le préfixe
            charIndex = prefix.length; 
        } else if (isDeleting) {
            typeSpeed = 50; // Vitesse d'effacement rapide
        }

        setTimeout(type, typeSpeed);
    }

    // Initialiser charIndex à la longueur du préfixe pour commencer à écrire le mot direct
    charIndex = prefix.length;
    input.setAttribute('placeholder', prefix);
    setTimeout(type, 500);
}

// --- SESSION RESTORATION LOGIC ---

async function rejoinSession(code, playerId) {
    console.log("Restoring session for room:", code);
    
    // Hide lobby immediately to prevent flickering
    if (lobbyOverlay) lobbyOverlay.classList.add('hidden');
    
    currentRoomCode = code;
    // myPlayerId = playerId; // Don't set it yet, verify first
    myPseudo = sessionStorage.getItem('tusmatch_pseudo');
    // isHost = sessionStorage.getItem('tusmatch_is_host') === 'true'; // Verify later
    
    try {
        // Fetch party details to get the word and status
        const { data: party, error } = await supabaseClient
            .from('parties')
            .select('*')
            .eq('code', code)
            .single();
            
        if (error || !party) {
            console.error("Session invalid or party ended");
            sessionStorage.clear();
            if (lobbyOverlay) lobbyOverlay.classList.remove('hidden');
            return;
        }

        // Verify if player exists
        const { data: player } = await supabaseClient
            .from('joueurs')
            .select('*')
            .eq('id', playerId)
            .single();

        if (!player) {
            console.log("Player not found in DB (maybe deleted on close). Re-joining...");
            // Re-join as new player
            // We try to keep the same pseudo and host status if possible (but host might be taken)
            // If I was host, I try to reclaim it if no one else is.
            
            // Check if there is a host currently
            const { data: players } = await supabaseClient.from('joueurs').select('est_host').eq('partie_id', party.id);
            const hasHost = players && players.some(p => p.est_host);
            
            const shouldBeHost = !hasHost; // If no host, I become host
            
            await joinLobbyAsPlayer(party.id, myPseudo, shouldBeHost);
            // joinLobbyAsPlayer sets myPlayerId
            sessionStorage.setItem('tusmatch_player_id', myPlayerId);
            sessionStorage.setItem('tusmatch_is_host', shouldBeHost);
            isHost = shouldBeHost;
        } else {
            // Player exists
            myPlayerId = player.id;
            isHost = player.est_host;
            sessionStorage.setItem('tusmatch_is_host', isHost);
        }
        
        // Re-subscribe to realtime events
        subscribeToRoom(party.id);
        
        // Restore Game State
        if (typeof initGame === 'function') {
            // Initialize game with the correct word (handling mode prefix)
            let word = party.mot_a_trouver;
            if (word.includes(':')) {
                const parts = word.split(':');
                const modePrefix = parts[0].toLowerCase();
                if (['preums', 'libre', 'temps'].includes(modePrefix)) {
                    selectedGameMode = modePrefix;
                }
                
                if (modePrefix === 'temps' && parts.length === 3) {
                    currentChronoDuration = parseInt(parts[1], 10);
                    word = parts[2];
                    // Apply duration
                    if (typeof window.setChronoDuration === 'function') {
                        window.setChronoDuration(currentChronoDuration);
                    }
                } else {
                    word = parts[1];
                }
            }
            
            await initGame(word);
            
            // Update Sidebar Mode Display
            const modeDisplay = document.getElementById('sidebar-game-mode');
            if (modeDisplay) {
                modeDisplay.textContent = selectedGameMode || 'PREUMS';
            }
            
            // Restore guesses from session storage
            if (typeof window.loadGuessesFromSession === 'function') {
                window.loadGuessesFromSession();
            }
        }
        
        // Restore UI based on game status
        if (party.statut === 'attente') {
             showWaitingRoom(code);
             if (lobbyOverlay) lobbyOverlay.classList.remove('hidden');
        } else {
            // Game is running
            if (lobbyOverlay) lobbyOverlay.classList.add('hidden');
            
            // Show Sidebar and Opponents
            setupOpponentsUI();
            const sidebar = document.getElementById('ingame-sidebar');
            if (sidebar) sidebar.classList.remove('hidden');
            
            // Show Toggle Button
            const btnToggle = document.getElementById('btn-toggle-sidebar');
            if (btnToggle) btnToggle.classList.remove('hidden');
            
            // Refresh player list
            refreshPlayerList(party.id);
        }
        
    } catch (e) {
        console.error("Error rejoining session:", e);
        sessionStorage.clear();
        if (lobbyOverlay) lobbyOverlay.classList.remove('hidden');
    }
}

// --- AVATAR HELPER ---
function getDisplayName(pseudo) {
    if (!pseudo) return "Joueur";
    return pseudo.split('|')[0];
}

window.getAvatarUrl = function(pseudoString) {
    if (!pseudoString) return 'assets/1.gif';
    
    // Check for composite pseudo "Name|AvatarID"
    if (pseudoString.includes('|')) {
        const parts = pseudoString.split('|');
        const avatarId = parseInt(parts[1]);
        if (!isNaN(avatarId) && avatarId >= 1 && avatarId <= 12) {
            return `assets/${avatarId}.gif`;
        }
        // Fallback to name part if ID is invalid
        pseudoString = parts[0];
    }

    // Simple hash to get a consistent number between 1 and 12
    let hash = 0;
    for (let i = 0; i < pseudoString.length; i++) {
        hash = pseudoString.charCodeAt(i) + ((hash << 5) - hash);
    }
    const num = (Math.abs(hash) % 12) + 1;
    return `assets/${num}.gif`;
};

const getAvatarUrl = window.getAvatarUrl;

// --- ROUND END TIMER LOGIC ---

let roundTimerInterval = null;

async function handleRoundEnd(finRoundAt) {
    // 1. Fetch players for scoreboard (Initial fetch)
    const { data: party } = await supabaseClient.from('parties').select('id, mot_a_trouver').eq('code', currentRoomCode).single();
    if (!party) return;

    const { data: players } = await supabaseClient
        .from('joueurs')
        .select('*')
        .eq('partie_id', party.id);

    // Helper to show screen
    const proceedToShowScreen = async () => {
        // Calculate my score based on LAST VALID GUESS
        let myScore = 0;
        if (typeof window.calculateScore === 'function' && typeof guesses !== 'undefined' && typeof targetWord !== 'undefined') {
             let lastGuess = "";
             // Use helper if available
             if (typeof window.getLastValidGuess === 'function') {
                 const valid = window.getLastValidGuess();
                 if (valid) lastGuess = valid.word;
             } else {
                 lastGuess = guesses.length > 0 ? guesses[guesses.length - 1] : "";
             }
             
             myScore = window.calculateScore(lastRoundVictory, guesses.length, lastGuess);
        }

        // CRITICAL: If I am the loser (and haven't updated DB), I need to update my score in DB now.
        const me = players.find(p => p.id === myPlayerId);
        if (me && !me.a_fini) {
             await supabaseClient.from('joueurs').update({ 
                 score: (me.score || 0) + myScore,
                 a_fini: true 
             }).eq('id', myPlayerId);
        }

        // --- SYNC BARRIER START ---
        
        // 1. Show "Waiting" Screen immediately
        if (typeof showEndScreen === 'function') {
            // Pass null as word to trigger "Waiting" state
            showEndScreen(lastRoundVictory, null, players, myScore);
        }

        // 2. Send "ANIMATION_DONE" Signal
        await supabaseClient.from('essais').insert({
            partie_id: party.id,
            joueur_id: myPlayerId,
            numero_ligne: 99,
            pattern: 'ANIMATION_DONE'
        });

        // 3. Wait for ALL players to finish animation
        const checkSync = setInterval(async () => {
            // Safety: If time is up, force proceed
            const now = new Date().getTime();
            const end = new Date(finRoundAt).getTime();
            
            // Count signals
            const { count: signalCount } = await supabaseClient
                .from('essais')
                .select('*', { count: 'exact', head: true })
                .eq('partie_id', party.id)
                .eq('pattern', 'ANIMATION_DONE');
            
            // Count current players
            const { count: currentTotalPlayers } = await supabaseClient
                .from('joueurs')
                .select('*', { count: 'exact', head: true })
                .eq('partie_id', party.id);

            // Proceed if all ready OR timeout reached
            if ((signalCount >= currentTotalPlayers) || (now >= end)) {
                clearInterval(checkSync);
                
                // 4. Fetch Final Scores (Everyone should be updated now)
                const { data: finalPlayers } = await supabaseClient
                    .from('joueurs')
                    .select('*')
                    .eq('partie_id', party.id);

                // 5. Show FINAL Screen
                if (typeof showEndScreen === 'function') {
                    const victory = lastRoundVictory; 
                    let displayWord = party.mot_a_trouver;
                    if (displayWord && displayWord.includes(':')) {
                        const parts = displayWord.split(':');
                        displayWord = parts.length === 3 ? parts[2] : parts[1];
                    }
                    showEndScreen(victory, displayWord, finalPlayers, myScore);
                }
                
                // 6. Start Countdown Logic
                const btn = document.getElementById('restartBtn');
                if (btn) {
                    btn.disabled = true;
                    btn.classList.add('btn-disabled');
                }
            
                if (roundTimerInterval) clearInterval(roundTimerInterval);
            
                roundTimerInterval = setInterval(() => {
                    const nowLoop = new Date().getTime();
                    const endLoop = new Date(finRoundAt).getTime();
                    const diff = endLoop - nowLoop;
            
                    if (diff <= 0) {
                        clearInterval(roundTimerInterval);
                        if (btn) btn.textContent = "Lancement...";
                        if (isHost) triggerMultiplayerRestart();
                    } else {
                        const seconds = Math.ceil(diff / 1000);
                        if (btn) btn.textContent = `Prochaine manche dans ${seconds}s...`;
                    }
                }, 1000);
            }
        }, 1000); // Check every 1s
        // --- SYNC BARRIER END ---
    };

    // 2. Trigger Animation if needed
    if (window.isScoringAnimationPlaying) {
        // I am the winner (or finished naturally just now)
        // Wait for animation to finish
        const checkAnim = setInterval(() => {
            if (!window.isScoringAnimationPlaying) {
                clearInterval(checkAnim);
                proceedToShowScreen();
            }
        }, 100);
    } else if (!lastRoundVictory && typeof window.forceEndRoundAnimation === 'function') {
        // I am the loser (or finished long ago?)
        // Force animation
        window.forceEndRoundAnimation(() => {
            proceedToShowScreen();
        });
    } else {
        // Fallback
        proceedToShowScreen();
    }
}

// --- REACTIONS LOGIC ---

const REACTION_SVGS = {
    happy: `<svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="16" cy="16" r="14" fill="#FFD93D"/><circle cx="10" cy="14" r="2" fill="#5C3D2E"/><circle cx="22" cy="14" r="2" fill="#5C3D2E"/><path d="M10 20 Q16 26 22 20" stroke="#5C3D2E" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="7" cy="18" r="1.5" fill="#FF8B8B" opacity="0.6"/><circle cx="25" cy="18" r="1.5" fill="#FF8B8B" opacity="0.6"/></svg>`,
    sad: `<svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="16" cy="16" r="14" fill="#89CFF0"/><path d="M9 14 Q11 12 13 14" stroke="#1A5F7A" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M19 14 Q21 12 23 14" stroke="#1A5F7A" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M12 22 Q16 18 20 22" stroke="#1A5F7A" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="23" cy="18" r="1.5" fill="#4FA3D1"/></svg>`,
    angry: `<svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="16" cy="16" r="14" fill="#FF6B6B"/><path d="M9 13 L13 15" stroke="#8B0000" stroke-width="2" stroke-linecap="round"/><path d="M23 13 L19 15" stroke="#8B0000" stroke-width="2" stroke-linecap="round"/><circle cx="11" cy="17" r="1.5" fill="#8B0000"/><circle cx="21" cy="17" r="1.5" fill="#8B0000"/><path d="M13 22 H19" stroke="#8B0000" stroke-width="2" stroke-linecap="round"/></svg>`,
    surprised: `<svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="16" cy="16" r="14" fill="#C780FA"/><circle cx="10" cy="14" r="2" fill="#4A148C"/><circle cx="22" cy="14" r="2" fill="#4A148C"/><ellipse cx="16" cy="22" rx="3" ry="4" fill="#4A148C"/><path d="M8 10 Q10 8 12 10" stroke="#4A148C" stroke-width="1" fill="none"/><path d="M20 10 Q22 8 24 10" stroke="#4A148C" stroke-width="1" fill="none"/></svg>`
};

window.sendReaction = function(type) {
    if (!roomChannel) return;
    
    // Show locally immediately
    showReaction(type, myPlayerId);
    
    roomChannel.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { type: type, id: myPlayerId }
    });
};

window.showReaction = function(type, playerId) {
    const svgContent = REACTION_SVGS[type];
    if (!svgContent) return;

    // Find target element to float from
    let targetEl = null;
    
    if (playerId === myPlayerId) {
        // My reaction: float from center screen
        targetEl = document.querySelector('.game-container'); 
    } else {
        // Opponent reaction: float from their card
        targetEl = document.getElementById(`opp-${playerId}`);
    }

    if (!targetEl) return;

    const reactionEl = document.createElement('div');
    reactionEl.className = 'floating-reaction';
    reactionEl.innerHTML = svgContent;
    
    // Position logic
    const rect = targetEl.getBoundingClientRect();
    
    // If it's an opponent card
    if (targetEl.id && targetEl.id.startsWith('opp-')) {
        reactionEl.style.left = (rect.left + rect.width / 2 - 30) + 'px';
        reactionEl.style.top = (rect.top + rect.height / 2) + 'px';
    } else {
        // Me (center screen)
        reactionEl.style.left = '50%';
        reactionEl.style.top = '50%';
        reactionEl.style.transform = 'translate(-50%, -50%)';
    }

    document.body.appendChild(reactionEl);
    
    setTimeout(() => {
        reactionEl.remove();
    }, 2500);
};
