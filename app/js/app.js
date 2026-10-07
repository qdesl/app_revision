// Point d'entrée de l'app : chargement de l'index des cours et navigation.
//
// Adresses (dans le #) :
//   #/                                       accueil, liste des matières et chapitres
//   #/<doc>/<matière>/<chapitre>/<n>         section n de la fiche de révision (doc = fiche) ou du cours (doc = cours)
//   #/notations/<matière>                    glossaire des notations de la matière, sur une seule page

import { decouper } from './markdown.js';
import { lire, ecrire } from './stockage.js';
import './reglages.js';

const RACINE_COURS = '../matieres/';
const DOCUMENTS = { fiche: 'Fiche', cours: 'Cours complet' };

const vue = document.getElementById('vue');
const titre = document.getElementById('titre');
const retour = document.getElementById('retour');
const bas = document.getElementById('bas');

let index = null;            // contenu de matieres/index.json
const cacheSections = {};    // chemin du .md → sections déjà découpées
let lecture = null;          // { lien(i), n, total } quand une section est affichée
let pagePrecedente = '#/';   // pour revenir d'un glossaire à la section qu'on lisait

const echapper = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

async function chargerIndex() {
  if (!index) {
    const reponse = await fetch(RACINE_COURS + 'index.json', { cache: 'no-cache' });
    if (!reponse.ok) throw new Error(`index.json introuvable (${reponse.status})`);
    index = await reponse.json();
  }
  return index;
}

async function chargerSections(fichier) {
  if (!cacheSections[fichier]) {
    const reponse = await fetch(RACINE_COURS + fichier);
    if (!reponse.ok) throw new Error(`${fichier} introuvable (${reponse.status})`);
    const base = RACINE_COURS + fichier.replace(/[^/]*$/, '');
    cacheSections[fichier] = decouper(await reponse.text(), base);
  }
  return cacheSections[fichier];
}

function trouverMatiere(idMatiere) {
  const matiere = index.matieres.find(m => m.id === idMatiere);
  if (!matiere) throw new Error('Matière introuvable');
  return matiere;
}

function trouverChapitre(idMatiere, idChapitre) {
  const matiere = index.matieres.find(m => m.id === idMatiere);
  const chapitre = matiere?.chapitres.find(c => c.id === idChapitre);
  if (!chapitre) throw new Error('Chapitre introuvable');
  return { matiere, chapitre };
}

// Fichier d'un document du chapitre (la fiche est facultative).
const fichierDe = (chapitre, doc) => (doc === 'fiche' ? chapitre.fiche : chapitre.fichier);
// Document ouvert par défaut : la fiche si elle existe, sinon le cours.
const docParDefaut = chapitre => (chapitre.fiche ? 'fiche' : 'cours');

// Position de lecture : dernière section lue de chaque document, et dernier document ouvert.
const positions = lire('positions', {});
const cle = (doc, idMatiere, idChapitre) => `${doc}/${idMatiere}/${idChapitre}`;
const lienPosition = (doc, idMatiere, idChapitre) =>
  `#/${doc}/${idMatiere}/${idChapitre}/${positions[cle(doc, idMatiere, idChapitre)] ?? 0}`;

function memoriserPosition(doc, idMatiere, idChapitre, n) {
  positions[cle(doc, idMatiere, idChapitre)] = n;
  ecrire('positions', positions);
  ecrire('derniere-lecture', { doc, matiere: idMatiere, chapitre: idChapitre });
}

function afficherAccueil() {
  titre.textContent = 'Révisions';
  retour.hidden = true;
  retour.href = '#/';
  bas.hidden = true;
  lecture = null;
  if (!index.matieres.length) {
    vue.innerHTML = '<p class="vide">Aucun cours pour l\'instant.</p>';
    return;
  }

  let reprise = '';
  const derniere = lire('derniere-lecture', null);
  if (derniere?.doc) {
    try {
      const { chapitre } = trouverChapitre(derniere.matiere, derniere.chapitre);
      if (!fichierDe(chapitre, derniere.doc)) throw new Error('document supprimé');
      const n = positions[cle(derniere.doc, derniere.matiere, derniere.chapitre)] ?? 0;
      reprise = `<a class="reprise" href="${lienPosition(derniere.doc, derniere.matiere, derniere.chapitre)}">
        <small>Reprendre · ${DOCUMENTS[derniere.doc]}</small>${echapper(chapitre.titre)} · section ${n + 1}</a>`;
    } catch {
      // chapitre ou document supprimé depuis : pas de reprise
    }
  }

  vue.innerHTML = reprise + index.matieres.map(m => `
    <section class="matiere">
      <h2>${echapper(m.nom)}${m.notations ? ` <a class="lien-notations" href="#/notations/${m.id}">Notations</a>` : ''}</h2>
      <ul class="liste">
        ${m.chapitres.map(c => `<li><a href="${lienPosition(docParDefaut(c), m.id, c.id)}">${echapper(c.titre)}
          ${c.fiche ? '<small class="etiquette">fiche</small>' : ''}</a></li>`).join('')}
      </ul>
    </section>`).join('');
}

async function afficherSection(doc, idMatiere, idChapitre, n) {
  const { matiere, chapitre } = trouverChapitre(idMatiere, idChapitre);
  if (!DOCUMENTS[doc] || !fichierDe(chapitre, doc)) doc = 'cours';
  const sections = await chargerSections(fichierDe(chapitre, doc));
  n = Math.min(Math.max(0, n), sections.length - 1);
  const lien = i => `#/${doc}/${idMatiere}/${idChapitre}/${i}`;
  lecture = { lien, n, total: sections.length };
  memoriserPosition(doc, idMatiere, idChapitre, n);

  // Onglets Fiche / Cours complet, seulement si le chapitre a une fiche.
  const onglets = chapitre.fiche ? `
    <nav class="onglets">
      ${Object.entries(DOCUMENTS).map(([id, nom]) =>
        `<a href="${lienPosition(id, idMatiere, idChapitre)}" aria-current="${id === doc}">${nom}</a>`).join('')}
    </nav>` : '';

  const notations = matiere.notations ? `<a class="lien-notations" href="#/notations/${idMatiere}">Notations</a>` : '';

  titre.textContent = chapitre.titre;
  retour.hidden = false;
  retour.href = '#/';
  vue.innerHTML = `${onglets}
    <p class="position">Section ${n + 1} / ${sections.length}${notations}</p>
    <article class="section">${sections[n].html}</article>`;
  bas.hidden = false;
  bas.innerHTML = `
    <a href="${lien(n - 1)}" aria-disabled="${n === 0}">‹ Précédent</a>
    <a href="${lien(n + 1)}" aria-disabled="${n === sections.length - 1}">Suivant ›</a>`;
  window.scrollTo(0, 0);
}

async function afficherNotations(idMatiere) {
  const matiere = trouverMatiere(idMatiere);
  if (!matiere.notations) throw new Error('Pas de notations pour cette matière');
  const sections = await chargerSections(matiere.notations);
  lecture = null;
  titre.textContent = `Notations · ${matiere.nom}`;
  retour.hidden = false;
  // Le retour ramène à la section qu'on lisait (ou à l'accueil).
  retour.href = pagePrecedente.startsWith('#/notations') ? '#/' : pagePrecedente;
  bas.hidden = true;
  vue.innerHTML = `<article class="section">${sections.map(s => s.html).join('')}</article>`;
  window.scrollTo(0, 0);
}

function allerA(sens) {
  if (!lecture) return;
  const i = lecture.n + sens;
  if (i >= 0 && i < lecture.total) location.replace(lecture.lien(i));
}

// Précédent / suivant remplacent l'entrée de l'historique : le bouton « retour »
// d'Android ramène à l'accueil au lieu de remonter section par section.
bas.addEventListener('click', e => {
  const lien = e.target.closest('a');
  if (!lien) return;
  e.preventDefault();
  if (lien.getAttribute('aria-disabled') !== 'true') location.replace(lien.getAttribute('href'));
});

// Balayage horizontal : section suivante / précédente.
// Ignoré quand le doigt part d'une zone qui défile elle-même (équation, tableau, code).
let depart = null;
vue.addEventListener('touchstart', e => {
  const t = e.touches[0];
  depart = e.touches.length === 1 && !e.target.closest('.formule-bloc, .defile, pre')
    ? { x: t.clientX, y: t.clientY, instant: Date.now() } : null;
}, { passive: true });
vue.addEventListener('touchend', e => {
  if (!depart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - depart.x, dy = t.clientY - depart.y;
  if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy) && Date.now() - depart.instant < 600) {
    allerA(dx < 0 ? 1 : -1);
  }
  depart = null;
}, { passive: true });

// Flèches du clavier (sur PC).
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') allerA(1);
  if (e.key === 'ArrowLeft') allerA(-1);
});

async function router() {
  try {
    await chargerIndex();
    const [page, ...args] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    if (DOCUMENTS[page]) await afficherSection(page, args[0], args[1], Number(args[2]) || 0);
    else if (page === 'notations') await afficherNotations(args[0]);
    else afficherAccueil();
    if (page !== 'notations') pagePrecedente = location.hash || '#/';
  } catch (erreur) {
    bas.hidden = true;
    vue.innerHTML = `<p class="erreur">Erreur : ${echapper(erreur.message)}</p>`;
  }
}

window.addEventListener('hashchange', router);
// Les scripts « defer » (KaTeX, marked) sont chargés avant l'évènement DOMContentLoaded.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', router);
else router();
