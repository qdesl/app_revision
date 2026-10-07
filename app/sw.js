// Service worker : garde l'app et tous les cours sur le téléphone, pour réviser sans réseau.
//
// - App (HTML, CSS, JS, KaTeX) et cours : servis depuis le cache tout de suite, puis
//   mis à jour en arrière-plan quand le réseau répond (« stale-while-revalidate »).
// - matieres/index.json (ou, site chiffré, acces.json et fichiers.json) : réseau d'abord (3 s max),
//   pour voir aussitôt les nouveaux chapitres.
// - Message « synchroniser » (envoyé par l'app au démarrage) : télécharge tous les fichiers
//   listés dans index.json, même les chapitres jamais ouverts, et les images de leurs cours.
//   Site chiffré (outils/chiffrer.py) : la liste vient de fichiers.json (noms et empreintes des
//   fichiers chiffrés) ; seuls les fichiers dont l'empreinte a changé sont retéléchargés.
//
// ⚠️ Changer VERSION à chaque ajout ou renommage d'un fichier de l'app (liste FICHIERS_APP).

const VERSION = 'v13';
const CACHE_APP = `app-${VERSION}`;
const CACHE_COURS = 'cours';
const DELAI_RESEAU = 3000; // ms

const POLICES_KATEX = [
  'AMS-Regular', 'Caligraphic-Bold', 'Caligraphic-Regular', 'Fraktur-Bold', 'Fraktur-Regular',
  'Main-Bold', 'Main-BoldItalic', 'Main-Italic', 'Main-Regular', 'Math-BoldItalic', 'Math-Italic',
  'SansSerif-Bold', 'SansSerif-Italic', 'SansSerif-Regular', 'Script-Regular', 'Size1-Regular',
  'Size2-Regular', 'Size3-Regular', 'Size4-Regular', 'Typewriter-Regular',
].map(nom => `vendor/katex/fonts/KaTeX_${nom}.woff2`);

const FICHIERS_APP = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/app.js', 'js/markdown.js', 'js/reglages.js', 'js/stockage.js', 'js/horsligne.js', 'js/geste.js', 'js/revision.js', 'js/ecran-revision.js', 'js/icones.js', 'js/feuille.js', 'js/donnees.js',
  'vendor/jakarta/PlusJakartaSans-latin.woff2',
  'vendor/literata/Literata-latin.woff2', 'vendor/literata/Literata-latin-italique.woff2',
  'vendor/katex/katex.min.js', 'vendor/katex/katex.min.css', 'vendor/marked/marked.umd.js',
  'icones/icone-192.png', 'icones/icone-512.png', 'icones/icone-maskable-512.png', 'icones/icone-180.png',
  ...POLICES_KATEX,
];

const RACINE_COURS = new URL('../matieres/', self.location).href;
const URL_INDEX = RACINE_COURS + 'index.json';
const URL_FICHIERS = RACINE_COURS + 'fichiers.json';
const RESEAU_D_ABORD = [URL_INDEX, URL_FICHIERS, RACINE_COURS + 'acces.json'];

self.addEventListener('install', evenement => {
  evenement.waitUntil(caches.open(CACHE_APP).then(cache => cache.addAll(FICHIERS_APP)));
  self.skipWaiting();
});

self.addEventListener('activate', evenement => {
  evenement.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      if (nom.startsWith('app-') && nom !== CACHE_APP) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', evenement => {
  const requete = evenement.request;
  if (requete.method !== 'GET' || !requete.url.startsWith(self.location.origin)) return;
  const url = requete.url.split('#')[0].split('?')[0];
  // ?frais=1 : l'index chiffré (son nom ne dit pas que c'est l'index), demandé par donnees.js.
  if (RESEAU_D_ABORD.includes(url) || requete.url.includes('frais=1')) {
    evenement.respondWith(reseauDAbord(url));
  } else {
    const cache = url.startsWith(RACINE_COURS) ? CACHE_COURS : CACHE_APP;
    evenement.respondWith(cacheDAbord(url, cache, evenement));
  }
});

async function cacheDAbord(url, nomCache, evenement) {
  const cache = await caches.open(nomCache);
  const enCache = await cache.match(url);
  const depuisReseau = fetch(url, { cache: 'no-cache' }).then(reponse => {
    if (reponse.ok) cache.put(url, reponse.clone());
    return reponse;
  });
  if (enCache) {
    evenement.waitUntil(depuisReseau.catch(() => {}));
    return enCache;
  }
  return depuisReseau;
}

async function reseauDAbord(url) {
  const cache = await caches.open(CACHE_COURS);
  try {
    const reponse = await Promise.race([
      fetch(url, { cache: 'no-cache' }),
      new Promise((_, rejeter) => setTimeout(() => rejeter(new Error('réseau trop lent')), DELAI_RESEAU)),
    ]);
    if (reponse.ok) await cache.put(url, reponse.clone());
    return reponse;
  } catch (erreur) {
    const enCache = await cache.match(url);
    if (enCache) return enCache;
    throw erreur;
  }
}

// --- Synchronisation complète des cours ---------------------------------------------

// Tous les chemins de fichiers cités dans index.json (cours, fiches, notations, questions…).
function cheminsDeLIndex(valeur, chemins = new Set()) {
  if (typeof valeur === 'string' && /\.(md|json|svg|png|jpe?g|webp|gif)$/i.test(valeur)) chemins.add(valeur);
  else if (valeur && typeof valeur === 'object') Object.values(valeur).forEach(v => cheminsDeLIndex(v, chemins));
  return chemins;
}

// Images citées dans un fichier Markdown : ![légende](chemin)
function imagesDuMarkdown(texte, urlFichier) {
  return [...texte.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/g)]
    .map(([, chemin]) => chemin)
    .filter(chemin => !/^[a-z]+:/i.test(chemin))
    .map(chemin => new URL(chemin, urlFichier).href);
}

// Site chiffré : tous les fichiers de fichiers.json ; ceux dont l'empreinte a changé sont
// retéléchargés, ceux qui ont disparu sont retirés du téléphone.
async function synchroniserChiffre(reponseListe) {
  const cache = await caches.open(CACHE_COURS);
  const liste = (await reponseListe.clone().json()).fichiers;
  const ancienne = await cache.match(URL_FICHIERS);
  const avant = ancienne ? (await ancienne.json()).fichiers : {};
  let modifies = 0, echecs = 0;
  for (const [nom, empreinte] of Object.entries(liste)) {
    const url = RACINE_COURS + nom;
    if (avant[nom] === empreinte && await cache.match(url)) continue;
    try {
      const reponse = await fetch(url, { cache: 'no-cache' });
      if (!reponse.ok) throw new Error(reponse.status);
      await cache.put(url, reponse);
      if (avant[nom]) modifies++;
    } catch {
      echecs++;
    }
  }
  for (const nom of Object.keys(avant)) {
    if (!(nom in liste)) await cache.delete(RACINE_COURS + nom);
  }
  // Un nouveau chapitre change l'index (lui aussi dans la liste) : compté dans « modifies ».
  if (!echecs) await cache.put(URL_FICHIERS, reponseListe);
  return { fichiers: Object.keys(liste).length, modifies, echecs };
}

async function synchroniser() {
  const reponseListe = await fetch(URL_FICHIERS, { cache: 'no-cache' }).catch(() => null);
  if (reponseListe?.ok) return synchroniserChiffre(reponseListe);

  const cache = await caches.open(CACHE_COURS);
  const reponseIndex = await fetch(URL_INDEX, { cache: 'no-cache' });
  if (!reponseIndex.ok) throw new Error(`index.json : ${reponseIndex.status}`);
  const texteIndex = await reponseIndex.clone().text();
  const ancienIndex = await cache.match(URL_INDEX);
  let modifies = ancienIndex && (await ancienIndex.text()) !== texteIndex ? 1 : 0;
  await cache.put(URL_INDEX, reponseIndex);

  const aTelecharger = [...cheminsDeLIndex(JSON.parse(texteIndex))].map(c => new URL(c, RACINE_COURS).href);
  const vus = new Set(aTelecharger);
  let fichiers = 1, echecs = 0;
  while (aTelecharger.length) {
    const url = aTelecharger.shift();
    try {
      const reponse = await fetch(url, { cache: 'no-cache' });
      if (!reponse.ok) throw new Error(reponse.status);
      fichiers++;
      if (/\.(md|json)$/i.test(url)) {
        const texte = await reponse.clone().text();
        const ancien = await cache.match(url);
        if (ancien && (await ancien.text()) !== texte) modifies++;
        for (const image of imagesDuMarkdown(texte, url)) {
          if (!vus.has(image)) { vus.add(image); aTelecharger.push(image); }
        }
      }
      await cache.put(url, reponse);
    } catch {
      echecs++;
    }
  }
  return { fichiers, modifies, echecs };
}

self.addEventListener('message', evenement => {
  if (evenement.data !== 'synchroniser') return;
  const port = evenement.ports[0];
  evenement.waitUntil(
    synchroniser()
      .then(resultat => port.postMessage({ ok: true, ...resultat }))
      .catch(erreur => port.postMessage({ ok: false, erreur: String(erreur.message || erreur) })),
  );
});
