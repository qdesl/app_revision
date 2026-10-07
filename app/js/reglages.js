// Réglages d'affichage : thème (auto / clair / sombre) et taille du texte.

import { lire, ecrire } from './stockage.js';

const TAILLES = [15, 16, 18, 20, 22, 25, 28]; // px
const THEMES = { auto: 'Auto', clair: 'Clair', sombre: 'Sombre' };

let reglages = { theme: 'auto', taille: 18, ...lire('reglages', {}) };

function appliquer() {
  const racine = document.documentElement;
  if (reglages.theme === 'auto') delete racine.dataset.theme;
  else racine.dataset.theme = reglages.theme;
  racine.style.setProperty('--taille-texte', `${reglages.taille}px`);
}

function changer(modif) {
  reglages = { ...reglages, ...modif };
  ecrire('reglages', reglages);
  appliquer();
  dessinerPanneau();
}

function changerTaille(sens) {
  const i = TAILLES.indexOf(reglages.taille);
  const suivant = TAILLES[Math.min(TAILLES.length - 1, Math.max(0, (i < 0 ? 2 : i) + sens))];
  changer({ taille: suivant });
}

const panneau = document.getElementById('reglages');

function dessinerPanneau() {
  panneau.innerHTML = `
    <div class="reglage">
      <span>Thème</span>
      <div class="choix">
        ${Object.entries(THEMES).map(([id, nom]) =>
          `<button data-theme="${id}" aria-pressed="${reglages.theme === id}">${nom}</button>`).join('')}
      </div>
    </div>
    <div class="reglage">
      <span>Texte</span>
      <div class="choix">
        <button data-taille="-1" aria-label="Plus petit">A−</button>
        <output>${reglages.taille}</output>
        <button data-taille="1" aria-label="Plus grand">A+</button>
      </div>
    </div>`;
}

panneau.addEventListener('click', evenement => {
  const bouton = evenement.target.closest('button');
  if (!bouton) return;
  if (bouton.dataset.theme) changer({ theme: bouton.dataset.theme });
  if (bouton.dataset.taille) changerTaille(Number(bouton.dataset.taille));
});

document.getElementById('bouton-reglages').addEventListener('click', () => {
  panneau.hidden = !panneau.hidden;
});

appliquer();
dessinerPanneau();
