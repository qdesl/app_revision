// Point d'entrée de l'app : chargement de l'index des cours et navigation.
//
// Adresses (dans le #) :
//   #/                                       accueil : aujourd'hui, reprise, tuiles des matières
//   #/matiere/<matière>                      page d'une matière : ses chapitres
//   #/<doc>/<matière>/<chapitre>/<n>         section n de la fiche de révision (doc = fiche) ou du cours (doc = cours)
//   #/notations/<matière>                    glossaire des notations de la matière, sur une seule page
//   #/reviser/<matière>/<chapitre>           séance de révision du chapitre (questions)

import { decouper } from './markdown.js';
import { lire, ecrire } from './stockage.js';
import { activerBalayage } from './geste.js';
import { aReviser, enAvance, prochaineRevision, serieDeJours, reponsesDuJour, maitriseChapitre } from './revision.js';
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
let numeroNavigation = 0;    // incrémenté à chaque changement de page (un affichage lent ne doit pas écraser le suivant)
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

const NOMS_MAITRISE = ['À découvrir', 'Restitution', 'Application', 'Niveau partiel'];

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const progressionChapitre = (m, c) => avancement(docParDefaut(c), m.id, c.id)?.pourcent ?? 0;
const progressionMatiere = m => (m.chapitres.length
  ? Math.round(m.chapitres.reduce((t, c) => t + progressionChapitre(m, c), 0) / m.chapitres.length) : 0);

// Anneau de progression (SVG) avec le pourcentage au centre.
function anneau(pourcent) {
  const r = 16, longueur = 2 * Math.PI * r;
  return `<span class="anneau"><svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="${r}" class="anneau-fond"/>
      <circle cx="20" cy="20" r="${r}" class="anneau-plein" stroke-dasharray="${longueur}"
        stroke-dashoffset="${longueur * (1 - pourcent / 100)}"/>
    </svg><span>${pourcent}%</span></span>`;
}

// Questions à revoir d'une matière : { total, parChapitre: { id: n } }.
async function questionsDues(m) {
  const parChapitre = {};
  for (const c of m.chapitres) {
    try {
      parChapitre[c.id] = aReviser(await chargerQuestions(c), m.id, c.id).length;
    } catch {
      parChapitre[c.id] = 0; // fichier de questions manquant
    }
  }
  return { total: Object.values(parChapitre).reduce((a, b) => a + b, 0), parChapitre };
}

function salutation() {
  const heure = new Date().getHours();
  return heure < 5 ? 'Bonne nuit' : heure < 18 ? 'Bonjour' : 'Bonsoir';
}

function carteReprise() {
  const derniere = lire('derniere-lecture', null);
  if (!derniere?.doc) return '';
  try {
    const { matiere, chapitre } = trouverChapitre(derniere.matiere, derniere.chapitre);
    if (!fichierDe(chapitre, derniere.doc)) return '';
    const a = avancement(derniere.doc, derniere.matiere, derniere.chapitre);
    return `<a class="reprise teinte" href="${lienPosition(derniere.doc, derniere.matiere, derniere.chapitre)}" style="--teinte:${teinteDe(matiere)}">
      <small>Reprendre · ${echapper(matiere.nom)}</small>
      <strong>${echapper(chapitre.titre)}</strong>
      ${a ? `${DOCUMENTS[derniere.doc]} · section ${a.n + 1} sur ${a.total}
        <div class="barre-reprise"><span style="width:${a.pourcent}%"></span></div>` : ''}
    </a>`;
  } catch {
    return ''; // chapitre ou document supprimé depuis
  }
}

async function afficherAccueil(numero) {
  const dues = await Promise.all(index.matieres.map(questionsDues));
  if (numero !== numeroNavigation) return; // on a changé de page pendant le chargement
  modeAccueil(true);
  appliquerTeinte(null);
  titre.textContent = salutation();
  retour.hidden = true;
  retour.href = '#/';
  bas.hidden = true;
  lecture = null;
  if (!index.matieres.length) {
    vue.innerHTML = '<p class="vide">Aucun cours pour l\'instant.</p>';
    return;
  }

  const totalDues = dues.reduce((t, d) => t + d.total, 0);
  const serie = serieDeJours();
  const duJour = reponsesDuJour();
  vue.innerHTML = `
    <p class="date-du-jour">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <section class="aujourdhui">
      <small>Aujourd'hui</small>
      <div class="aujourdhui-principal">
        <span class="grand-nombre">${totalDues}</span>
        <span>${totalDues ? (totalDues > 1 ? 'questions à revoir' : 'question à revoir') : 'question à revoir : tout est à jour'}</span>
      </div>
      <div class="aujourdhui-stats">
        <span>${icone('flame')} ${serie ? `${pluriel(serie, 'jour')} de suite` : 'Commence ta série'}</span>
        <span>${icone('circle-check')} ${duJour ? `${pluriel(duJour, 'réponse')} aujourd'hui` : 'Pas encore de réponse'}</span>
      </div>
    </section>
    ${carteReprise()}
    <h2 class="titre-rubrique">Matières</h2>
    <div class="tuiles">
      ${index.matieres.map((m, i) => `
        <a class="tuile teinte" href="#/matiere/${m.id}" style="--teinte:${teinteDe(m)}">
          <span class="tuile-haut">${icone('book-open')}${dues[i].total ? `<span class="pastille">${dues[i].total}</span>` : ''}</span>
          <strong>${echapper(m.nom)}</strong>
          <span class="tuile-bas">
            <span class="detail">${pluriel(m.chapitres.length, 'chapitre')}</span>
            ${anneau(progressionMatiere(m))}
          </span>
        </a>`).join('')}
    </div>`;
}

async function afficherMatiere(idMatiere, numero) {
  const m = trouverMatiere(idMatiere);
  const { total, parChapitre } = await questionsDues(m);
  const maitrises = {};
  for (const c of m.chapitres) {
    maitrises[c.id] = c.questions ? maitriseChapitre(await chargerQuestions(c).catch(() => []), m.id, c.id) : null;
  }
  if (numero !== numeroNavigation) return;
  modeAccueil(false);
  progression.hidden = true;
  appliquerTeinte(m);
  titre.textContent = ''; // le nom est déjà en grand dans l'en-tête de la page
  retour.hidden = false;
  retour.href = '#/';
  bas.hidden = true;
  bas.onclick = null;
  lecture = null;

  vue.innerHTML = `
    <header class="entete-matiere">
      <h2>${echapper(m.nom)}</h2>
      <p>${pluriel(m.chapitres.length, 'chapitre')} · ${total ? `${total} à revoir` : 'rien à revoir'}</p>
      ${m.notations ? `<a class="bouton-clair" href="#/notations/${m.id}">${icone('sigma')} Notations</a>` : ''}
    </header>
    <ul class="liste">
      ${m.chapitres.map((c, i) => {
        const doc = docParDefaut(c);
        const a = avancement(doc, m.id, c.id);
        const niveau = maitrises[c.id];
        return `<li class="carte">
          <a class="ouvrir" href="${lienPosition(doc, m.id, c.id)}">
            <span class="nom"><span class="numero">${i + 1}</span><span class="titre-chapitre">${echapper(c.titre)}</span>${icone('chevron-right')}</span>
            <span class="detail">${a ? `${DOCUMENTS[doc]} · section ${a.n + 1} sur ${a.total}` : 'Pas encore commencé'}</span>
            ${jauge(a?.pourcent ?? 0)}
          </a>
          ${c.questions ? `<div class="pied-carte">
            <span class="maitrise" aria-label="Maîtrise : ${NOMS_MAITRISE[niveau]}">
              ${[1, 2, 3].map(k => `<i class="${k <= niveau ? 'plein' : ''}"></i>`).join('')}
              <small>${NOMS_MAITRISE[niveau]}</small>
            </span>
            <a class="reviser" href="#/reviser/${m.id}/${c.id}">${icone('target')} Réviser
              ${parChapitre[c.id] ? `<span class="pastille">${parChapitre[c.id]}</span>` : ''}</a>
          </div>` : ''}
        </li>`;
      }).join('')}
    </ul>`;
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
  retour.href = `#/matiere/${idMatiere}`;
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
    const numero = ++numeroNavigation;
    if (DOCUMENTS[page]) await afficherSection(page, args[0], args[1], Number(args[2]) || 0);
    else if (page === 'matiere') await afficherMatiere(args[0], numero);
    else if (page === 'notations') await afficherNotations(args[0]);
    else if (page === 'reviser') await afficherRevision(args[0], args[1]);
    else await afficherAccueil(numero);
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
