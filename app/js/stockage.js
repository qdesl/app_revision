// Petites données gardées sur le téléphone (réglages, position de lecture…).
// localStorage peut être indisponible (navigation privée…) : l'app marche quand même.

const PREFIXE = 'revision.';

export function lire(cle, defaut) {
  try {
    const valeur = localStorage.getItem(PREFIXE + cle);
    return valeur === null ? defaut : JSON.parse(valeur);
  } catch {
    return defaut;
  }
}

export function ecrire(cle, valeur) {
  try {
    localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
  } catch {
    // tant pis : la valeur ne survivra pas à la fermeture de l'app
  }
}
