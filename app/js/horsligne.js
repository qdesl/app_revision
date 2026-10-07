// Mode hors ligne : enregistre le service worker et télécharge tous les cours au démarrage.
// L'état s'affiche dans le panneau des réglages ; un bandeau propose d'actualiser
// quand un cours déjà enregistré a changé.

import { lire, ecrire } from './stockage.js';

const etat = document.getElementById('etat-horsligne');

function afficherEtat(texte) {
  etat.textContent = texte;
}

function dernierEtat() {
  const derniere = lire('synchro', null);
  if (!derniere) return 'Hors ligne : pas encore téléchargé.';
  const quand = new Date(derniere.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  return `Hors ligne : ${derniere.fichiers} fichiers enregistrés (${quand}).`;
}

function proposerActualisation(texte = 'Cours mis à jour · Actualiser') {
  if (document.querySelector('.bandeau')) return;
  const bandeau = document.createElement('button');
  bandeau.className = 'bandeau';
  bandeau.textContent = texte;
  bandeau.addEventListener('click', () => location.reload());
  document.body.append(bandeau);
}

function demanderSynchro(travailleur) {
  return new Promise(resoudre => {
    const canal = new MessageChannel();
    canal.port1.onmessage = e => resoudre(e.data);
    travailleur.postMessage('synchroniser', [canal.port2]);
  });
}

async function synchroniser() {
  const enregistrement = await navigator.serviceWorker.ready;
  if (!navigator.onLine || !enregistrement.active) return;
  afficherEtat('Hors ligne : téléchargement des cours…');
  const resultat = await demanderSynchro(enregistrement.active);
  if (!resultat.ok) {
    afficherEtat(`${dernierEtat()} Échec de la mise à jour : ${resultat.erreur}`);
    return;
  }
  ecrire('synchro', { date: Date.now(), fichiers: resultat.fichiers });
  afficherEtat(dernierEtat() + (resultat.echecs ? ` ${resultat.echecs} fichier(s) introuvable(s).` : ''));
  if (resultat.modifies) proposerActualisation();
}

// Bouton « Installer » : Chrome prévient (beforeinstallprompt) quand l'app est installable.
const boutonInstaller = document.getElementById('installer');
let demandeInstallation = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  demandeInstallation = e;
  boutonInstaller.hidden = false;
});
boutonInstaller.addEventListener('click', async () => {
  if (!demandeInstallation) return;
  demandeInstallation.prompt();
  await demandeInstallation.userChoice;
  demandeInstallation = null;
  boutonInstaller.hidden = true;
});
window.addEventListener('appinstalled', () => { boutonInstaller.hidden = true; });

if ('serviceWorker' in navigator) {
  afficherEtat(dernierEtat());
  // Nouvelle version de l'app (signal posé par le script en tête de index.html) :
  // on propose de recharger pour utiliser les nouveaux fichiers. Rien au premier lancement.
  const annoncerVersion = () => proposerActualisation('Nouvelle version de l\'app · Actualiser');
  if (window.nouvelleVersion) annoncerVersion();
  window.addEventListener('nouvelle-version', annoncerVersion);
  navigator.serviceWorker.register('sw.js')
    .then(enregistrement => {
      // Vérifie tout de suite s'il existe une nouvelle version de l'app (sinon le navigateur
      // peut attendre plusieurs lancements).
      if (navigator.onLine) enregistrement.update().catch(() => {});
      return synchroniser();
    })
    .catch(erreur => afficherEtat(`Hors ligne indisponible : ${erreur.message}`));
} else {
  afficherEtat('Hors ligne indisponible sur ce navigateur.');
}
