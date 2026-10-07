#!/bin/bash
# Relie un dossier app_revision déjà présent (PC fixe : .venv/, outils/convertir_pdf.sh…)
# au dépôt GitHub, SANS RIEN PERDRE :
#   - les fichiers locaux que la version GitHub remplace sont d'abord copiés dans
#     sauvegarde_avant_git_<date>/ ;
#   - tout ce que GitHub ne connaît pas (.venv/, convertir_pdf.sh, essais_marker/, sources…)
#     reste en place, intact.
#
# Usage (le dossier n'a pas encore ce script : on le télécharge) :
#   curl -fsSL https://raw.githubusercontent.com/qdesl/app_revision/main/outils/relier_pc_fixe.sh -o /tmp/relier.sh
#   bash /tmp/relier.sh ~/Workspace/app_revision
set -euo pipefail

DOSSIER=${1:-.}
DEPOT=${DEPOT:-https://github.com/qdesl/app_revision.git}
BRANCHE=main

cd "$DOSSIER"
DOSSIER=$(pwd)
echo "📁 Dossier : $DOSSIER"

if [ -e .git ]; then
  echo "❌ Ce dossier est déjà un dépôt Git : rien à faire (git pull pour le mettre à jour)."
  exit 1
fi

# 1. Dépôt Git local, relié à GitHub, et récupération de la version en ligne.
git init -q -b "$BRANCHE"
git remote add origin "$DEPOT"
echo "⬇️  Récupération de $DEPOT…"
git fetch -q origin "$BRANCHE"

# 2. Sauvegarde des fichiers locaux qui diffèrent de la version GitHub.
SAUVEGARDE="sauvegarde_avant_git_$(date +%Y-%m-%d_%H%M%S)"
sauvegardes=0
while IFS= read -r chemin; do
  if [ -f "$chemin" ] && ! git show "origin/$BRANCHE:$chemin" | cmp -s - "$chemin"; then
    mkdir -p "$SAUVEGARDE/$(dirname "$chemin")"
    cp -p "$chemin" "$SAUVEGARDE/$chemin"
    echo "   💾 sauvegardé : $chemin"
    sauvegardes=$((sauvegardes + 1))
  fi
done < <(git ls-tree -r --name-only "origin/$BRANCHE")

# 3. La branche locale suit GitHub ; les fichiers suivis prennent la version GitHub.
#    Les fichiers inconnus de GitHub ne sont pas touchés.
git reset -q "origin/$BRANCHE"
git branch -q --set-upstream-to="origin/$BRANCHE"
git checkout -q -- .
echo "${SAUVEGARDE}/" >> .git/info/exclude  # la sauvegarde ne doit pas partir sur GitHub

echo
echo "✅ Dossier relié à GitHub (branche $BRANCHE)."
if [ "$sauvegardes" -gt 0 ]; then
  echo "   $sauvegardes fichier(s) local(aux) remplacé(s), copie(s) dans $SAUVEGARDE/ :"
  echo "   comparer avec « diff -r $SAUVEGARDE . » et récupérer ce qui manquerait."
fi
echo
echo "Fichiers présents ici mais pas sur GitHub (hors fichiers ignorés) :"
git status --short | sed 's/^/   /' || true
echo
echo "Étapes suivantes :"
echo "  1. Ajouter le script Marker au dépôt :  git add outils/convertir_pdf.sh && git commit -m 'Ajoute le script Marker'"
echo "  2. Pour pouvoir pousser (git push), une clé SSH de ce PC sur GitHub :"
echo "       ssh-keygen -t ed25519 -C \"PC fixe\"   puis coller ~/.ssh/id_ed25519.pub dans"
echo "       https://github.com/settings/keys, et :  git remote set-url origin git@github.com:qdesl/app_revision.git"
echo "  3. Nom de l'auteur des commits :  git config user.name qdesl && git config user.email qdesl@users.noreply.github.com"
