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

// Charger le thème sauvegardé (par défaut '' -> Coloré)
const savedTheme = localStorage.getItem('theme') || '';
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