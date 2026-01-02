// home.js
const themeBtn = document.getElementById('themeToggle');
const body = document.body;

// Gestion des thèmes (cycle: Coloré -> Claire -> Sombre)
const themes = ['', 'claire', 'sombre'];
let currentThemeIndex = 0;

function themeLabel(cls) {
    // SVG Icons for themes
    const sunIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    const moonIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    const sparklesIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>';

    if (!cls || cls === '') return sparklesIcon; // Coloré -> Paillettes
    if (cls === 'claire') return sunIcon; // Claire -> Soleil
    if (cls === 'sombre') return moonIcon; // Sombre -> Lune
    return sparklesIcon;
}

// Charger le thème sauvegardé (par défaut 'claire' -> Claire)
const savedTheme = localStorage.getItem('theme') || 'claire';
body.className = savedTheme;
currentThemeIndex = themes.indexOf(savedTheme);

// Initialiser le texte du bouton
themeBtn.innerHTML = themeLabel(body.className);

themeBtn.addEventListener('click', () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    const newTheme = themes[currentThemeIndex];
    
    body.className = newTheme;
    localStorage.setItem('theme', newTheme);
    themeBtn.innerHTML = themeLabel(newTheme);
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