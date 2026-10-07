// Point d'entrée de l'app : chargement de l'index des cours et navigation.
//
// Adresses (dans le #) :
//   #/                                       accueil, liste des matières et chapitres
//   #/<doc>/<matière>/<chapitre>/<n>         section n de la fiche de révision (doc = fiche) ou du cours (doc = cours)
//   #/notations/<matière>                    glossaire des notations de la matière, sur une seule page
//   #/reviser/<matière>/<chapitre>           séance de révision du chapitre (questions)

import { decouper } from './markdown.js';
import { lire, ecrire } from './stockage.js';
import { activerBalayage } from './geste.js';
import { aReviser, enAvance, prochaineRevision } from './revision.js';
import { lancerSeance } from './ecran-revision.js';
import { icone } from './icones.js';
import './reglages.js';
import './horsligne.js';

const RACINE_COURS = '../matieres/';
const DOCUMENTS = { fiche: 'Fiche', cours: 'Cours complet' };
const QUESTIONS_PAR_SEANCE = 10;

const vue = document.getElementById('vue');
const titre = document.getElementById('titre');
const retour = document.getElementById('retour');
const bas = document.getElementById('bas');
const progression = document.getElementById('progression');

let index = null;            // contenu de matieres/index.json
const cacheSections = {};    // chemin du .md → sections déjà découpées
const cacheQuestions = {};   // chemin du .json → liste des questions
let lecture = null;          // { lien(i), n, total } quand une section est affichée
let pagePrecedente = '#/';   // pour revenir d'un glossaire à la section qu'on lisait
let sensArrivee = 0;         // 1 : la nouvelle section arrive de droite, -1 : de gauche, 0 : sans animation

// Couleur de chaque matière : « teinte » de matiere.json, sinon une teinte choisie d'après son id.
const TEINTES = [268, 160, 25, 300, 200, 60, 340, 120];
function teinteDe(matiere) {
  if (typeof matiere.teinte === 'number') return matiere.teinte;
  let h = 0;
  for (const c of matiere.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TEINTES[h % TEINTES.length];
}
function appliquerTeinte(matiere) {
  if (matiere) document.documentElement.style.setProperty('--teinte', teinteDe(matiere));
  else document.documentElement.style.removeProperty('--teinte');
}

retour.innerHTML = icone('chevron-left');
document.getElementById('bouton-reglages').innerHTML = icone('settings-2');

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

async function chargerQuestions(chapitre) {
  if (!chapitre.questions) return [];
  if (!cacheQuestions[chapitre.questions]) {
    const reponse = await fetch(RACINE_COURS + chapitre.questions);
    if (!reponse.ok) throw new Error(`${chapitre.questions} introuvable (${reponse.status})`);
    cacheQuestions[chapitre.questions] = (await reponse.json()).questions;
  }
  return cacheQuestions[chapitre.questions];
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
// Le nombre de sections de chaque document est gardé pour afficher la progression à l'accueil.
const positions = lire('positions', {});
const totaux = lire('totaux', {});
const cle = (doc, idMatiere, idChapitre) => `${doc}/${idMatiere}/${idChapitre}`;
const lienPosition = (doc, idMatiere, idChapitre) =>
  `#/${doc}/${idMatiere}/${idChapitre}/${positions[cle(doc, idMatiere, idChapitre)] ?? 0}`;

function memoriserPosition(doc, idMatiere, idChapitre, n, total) {
  positions[cle(doc, idMatiere, idChapitre)] = n;
  totaux[cle(doc, idMatiere, idChapitre)] = total;
  ecrire('positions', positions);
  ecrire('totaux', totaux);
  ecrire('derniere-lecture', { doc, matiere: idMatiere, chapitre: idChapitre });
}

// Avancement dans un document : { n, total, pourcent } (total inconnu tant qu'il n'a pas été ouvert).
function avancement(doc, idMatiere, idChapitre) {
  const n = positions[cle(doc, idMatiere, idChapitre)];
  const total = totaux[cle(doc, idMatiere, idChapitre)];
  if (n === undefined || !total) return null;
  return { n, total, pourcent: Math.round(((n + 1) / total) * 100) };
}

const jauge = pourcent => `<div class="jauge"><span style="width:${pourcent}%"></span></div>`;

function modeAccueil(actif) {
  document.body.classList.toggle('accueil', actif);
  progression.hidden = actif;
}

function afficherAccueil() {
  modeAccueil(true);
  appliquerTeinte(null);
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
      const a = avancement(derniere.doc, derniere.matiere, derniere.chapitre);
      reprise = `<a class="reprise" href="${lienPosition(derniere.doc, derniere.matiere, derniere.chapitre)}">
        <small>Reprendre · ${DOCUMENTS[derniere.doc]}</small>
        <strong>${echapper(chapitre.titre)}</strong>
        ${a ? `section ${a.n + 1} sur ${a.total}<div class="barre-reprise"><span style="width:${a.pourcent}%"></span></div>` : ''}
      </a>`;
    } catch {
      // chapitre ou document supprimé depuis : pas de reprise
    }
  }

  vue.innerHTML = reprise + index.matieres.map(m => `
    <section class="matiere">
      <h2>${echapper(m.nom)}${m.notations ? ` <a class="lien-notations" href="#/notations/${m.id}">Notations</a>` : ''}</h2>
      <ul class="liste">
        ${m.chapitres.map(c => {
          const doc = docParDefaut(c);
          const a = avancement(doc, m.id, c.id);
          return `<li class="carte">
            <a class="ouvrir" href="${lienPosition(doc, m.id, c.id)}">
              <span class="nom">${echapper(c.titre)}${c.fiche ? '<small class="etiquette">fiche</small>' : ''}</span>
              <span class="detail">${a ? `${DOCUMENTS[doc]} · section ${a.n + 1} sur ${a.total}` : 'Pas encore commencé'}</span>
              ${a ? jauge(a.pourcent) : ''}
            </a>
            ${c.questions ? `<a class="reviser" href="#/reviser/${m.id}/${c.id}" data-compte="${m.id}/${c.id}">Réviser</a>` : ''}
          </li>`;
        }).join('')}
      </ul>
    </section>`).join('');
  compterQuestionsDues();
}

// Nombre de questions à revoir sur chaque bouton « Réviser » (fichiers chargés après l'affichage).
async function compterQuestionsDues() {
  for (const bouton of vue.querySelectorAll('[data-compte]')) {
    try {
      const [idMatiere, idChapitre] = bouton.dataset.compte.split('/');
      const { chapitre } = trouverChapitre(idMatiere, idChapitre);
      const n = aReviser(await chargerQuestions(chapitre), idMatiere, idChapitre).length;
      bouton.innerHTML = n ? `Réviser <span class="pastille">${n}</span>` : 'Réviser ✓';
    } catch {
      // fichier de questions manquant : le bouton reste tel quel
    }
  }
}

async function afficherSection(doc, idMatiere, idChapitre, n) {
  const { matiere, chapitre } = trouverChapitre(idMatiere, idChapitre);
  if (!DOCUMENTS[doc] || !fichierDe(chapitre, doc)) doc = 'cours';
  const sections = await chargerSections(fichierDe(chapitre, doc));
  n = Math.min(Math.max(0, n), sections.length - 1);
  const lien = i => `#/${doc}/${idMatiere}/${idChapitre}/${i}`;
  lecture = { lien, n, total: sections.length };
  memoriserPosition(doc, idMatiere, idChapitre, n, sections.length);
  modeAccueil(false);
  progression.firstElementChild.style.width = `${((n + 1) / sections.length) * 100}%`;

  // Onglets Fiche / Cours complet, seulement si le chapitre a une fiche.
  const onglets = chapitre.fiche ? `
    <nav class="onglets">
      ${Object.entries(DOCUMENTS).map(([id, nom]) =>
        `<a href="${lienPosition(id, idMatiere, idChapitre)}" aria-current="${id === doc}">${nom}</a>`).join('')}
    </nav>` : '';

  appliquerTeinte(matiere);
  const notations = (matiere.notations ? `<a class="lien-notations" href="#/notations/${idMatiere}" aria-label="Notations">${icone('sigma')}</a>` : '')
    + (chapitre.questions ? `<a class="lien-notations" href="#/reviser/${idMatiere}/${idChapitre}" aria-label="Réviser">${icone('target')}</a>` : '');

  titre.textContent = chapitre.titre;
  retour.hidden = false;
  retour.href = '#/';
  vue.innerHTML = `
    ${onglets || notations ? `<div class="entete-lecture">${onglets}${notations}</div>` : ''}
    <article class="section${sensArrivee ? ` arrivee-${sensArrivee > 0 ? 'droite' : 'gauche'}` : ''}">${sections[n].html}</article>`;
  sensArrivee = 0;
  bas.hidden = false;
  bas.onclick = null;
  bas.innerHTML = `
    <a class="precedent" href="${lien(n - 1)}" aria-disabled="${n === 0}" aria-label="Section précédente">${icone('chevron-left')}</a>
    <span class="compteur">${n + 1} / ${sections.length}</span>
    <a class="suivant" href="${lien(n + 1)}" aria-disabled="${n === sections.length - 1}" aria-label="Section suivante">Suivant ${icone('chevron-right')}</a>`;
  window.scrollTo(0, 0);
}

async function afficherNotations(idMatiere) {
  const matiere = trouverMatiere(idMatiere);
  if (!matiere.notations) throw new Error('Pas de notations pour cette matière');
  const sections = await chargerSections(matiere.notations);
  appliquerTeinte(matiere);
  lecture = null;
  modeAccueil(false);
  progression.hidden = true;
  titre.textContent = `Notations · ${matiere.nom}`;
  retour.hidden = false;
  // Le retour ramène à la section qu'on lisait (ou à l'accueil).
  retour.href = pagePrecedente.startsWith('#/notations') ? '#/' : pagePrecedente;
  bas.hidden = true;
  vue.innerHTML = `<article class="section">${sections.map(s => s.html).join('')}</article>`;
  window.scrollTo(0, 0);
}

async function afficherRevision(idMatiere, idChapitre, quandMeme = false) {
  const { matiere, chapitre } = trouverChapitre(idMatiere, idChapitre);
  appliquerTeinte(matiere);
  const questions = await chargerQuestions(chapitre);
  lecture = null;
  modeAccueil(false);
  titre.textContent = `Réviser · ${chapitre.titre}`;
  retour.hidden = false;
  retour.href = pagePrecedente.startsWith('#/reviser') ? '#/' : pagePrecedente;
  bas.onclick = null;

  const choisies = (quandMeme ? enAvance : aReviser)(questions, idMatiere, idChapitre).slice(0, QUESTIONS_PAR_SEANCE);
  if (!choisies.length) {
    progression.hidden = true;
    const date = prochaineRevision(questions);
    const quand = date ? new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : null;
    vue.innerHTML = `<section class="bilan">
      <div class="score">✓</div>
      <p class="bilan-texte">${questions.length ? 'Rien à revoir pour l\'instant.' : 'Pas encore de questions pour ce chapitre.'}</p>
      ${quand ? `<p class="bilan-texte discret">Prochaine révision : ${quand}.</p>` : ''}
    </section>`;
    bas.hidden = !questions.length;
    bas.innerHTML = `<button class="action principal" data-action="quand-meme">Réviser quand même</button>`;
    bas.onclick = e => { if (e.target.closest('[data-action]')) afficherRevision(idMatiere, idChapitre, true); };
    return;
  }
  lancerSeance({ vue, bas, progression }, choisies.map(q => ({ q, matiere: idMatiere, chapitre: idChapitre })), {
    fin: () => { location.hash = retour.getAttribute('href'); },
  });
}

const peutAller = sens => !!lecture && lecture.n + sens >= 0 && lecture.n + sens < lecture.total;

function allerA(sens) {
  if (!peutAller(sens)) return;
  sensArrivee = sens;
  location.replace(lecture.lien(lecture.n + sens));
}

// Précédent / suivant remplacent l'entrée de l'historique : le bouton « retour »
// d'Android ramène à l'accueil au lieu de remonter section par section.
bas.addEventListener('click', e => {
  const lien = e.target.closest('a');
  if (!lien) return;
  e.preventDefault();
  if (lien.classList.contains('suivant')) allerA(1);
  if (lien.classList.contains('precedent')) allerA(-1);
});

activerBalayage(vue, { cible: () => (lecture ? vue.querySelector('.section') : null), peutAller, aller: allerA });

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
    else if (page === 'reviser') await afficherRevision(args[0], args[1]);
    else afficherAccueil();
    if (page !== 'notations' && page !== 'reviser') pagePrecedente = location.hash || '#/';
  } catch (erreur) {
    bas.hidden = true;
    vue.innerHTML = `<p class="erreur">Erreur : ${echapper(erreur.message)}</p>`;
  }
}

window.addEventListener('hashchange', router);
// Les scripts « defer » (KaTeX, marked) sont chargés avant l'évènement DOMContentLoaded.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', router);
else router();
