#!/bin/bash
# Publie sur GitHub ce qui est FINI dans matieres/ (et suivi.md), jamais les brouillons :
#   1. vérifie l'index (outils/generer_index.py) — s'il est invalide, rien n'est publié ;
#   2. commit des fichiers de matieres/ (sources/ et *.brouillon.* sont ignorés par Git) ;
#   3. push.
#
# Usage :
#   outils/publier.sh                 à la main, ou par Claude à la fin de chaque chapitre
#   outils/publier.sh --automatique   lancé par Claude Code à la fin d'une session ou quand
#                                     Claude s'arrête sur une erreur (quota épuisé…) :
#                                     discret, ne bloque jamais (code de sortie 0)
set -uo pipefail
cd "$(dirname "$0")/.."

automatique=false
[ "${1:-}" = "--automatique" ] && automatique=true
dire() { echo "$@" >&2; }
sortir() { if $automatique; then exit 0; else exit "$1"; fi; }

[ -d .git ] || { dire "❌ $(pwd) n'est pas un dépôt Git."; sortir 1; }

# Un seul lancement à la fois (fin de session et arrêt sur erreur peuvent tomber ensemble).
exec 9>.git/publier.verrou
flock -n 9 || exit 0

if ! python3 outils/generer_index.py >/dev/null 2>&1; then
  dire "❌ Index invalide : rien n'est publié. Détail : outils/generer_index.py --verifier"
  sortir 1
fi

git add -- matieres suivi.md
if git diff --cached --quiet; then
  $automatique || dire "Rien de nouveau à publier."
  exit 0
fi

# Message : les chapitres dont la fiche ou les questions ont changé.
chapitres=$(git diff --cached --name-only -- 'matieres/*/fiches/*.md' 'matieres/*/questions/*.json' \
  | sed -E 's#^matieres/([^/]+)/[^/]+/([^/.]+)\..*#\1/\2#' | sort -u | paste -sd ',' - | sed 's/,/, /g')
titre="Publication"
$automatique && titre="Publication automatique"
git commit -q -m "$titre : ${chapitres:-mise à jour des cours}" \
  -m "Fichiers terminés de matieres/ (les brouillons ne sont jamais publiés)."

if git push -q 2>/dev/null || { git pull -q --rebase && git push -q; }; then
  dire "✅ Publié : ${chapitres:-mise à jour des cours}. Le téléphone le recevra à sa prochaine ouverture avec réseau."
else
  dire "⚠️ Enregistré localement (commit), mais l'envoi sur GitHub a échoué (réseau ?). Relancer outils/publier.sh plus tard."
  sortir 1
fi
