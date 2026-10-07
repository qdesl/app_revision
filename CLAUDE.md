# App de révision mobile — contexte pour Claude

App **perso** pour réviser ses cours dans les transports, sur un téléphone **Android**.
**Lire `NOTES.md` avant toute proposition** : il contient tout ce qui a été discuté et décidé (besoin, choix, raisons, prochaines étapes).

## Décisions à respecter

- **PWA hors ligne** (doit marcher dans le train, sans réseau). L'option « app sur claude.ai » a été écartée pour ça.
- Les documents seront **de tout type et souvent pas structurés** : ne pas dépendre de la structure LaTeX des fiches existantes (définitions, boîtes…), ce n'est qu'un bonus.
- **Partiels et TD** servent à étalonner les questions : 3 niveaux (restitution → application → niveau partiel), avec un corrigé pas à pas.
- **Économie de tokens** : toujours **convertir en Markdown en local** avant de lire un document ; ne rouvrir le PDF d'origine que pour vérifier une page douteuse ; travailler **chapitre par chapitre**.
- L'app affiche directement le Markdown converti ; Claude n'intervient que pour les questions, les corrections de conversion et le manuscrit illisible par les outils.

## Dépôt

- GitHub (public) : https://github.com/qdesl/app_revision — la PWA y est hébergée (GitHub Pages).
- `matieres/*/sources/` est dans `.gitignore` : les documents bruts des profs ne sont **jamais** publiés.
- Développement **étape par étape** : un commit testé par étape, message « Étape N : … ».

## Outils

- **Marker** (PDF, scans → Markdown + LaTeX) est installé dans `.venv/` de ce dossier, **séparé** du Python anaconda de base (qui contient un PyTorch à ne pas toucher). Commande : voir `NOTES.md` §7.
- **pandoc 3.8** (système) pour `.tex`, `.docx`, `.ipynb`, `.md`.
- Pas de Node.js : app en HTML/CSS/JS sans build, KaTeX embarqué.

## Façon de travailler

- Répondre en **français**.
- Poser les questions **en texte libre**, pas avec un formulaire à choix multiples.
