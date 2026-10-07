// Accès aux fichiers des cours (index, cours, fiches, questions, images).
//
// Deux cas, décidés par la présence de matieres/acces.json :
//   - absent : fichiers en clair (dépôt servi en local pour tester) ;
//   - présent : site publié par outils/chiffrer.py, cours chiffrés. La clé est tirée du mot de
//     passe (PBKDF2), demandé une seule fois puis gardée sur le téléphone : l'app reste
//     utilisable hors ligne. Voir outils/chiffrer.py pour le format.

import { lire, ecrire } from './stockage.js';

const RACINE = '../matieres/';
const encodeur = new TextEncoder();

let acces = undefined;   // undefined : pas encore regardé ; null : en clair ; objet : chiffré
let cles = null;         // { aes, hmac } (CryptoKey)
const urlsImages = {};   // chemin → URL (blob: pour une image déchiffrée)
let motDePasseChange = false; // la clé gardée ne correspond plus au site publié

export class MotDePasseRequis extends Error {}

// Message à afficher sur l'écran du mot de passe (vide au premier lancement).
export const messageVerrou = () => (motDePasseChange ? 'Le mot de passe a changé : entre le nouveau.' : '');

const enBase64 = octets => btoa(String.fromCharCode(...new Uint8Array(octets)));
const depuisBase64 = texte => Uint8Array.from(atob(texte), c => c.charCodeAt(0));

async function importerCles(brut) {
  return {
    aes: await crypto.subtle.importKey('raw', brut.slice(0, 32), 'AES-GCM', false, ['decrypt']),
    hmac: await crypto.subtle.importKey('raw', brut.slice(32, 64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
  };
}

// À appeler au démarrage : 'clair', 'pret' (clé connue) ou 'mot-de-passe' (à demander).
export async function initialiser() {
  if (acces === undefined) {
    const reponse = await fetch(RACINE + 'acces.json', { cache: 'no-cache' }).catch(() => null);
    acces = reponse?.ok ? await reponse.json() : null;
  }
  if (!acces) return 'clair';
  if (!cles) {
    const brut = lire('cle-cours', null);
    if (brut) cles = await importerCles(depuisBase64(brut));
  }
  return cles ? 'pret' : 'mot-de-passe';
}

// Tire la clé du mot de passe et la vérifie en déchiffrant l'index ; la garde si elle est bonne.
export async function deverrouiller(motDePasse) {
  const base = await crypto.subtle.importKey('raw', encodeur.encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
  const brut = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: depuisBase64(acces.sel), iterations: acces.iterations }, base, 512);
  cles = await importerCles(brut);
  try {
    await lireOctets('index.json');
  } catch (erreur) {
    cles = null;
    if (erreur instanceof TypeError) throw erreur; // pas de réseau : rien à voir avec le mot de passe
    throw new Error('Mot de passe incorrect.');
  }
  ecrire('cle-cours', enBase64(brut));
  motDePasseChange = false;
}

// Oublie la clé (mot de passe changé côté publication, ou à la demande).
export function oublierCle() {
  cles = null;
  ecrire('cle-cours', null);
}

async function nomChiffre(chemin) {
  const signature = await crypto.subtle.sign('HMAC', cles.hmac, encodeur.encode(chemin));
  return 'f/' + [...new Uint8Array(signature)].map(o => o.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function lireOctets(chemin) {
  if (!acces) {
    const reponse = await fetch(RACINE + chemin);
    if (!reponse.ok) throw new Error(`${chemin} introuvable (${reponse.status})`);
    return reponse.arrayBuffer();
  }
  if (!cles) throw new MotDePasseRequis();
  // L'index est demandé « frais » (réseau d'abord, voir sw.js) : un mot de passe changé ou une
  // nouvelle publication se voient tout de suite, pas à l'ouverture suivante.
  const frais = chemin === 'index.json' ? '?frais=1' : '';
  const reponse = await fetch(RACINE + await nomChiffre(chemin) + frais);
  if (!reponse.ok) {
    if (reponse.status === 404) {
      // Index introuvable avec une clé gardée : le mot de passe a changé depuis.
      if (chemin === 'index.json') {
        oublierCle();
        motDePasseChange = true;
        throw new MotDePasseRequis();
      }
      // Autre fichier introuvable : vérifier l'index (lève MotDePasseRequis si c'est la clé).
      await lireOctets('index.json');
    }
    throw new Error(`${chemin} introuvable (${reponse.status})`);
  }
  const brut = new Uint8Array(await reponse.arrayBuffer());
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: brut.slice(0, 12), additionalData: encodeur.encode(chemin) }, cles.aes, brut.slice(12));
}

export const lireTexte = async chemin => new TextDecoder().decode(await lireOctets(chemin));
export const lireJSON = async chemin => JSON.parse(await lireTexte(chemin));

const TYPES = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

// Résout « a/b/../c » en « a/c ».
function normaliser(chemin) {
  const parties = [];
  for (const partie of chemin.split('/')) {
    if (partie === '..') parties.pop();
    else if (partie && partie !== '.') parties.push(partie);
  }
  return parties.join('/');
}

async function urlImage(chemin) {
  if (!acces) return RACINE + chemin;
  if (!urlsImages[chemin]) {
    const type = TYPES[chemin.split('.').pop().toLowerCase()] ?? 'application/octet-stream';
    urlsImages[chemin] = URL.createObjectURL(new Blob([await lireOctets(chemin)], { type }));
  }
  return urlsImages[chemin];
}

// Charge les images d'un élément affiché : <img data-chemin="…"> (posé par markdown.js).
export function chargerImages(element) {
  for (const image of element.querySelectorAll('img[data-chemin]')) {
    const chemin = normaliser(image.dataset.chemin);
    if (chemin.endsWith('.svg')) image.classList.add('svg');
    urlImage(chemin)
      .then(url => { image.src = url; })
      .catch(() => image.replaceWith(Object.assign(document.createElement('em'), { textContent: `[image introuvable : ${chemin}]` })));
    image.removeAttribute('data-chemin');
  }
}
