# App de révision mobile — contexte pour Claude

App **perso** pour réviser ses cours dans les transports, sur un téléphone **Android**.
**Lire `NOTES.md` avant toute proposition** : il contient tout ce qui a été discuté et décidé (besoin, choix, raisons, prochaines étapes).

## Décisions à respecter

- **PWA hors ligne** (doit marcher dans le train, sans réseau). L'option « app sur claude.ai » a été écartée pour ça.
- Les documents seront **de tout type et souvent pas structurés** : ne pas dépendre de la structure LaTeX des fiches existantes (définitions, boîtes…), ce n'est qu'un bonus.
- **Partiels, TD, notes et captures** servent à étalonner les questions et à enrichir les fiches (voir « Fiches de révision ») : 3 niveaux (restitution → application → niveau partiel), avec un corrigé pas à pas.
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

## Principe général : organiser à partir du désorganisé

Les documents arrivent **en vrac** : mal nommés, mélangés, incomplets, sans plan clair. C'est à Claude de **produire la structure**, pas à l'utilisateur de la fournir.

Pour chaque matière, `matieres/<matière>/organisation.md` (créé au premier traitement, tenu à jour) :

1. **Inventaire des sources** : un tableau, une ligne par fichier de `sources/` — type deviné (cours, TD, partiel, corrigé, notes, capture…), date ou année, chapitres couverts, fichier converti correspondant. Les sessions suivantes lisent cet inventaire au lieu de rouvrir les sources.
2. **Plan des chapitres** : déduit de **toutes** les sources (le cours, mais aussi l'ordre des TD et ce qui tombe en partiel), même si le cours n'en a pas. Chaque chapitre a un identifiant court (`gradient`, `dualite`…) réutilisé partout : `convertis/`, `fiches/`, `questions/`, `index.json`.
3. **Trous et doublons** : chapitre sans cours (seulement des TD), deux versions d'un même poly, pages manquantes… signalés à l'utilisateur, pas devinés en silence.

Un document qui couvre plusieurs chapitres est découpé par chapitre dans `convertis/`.

## Notations

Une seule notation par objet, dans toute la matière. **Ordre de priorité** :

1. les notations **du cours** ;
2. celles de **l'utilisateur** (notes perso, captures annotées) pour ce que le cours ne couvre pas ;
3. celles des **TD et partiels** ;
4. un choix de Claude, en dernier recours seulement — et alors cohérent avec le reste.

**Tout symbole utilisé est défini**, sans exception (fiches, questions, corrigés) :

- `matieres/<matière>/notations.md` : **glossaire unique** de la matière. Tableau `Symbole | Signification | Origine | Autres notations rencontrées` (origine : cours, tes notes, TD 2, Claude…). Le lire **avant** d'écrire, y ajouter tout nouveau symbole **avant** de l'utiliser.
- Chaque fiche commence par une section `## Notations` qui reprend les symboles du chapitre : la fiche se lit seule.
- Une source qui note autrement : on traduit dans la notation retenue, et on l'indique une fois (colonne « Autres notations » et/ou « noté $m$ dans le TD 2 »).
- Le glossaire est déclaré dans `matieres/index.json` (champ `"notations"` de la matière) : l'app l'affiche via le bouton « Notations ».

## Fiches de révision

Une fiche par chapitre, `matieres/<matière>/fiches/<chapitre>.md`, affichée par défaut dans l'app (onglet « Fiche », le cours complet reste à côté). Ce n'est **pas qu'un résumé** du cours :

- **Toutes les sources servent** : cours (le fond), `etalonnage.md` tiré des partiels et TD (ce qui tombe, le niveau, les pièges), notes perso et captures (ce que le prof a dit, ses insistances).
- **Extrapoler est permis** : une notion vue en TD, en partiel ou dans les notes mais absente du cours est **ajoutée**, dans un encadré « Complément (source) ».
- **Notations** : celles retenues dans `notations.md` (voir « Notations » ci-dessus) ; une notion venue d'ailleurs y est réécrite. Section `## Notations` en tête de chaque fiche.
- **Toujours citer la source** d'un encadré : (TD 3, ex. 2), (partiel 2024, ex. 1), (notes du 12/10).
- Encadrés reconnus par l'app (citation `>` qui commence par le mot-clé en gras) :

  | Début de l'encadré | Couleur | Pour |
  |---|---|---|
  | `> **À retenir :**`, `**Définition**`, `**Théorème**`, `**Formule**` | bleu | l'essentiel |
  | `> **Méthode (TD 3) :**`, `**Astuce**`, `**Réflexe**` | vert | comment faire |
  | `> **Piège :**`, `**Attention**`, `**Erreur**` | rouge | erreurs classiques |
  | `> **Tombé en partiel (2024, ex. 2) :**`, `**Annale**` | orange | ce qui tombe |
  | `> **Complément (TD 2, ex. 4) :**`, `**Hors cours**` | violet | notion absente du cours |

- Ajouter la fiche dans `matieres/index.json` (champ `"fiche"` du chapitre) et cocher la colonne « Fiche » de `suivi.md`.

## Graphiques

Claude peut créer des graphiques pour illustrer un cours (courbes, schémas, figures TikZ des `.tex` que pandoc ignore) :

1. Écrire la source dans `matieres/<matière>/figures/` :
   - `<nom>.py` : script **matplotlib**, sans `savefig` ni `show` (le style lisible sur téléphone est appliqué automatiquement) ;
   - `<nom>.tex` : dessin **TikZ / pgfplots**, seul (`\begin{tikzpicture}…`) ou document complet.
2. Lancer `outils/figure.py` → produit `<nom>.svg` à côté de la source (seules les figures modifiées sont refaites).
3. L'insérer dans le cours converti : `![Légende courte](../figures/<nom>.svg)` (la légende s'affiche sous la figure).

Garder la source : c'est elle qu'on corrige, jamais le SVG. Pas de couleur de fond (SVG transparent, pour le mode sombre).

## Façon de travailler

- Répondre en **français**.
- Poser les questions **en texte libre**, pas avec un formulaire à choix multiples.
