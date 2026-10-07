// Point d'entrée de l'app : chargement de l'index des cours et navigation.
//
// Adresses (dans le #) :
//   #/                                 accueil, liste des matières et chapitres
//   #/lire/<matière>/<chapitre>/<n>    section n d'un chapitre

import { decouper } from './markdown.js';

const RACINE_COURS = '../matieres/';

const vue = document.getElementById('vue');
const titre = document.getElementById('titre');
const retour = document.getElementById('retour');

let index = null;            // contenu de matieres/index.json
const cacheSections = {};    // chemin du .md → sections déjà découpées

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

function trouverChapitre(idMatiere, idChapitre) {
  const matiere = index.matieres.find(m => m.id === idMatiere);
  const chapitre = matiere?.chapitres.find(c => c.id === idChapitre);
  if (!chapitre) throw new Error('Chapitre introuvable');
  return { matiere, chapitre };
}

function afficherAccueil() {
  titre.textContent = 'Révisions';
  retour.hidden = true;
  if (!index.matieres.length) {
    vue.innerHTML = '<p class="vide">Aucun cours pour l\'instant.</p>';
    return;
  }
  vue.innerHTML = index.matieres.map(m => `
    <section class="matiere">
      <h2>${echapper(m.nom)}</h2>
      <ul class="liste">
        ${m.chapitres.map(c => `<li><a href="#/lire/${m.id}/${c.id}/0">${echapper(c.titre)}</a></li>`).join('')}
      </ul>
    </section>`).join('');
}

async function afficherSection(idMatiere, idChapitre, n) {
  const { chapitre } = trouverChapitre(idMatiere, idChapitre);
  const sections = await chargerSections(chapitre.fichier);
  n = Math.min(Math.max(0, n), sections.length - 1);
  const lien = i => `#/lire/${idMatiere}/${idChapitre}/${i}`;

  titre.textContent = chapitre.titre;
  retour.hidden = false;
  vue.innerHTML = `
    <p class="position">Section ${n + 1} / ${sections.length}</p>
    <article class="section">${sections[n].html}</article>
    <nav class="navigation">
      <a href="${lien(n - 1)}" aria-disabled="${n === 0}">‹ Précédent</a>
      <a href="${lien(n + 1)}" aria-disabled="${n === sections.length - 1}">Suivant ›</a>
    </nav>`;
  window.scrollTo(0, 0);
}

async function router() {
  try {
    await chargerIndex();
    const [page, ...args] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    if (page === 'lire') await afficherSection(args[0], args[1], Number(args[2]) || 0);
    else afficherAccueil();
  } catch (erreur) {
    vue.innerHTML = `<p class="erreur">Erreur : ${echapper(erreur.message)}</p>`;
  }
}

window.addEventListener('hashchange', router);
// Les scripts « defer » (KaTeX, marked) sont chargés avant l'évènement DOMContentLoaded.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', router);
else router();
