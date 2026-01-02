// home.js
const themeBtn = document.getElementById('themeToggle');
const body = document.body;

// Gestion des thèmes (cycle: Coloré -> Claire -> Sombre)
const themes = ['', 'claire', 'sombre'];
let currentThemeIndex = 0;

function themeLabel(cls) {
    if (!cls || cls === '') return 'Coloré';
    if (cls === 'claire') return 'Claire';
    if (cls === 'sombre') return 'Sombre';
    return 'Coloré';
}

// Charger le thème sauvegardé (par défaut 'claire' -> Claire)
const savedTheme = localStorage.getItem('theme') || 'claire';
body.className = savedTheme;
currentThemeIndex = themes.indexOf(savedTheme);

// Initialiser le texte du bouton
themeBtn.textContent = themeLabel(body.className);

themeBtn.addEventListener('click', () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    const newTheme = themes[currentThemeIndex];
    
    body.className = newTheme;
    localStorage.setItem('theme', newTheme);
    themeBtn.textContent = themeLabel(newTheme);
});

// Gestion de la modale de règles
const helpBtn = document.getElementById('helpBtn');
const rulesModal = document.getElementById('rules-modal');
const closeRulesBtn = document.getElementById('close-rules');

if (helpBtn && rulesModal) {
    helpBtn.addEventListener('click', () => {
        rulesModal.classList.remove('hidden');
    });

    closeRulesBtn.addEventListener('click', () => {
        rulesModal.classList.add('hidden');
    });

    rulesModal.addEventListener('click', (e) => {
        if (e.target === rulesModal) {
            rulesModal.classList.add('hidden');
        }
    });
}