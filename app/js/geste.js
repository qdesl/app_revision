// Balayage horizontal qui suit le doigt : la section glisse sous le doigt, puis on passe
// à la suivante / précédente si on a tiré assez loin (ou d'un coup sec), sinon elle revient.
// Ignoré quand le doigt part d'une zone qui défile elle-même (équation, tableau, code).

const SEUIL_AXE = 10;        // px avant de décider si le geste est horizontal ou vertical
const SEUIL_PAGE = 0.25;     // part de la largeur à dépasser pour changer de section
const VITESSE_MIN = 0.5;     // px/ms : un coup sec suffit, même court
const RESISTANCE = 0.3;      // au bord (pas de section avant / après), la page résiste

// zone : élément qui reçoit les gestes ; cible() : élément à déplacer (la section affichée) ;
// peutAller(sens) : vrai s'il existe une section dans ce sens ; aller(sens) : change de section.
export function activerBalayage(zone, { cible, peutAller, aller }) {
  let geste = null;

  zone.addEventListener('touchstart', e => {
    const element = cible();
    if (!element || e.touches.length !== 1 || e.target.closest('.formule-bloc, .defile, pre')) {
      geste = null;
      return;
    }
    const t = e.touches[0];
    geste = { element, x: t.clientX, y: t.clientY, dx: 0, instant: performance.now(), axe: null };
  }, { passive: true });

  zone.addEventListener('touchmove', e => {
    if (!geste) return;
    const t = e.touches[0];
    const dx = t.clientX - geste.x, dy = t.clientY - geste.y;
    if (!geste.axe) {
      if (Math.hypot(dx, dy) < SEUIL_AXE) return;
      geste.axe = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
      if (geste.axe === 'h') geste.element.style.transition = 'none';
    }
    if (geste.axe !== 'h') return;
    const sens = dx < 0 ? 1 : -1;
    geste.dx = peutAller(sens) ? dx : dx * RESISTANCE;
    geste.element.style.transform = `translateX(${geste.dx}px)`;
    geste.element.style.opacity = String(1 - Math.min(Math.abs(geste.dx) / window.innerWidth, 1) * 0.5);
  }, { passive: true });

  const finir = () => {
    if (!geste || geste.axe !== 'h') { geste = null; return; }
    const { element, dx, instant } = geste;
    geste = null;
    const sens = dx < 0 ? 1 : -1;
    const vitesse = Math.abs(dx) / (performance.now() - instant);
    const assezLoin = Math.abs(dx) > window.innerWidth * SEUIL_PAGE || (vitesse > VITESSE_MIN && Math.abs(dx) > 40);

    element.style.transition = '';
    if (assezLoin && peutAller(sens)) {
      // La section part dans le sens du geste, la suivante arrive de l'autre côté.
      element.style.transform = `translateX(${-sens * window.innerWidth}px)`;
      element.style.opacity = '0';
      navigator.vibrate?.(6);
      setTimeout(() => aller(sens), 140);
    } else {
      element.style.transform = '';
      element.style.opacity = '';
    }
  };
  zone.addEventListener('touchend', finir, { passive: true });
  zone.addEventListener('touchcancel', finir, { passive: true });
}
