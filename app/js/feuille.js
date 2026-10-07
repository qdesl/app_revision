// Panneau qui monte du bas de l'écran (« feuille »), avec un voile sombre derrière.
// On le ferme en touchant le voile, en le tirant vers le bas, avec Échap ou en changeant de page.

const voile = document.getElementById('voile');
const feuilles = new Set();

function toutFermer() {
  feuilles.forEach(f => f.ouvrir(false));
}

voile.addEventListener('click', toutFermer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') toutFermer(); });
window.addEventListener('hashchange', toutFermer);

export function creerFeuille(element) {
  const feuille = {
    ouverte: () => !element.hidden,
    ouvrir(ouvert) {
      if (ouvert) feuilles.forEach(f => f !== feuille && f.ouvrir(false));
      element.hidden = !ouvert;
      voile.hidden = ![...feuilles].some(f => f.ouverte());
    },
  };
  feuilles.add(feuille);

  // Tirer vers le bas pour fermer (sauf si le contenu est défilé : on laisse défiler).
  let depart = null;
  element.addEventListener('touchstart', e => {
    depart = element.scrollTop > 0 ? null : e.touches[0].clientY;
  }, { passive: true });
  element.addEventListener('touchmove', e => {
    if (depart === null) return;
    const dy = e.touches[0].clientY - depart;
    if (dy > 0) {
      element.style.transition = 'none';
      element.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });
  element.addEventListener('touchend', e => {
    if (depart === null) return;
    const dy = e.changedTouches[0].clientY - depart;
    element.style.transition = '';
    element.style.transform = '';
    depart = null;
    if (dy > 60) feuille.ouvrir(false);
  }, { passive: true });

  return feuille;
}
