// Écran de révision : une question à la fois, corrigé dévoilé étape par étape,
// puis auto-évaluation « À revoir » / « Réussi ».
// Une question ratée revient plus loin dans la même séance (une fois).

import { rendre } from './markdown.js';
import { enregistrer } from './revision.js';

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

    progression.hidden = false;
    progression.firstElementChild.style.width = `${(faites / (total + dejaReprises.size)) * 100}%`;
    vue.innerHTML = `
      <article class="carte-question${sens ? ' arrivee-droite' : ''}">
        <div class="meta-question">
          <span class="badge-niveau niveau-${q.niveau}">Niveau ${q.niveau} · ${NOMS_NIVEAUX[q.niveau]}</span>
          ${q.section ? `<span class="section-question">${echapper(q.section)}</span>` : ''}
        </div>
        <div class="section enonce">${rendre(q.enonce)}</div>
        ${q.source ? `<p class="source-question">Source : ${echapper(q.source)}</p>` : ''}
        <ol class="corrige" hidden></ol>
      </article>`;
    window.scrollTo(0, 0);
    const liste = vue.querySelector('.corrige');

    const boutonsEtapes = () => {
      const reste = q.corrige.length - etapesVisibles;
      bas.innerHTML = etapesVisibles === 0
        ? `<button class="action principal" data-action="etape">Voir le corrigé</button>`
        : `<button class="action discret" data-action="tout">Tout voir</button>
           <button class="action principal" data-action="etape">Étape suivante · ${reste}</button>`;
    };
    const boutonsReponse = () => {
      bas.innerHTML = `
        <button class="action rate" data-action="rate">✗ À revoir</button>
        <button class="action reussi" data-action="reussi">✓ Réussi</button>`;
    };
    const montrerEtapes = jusqua => {
      liste.hidden = false;
      while (etapesVisibles < jusqua) {
        const li = document.createElement('li');
        li.innerHTML = rendre(q.corrige[etapesVisibles++]);
        liste.append(li);
      }
      liste.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (etapesVisibles >= q.corrige.length) boutonsReponse(); else boutonsEtapes();
    };

    bas.hidden = false;
    boutonsEtapes();
    bas.onclick = e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'etape') montrerEtapes(etapesVisibles + 1);
      if (action === 'tout') montrerEtapes(q.corrige.length);
      if (action === 'rate' || action === 'reussi') repondre(action === 'reussi');
    };
  }

  function repondre(reussi) {
    const element = file.shift();
    const { q, matiere, chapitre } = element;
    enregistrer(q, matiere, chapitre, reussi, { reprise: !!element.reprise });
    faites++;
    navigator.vibrate?.(reussi ? 8 : [6, 40, 6]);
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
