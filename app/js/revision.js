// Répétition espacée et niveaux de difficulté (aucun affichage ici).
//
// Chaque question a une « boîte » : réussie → boîte suivante, reposée de plus en plus tard
// (1, 3, 7, 16, 35, 80 jours) ; ratée → retour à la boîte 0, reposée le lendemain
// (et plus tard dans la même séance, voir ecran-revision.js).
//
// Chaque section d'un chapitre a un niveau débloqué (1 restitution, 2 application,
// 3 niveau partiel) : on ne pose que les questions de niveau ≤ niveau débloqué.
// Réussir une question du niveau le plus haut débloque le suivant ; rater fait redescendre.
// Une reprise dans la même séance (juste après avoir vu le corrigé) ne prouve pas grand-chose :
// elle est notée dans l'historique mais ne débloque rien, et la question revient le lendemain.

import { lire, ecrire } from './stockage.js';

const JOUR = 24 * 3600 * 1000;
const INTERVALLES = [1, 1, 3, 7, 16, 35, 80]; // jours, selon la boîte (0 = ratée)
const BOITE_MAX = INTERVALLES.length - 1;
const HISTORIQUE_MAX = 5000;

const etats = lire('questions', {});     // id → { boite, prochaine, vues, reussites, echecs, dernier }
const maitrise = lire('maitrise', {});   // « matière/chapitre/section » → niveau débloqué (1 à 3)
const historique = lire('historique', []); // [{ id, matiere, chapitre, niveau, reussi, date }]

const cleMaitrise = (matiere, chapitre, q) => `${matiere}/${chapitre}/${q.section ?? ''}`;

export const etatQuestion = id => etats[id] ?? null;
export const niveauDebloque = (matiere, chapitre, q) => maitrise[cleMaitrise(matiere, chapitre, q)] ?? 1;

// Questions à poser maintenant pour un chapitre : d'abord celles dont la date est passée
// (les plus en retard d'abord), puis les nouvelles (niveau le plus bas d'abord).
export function aReviser(questions, matiere, chapitre, maintenant = Date.now()) {
  const accessibles = questions.filter(q => q.niveau <= niveauDebloque(matiere, chapitre, q));
  const dues = accessibles
    .filter(q => etats[q.id] && etats[q.id].prochaine <= maintenant)
    .sort((a, b) => etats[a.id].prochaine - etats[b.id].prochaine);
  const nouvelles = accessibles
    .filter(q => !etats[q.id])
    .sort((a, b) => a.niveau - b.niveau);
  return [...dues, ...nouvelles];
}

// Date de la prochaine question à revoir (quand il n'y a rien à faire tout de suite).
export function prochaineRevision(questions) {
  const dates = questions.map(q => etats[q.id]?.prochaine).filter(Boolean);
  return dates.length ? Math.min(...dates) : null;
}

// Pour « réviser quand même » : les questions déjà vues, les plus proches de leur date d'abord.
export function enAvance(questions, matiere, chapitre) {
  return questions
    .filter(q => etats[q.id] && q.niveau <= niveauDebloque(matiere, chapitre, q))
    .sort((a, b) => etats[a.id].prochaine - etats[b.id].prochaine);
}

export function enregistrer(q, matiere, chapitre, reussi, { reprise = false, maintenant = Date.now() } = {}) {
  const e = etats[q.id] ?? { boite: 0, vues: 0, reussites: 0, echecs: 0 };
  e.vues++;
  e.dernier = maintenant;
  const cle = cleMaitrise(matiere, chapitre, q);
  const niveau = maitrise[cle] ?? 1;
  if (reprise && reussi) {
    // rien ne change : boîte 0, reposée demain
  } else if (reussi) {
    e.reussites++;
    e.boite = Math.min(e.boite + 1, BOITE_MAX);
    if (q.niveau >= niveau) maitrise[cle] = Math.min(3, q.niveau + 1);
  } else {
    e.echecs++;
    e.boite = 0;
    maitrise[cle] = Math.min(niveau, Math.max(1, q.niveau - 1));
  }
  if (!(reprise && reussi)) e.prochaine = maintenant + INTERVALLES[e.boite] * JOUR;
  etats[q.id] = e;

  historique.push({ id: q.id, matiere, chapitre, niveau: q.niveau, reussi, reprise, date: maintenant });
  if (historique.length > HISTORIQUE_MAX) historique.splice(0, historique.length - HISTORIQUE_MAX);

  ecrire('questions', etats);
  ecrire('maitrise', maitrise);
  ecrire('historique', historique);
}
