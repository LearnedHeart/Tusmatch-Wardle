// home.js
const themeBtn = document.getElementById('themeToggle');
const body = document.body;

// Gestion des thèmes (cycle: Light -> Dark -> Colorful)
const themes = ['', 'dark', 'colorful'];
let currentThemeIndex = 0;

function themeLabel(cls) {
    if (!cls || cls === '') return 'Light';
    if (cls === 'dark') return 'Dark';
    if (cls === 'colorful') return 'Colorful';
    return 'Light';
}

// Charger le thème sauvegardé (par défaut 'colorful')
const savedTheme = localStorage.getItem('theme') || 'colorful';
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