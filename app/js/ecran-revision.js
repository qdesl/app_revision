// Écran de révision, façon cartes : on retourne la carte (énoncé → corrigé dévoilé étape
// par étape), puis on la glisse à droite (réussi) ou à gauche (à revoir) — ou on utilise
// les deux gros boutons.
// Une question ratée revient plus loin dans la même séance (une fois).

import { rendre } from './markdown.js';
import { enregistrer } from './revision.js';
import { icone } from './icones.js';

const NOMS_NIVEAUX = { 1: 'Restitution', 2: 'Application', 3: 'Niveau partiel' };
const ECART_REPRISE = 3; // une question ratée revient 3 questions plus loin

const echapper = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// ecran : { vue, bas, progression } ; file : [{ q, matiere, chapitre }] ; fin() : appelée en quittant le bilan.
export function lancerSeance(ecran, file, { fin }) {
  const { vue, bas, progression } = ecran;
  file = [...file];
  const total = file.length;
  const dejaReprises = new Set();
  const bilan = { reussies: 0, ratees: [] };
  let faites = 0;

  function afficherQuestion(sens = 0) {
    if (!file.length) return afficherBilan();
    const { q } = file[0];
    let etapesVisibles = 0;
    let retournee = false;

    progression.hidden = false;
    progression.firstElementChild.style.width = `${(faites / (total + dejaReprises.size)) * 100}%`;
    const meta = `
      <div class="meta-question">
        <span class="badge-niveau niveau-${q.niveau}">Niveau ${q.niveau} · ${NOMS_NIVEAUX[q.niveau]}</span>
        ${q.section ? `<span class="section-question">${echapper(q.section)}</span>` : ''}
      </div>`;
    vue.innerHTML = `
      <div class="pile${file.length > 1 ? ' avec-suite' : ''}">
        <article class="carte-question${sens ? ' arrivee-pile' : ''}">
          <div class="faces">
            <div class="face recto">
              ${meta}
              <div class="section enonce">${rendre(q.enonce)}</div>
              ${q.source ? `<p class="source-question">Source : ${echapper(q.source)}</p>` : ''}
              <p class="indice">${icone('rotate-ccw')} Touche la carte pour voir le corrigé</p>
            </div>
            <div class="face verso">
              ${meta}
              <div class="section rappel">${rendre(q.enonce)}</div>
              <ol class="corrige"></ol>
            </div>
          </div>
          <span class="tampon tampon-reussi">${icone('check')} Réussi</span>
          <span class="tampon tampon-rate">${icone('rotate-ccw')} À revoir</span>
        </article>
      </div>
      <p class="aide-glisser" hidden>${icone('chevron-left')} À revoir · glisse la carte · Réussi ${icone('chevron-right')}</p>`;
    window.scrollTo(0, 0);
    const carte = vue.querySelector('.carte-question');
    const liste = vue.querySelector('.corrige');
    const aide = vue.querySelector('.aide-glisser');
    const fini = () => etapesVisibles >= q.corrige.length;

    const boutonsEtapes = () => {
      const reste = q.corrige.length - etapesVisibles;
      bas.innerHTML = !retournee
        ? `<button class="action principal" data-action="etape">${icone('rotate-ccw')} Retourner la carte</button>`
        : `<button class="action discret" data-action="tout">Tout voir</button>
           <button class="action principal" data-action="etape">Étape suivante · ${reste}</button>`;
    };
    const boutonsReponse = () => {
      bas.innerHTML = `
        <button class="action rate" data-action="rate">${icone('rotate-ccw')} À revoir</button>
        <button class="action reussi" data-action="reussi">${icone('check')} Réussi</button>`;
    };
    const montrerEtapes = jusqua => {
      if (!retournee) {
        retournee = true;
        carte.classList.add('retournee');
      }
      while (etapesVisibles < Math.min(jusqua, q.corrige.length)) {
        const li = document.createElement('li');
        li.innerHTML = rendre(q.corrige[etapesVisibles++]);
        liste.append(li);
      }
      if (etapesVisibles > 1) liste.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (fini()) {
        boutonsReponse();
        aide.hidden = false;
      } else {
        boutonsEtapes();
      }
    };

    // La carte s'envole à droite (réussi) ou à gauche (à revoir), puis on passe à la suivante.
    const envoler = reussi => {
      carte.classList.add('envol');
      carte.style.transform = `translateX(${reussi ? 130 : -130}vw) rotate(${reussi ? 22 : -22}deg)`;
      carte.style.setProperty('--tampon-reussi', reussi ? 1 : 0);
      carte.style.setProperty('--tampon-rate', reussi ? 0 : 1);
      bas.onclick = null;
      setTimeout(() => repondre(reussi), 230);
    };

    bas.hidden = false;
    boutonsEtapes();
    bas.onclick = e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'etape') montrerEtapes(etapesVisibles + 1);
      if (action === 'tout') montrerEtapes(q.corrige.length);
      if (action === 'rate' || action === 'reussi') envoler(action === 'reussi');
    };
    carte.addEventListener('click', () => { if (!retournee) montrerEtapes(1); });

    // Glisser la carte : seulement une fois le corrigé entier affiché.
    let depart = null;
    carte.addEventListener('touchstart', e => {
      if (!fini() || e.touches.length !== 1 || e.target.closest('.formule-bloc, .defile, pre')) return;
      depart = { x: e.touches[0].clientX, y: e.touches[0].clientY, instant: performance.now(), axe: null, dx: 0 };
    }, { passive: true });
    carte.addEventListener('touchmove', e => {
      if (!depart) return;
      const dx = e.touches[0].clientX - depart.x, dy = e.touches[0].clientY - depart.y;
      if (!depart.axe) {
        if (Math.hypot(dx, dy) < 10) return;
        depart.axe = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
        if (depart.axe === 'h') carte.style.transition = 'none';
      }
      if (depart.axe !== 'h') return;
      depart.dx = dx;
      const part = Math.min(Math.abs(dx) / (window.innerWidth * 0.35), 1);
      carte.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
      carte.style.setProperty('--tampon-reussi', dx > 0 ? part : 0);
      carte.style.setProperty('--tampon-rate', dx < 0 ? part : 0);
    }, { passive: true });
    const lacher = () => {
      if (!depart) return;
      const { dx, instant, axe } = depart;
      depart = null;
      if (axe !== 'h') return;
      carte.style.transition = '';
      const vitesse = Math.abs(dx) / (performance.now() - instant);
      if (Math.abs(dx) > window.innerWidth * 0.3 || (vitesse > 0.6 && Math.abs(dx) > 50)) {
        navigator.vibrate?.(6);
        envoler(dx > 0);
      } else {
        carte.style.transform = '';
        carte.style.setProperty('--tampon-reussi', 0);
        carte.style.setProperty('--tampon-rate', 0);
      }
    };
    carte.addEventListener('touchend', lacher, { passive: true });
    carte.addEventListener('touchcancel', lacher, { passive: true });
  }

  function repondre(reussi) {
    const element = file.shift();
    const { q, matiere, chapitre } = element;
    enregistrer(q, matiere, chapitre, reussi, { reprise: !!element.reprise });
    faites++;
    if (reussi) {
      bilan.reussies++;
    } else {
      if (!bilan.ratees.includes(q)) bilan.ratees.push(q);
      if (!dejaReprises.has(q.id)) {
        dejaReprises.add(q.id);
        file.splice(Math.min(ECART_REPRISE, file.length), 0, { ...element, reprise: true });
      }
    }
    afficherQuestion(1);
  }

  function afficherBilan() {
    progression.firstElementChild.style.width = '100%';
    const reussiesPremiere = total - bilan.ratees.length;
    vue.innerHTML = `
      <section class="bilan arrivee-droite">
        <div class="score">${reussiesPremiere}<small> / ${total}</small></div>
        <p class="bilan-texte">${reussiesPremiere === total ? 'Tout juste du premier coup 🎉'
          : 'réussies du premier coup'}</p>
        ${bilan.ratees.length ? `
          <h3>À revoir</h3>
          <ul class="liste-ratees">${bilan.ratees.map(q =>
            `<li><span class="badge-niveau niveau-${q.niveau}">${q.niveau}</span><div class="texte-ratee">${rendre(q.enonce)}</div></li>`).join('')}
          </ul>
          <p class="bilan-texte discret">Elles reviendront demain.</p>` : ''}
      </section>`;
    bas.innerHTML = `<button class="action principal" data-action="fin">Terminer</button>`;
    bas.onclick = e => { if (e.target.closest('[data-action="fin"]')) fin(); };
  }

  afficherQuestion();
}
