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
const choix = document.getElementById('reglages-choix');

function dessinerPanneau() {
  choix.innerHTML = `
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

choix.addEventListener('click', evenement => {
  const bouton = evenement.target.closest('button');
  if (!bouton) return;
  if (bouton.dataset.theme) changer({ theme: bouton.dataset.theme });
  if (bouton.dataset.taille) changerTaille(Number(bouton.dataset.taille));
});

// Panneau qui monte du bas de l'écran ; on le ferme en touchant à côté, en le tirant vers le bas
// ou avec Échap.
const voile = document.getElementById('voile');

function ouvrir(ouvert) {
  panneau.hidden = !ouvert;
  voile.hidden = !ouvert;
}

voile.addEventListener('click', () => ouvrir(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') ouvrir(false); });
window.addEventListener('hashchange', () => ouvrir(false));

let departY = null;
panneau.addEventListener('touchstart', e => { departY = e.touches[0].clientY; }, { passive: true });
panneau.addEventListener('touchmove', e => {
  const dy = e.touches[0].clientY - departY;
  if (dy > 0) { panneau.style.transition = 'none'; panneau.style.transform = `translateY(${dy}px)`; }
}, { passive: true });
panneau.addEventListener('touchend', e => {
  const dy = e.changedTouches[0].clientY - departY;
  panneau.style.transition = '';
  panneau.style.transform = '';
  if (dy > 60) ouvrir(false);
}, { passive: true });

document.getElementById('bouton-reglages').addEventListener('click', () => {
  ouvrir(panneau.hidden);
});

appliquer();
dessinerPanneau();
