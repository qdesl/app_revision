# App de révision mobile — contexte pour Claude

App **perso** pour réviser ses cours dans les transports, sur un téléphone **Android**.
**Lire `NOTES.md` avant toute proposition** : il contient tout ce qui a été discuté et décidé (besoin, choix, raisons, prochaines étapes).

## L'utilisateur : niveau M2 d'école d'ingénieur

Toutes les fiches, questions et corrigés visent ce niveau :

- Les bases de licence (algèbre linéaire, analyse, probabilités et statistiques de base, programmation) sont **acquises** : ne pas les réexpliquer, sauf si le cours ou un partiel les mobilise de façon non évidente.
- Rigueur mathématique, vocabulaire exact, aller à l'essentiel : hypothèses précises des théorèmes, conditions d'application, ordres de grandeur, liens entre notions.
- Niveau 3 des questions = **partiels de M2** (d'après `etalonnage.md`), pas des exercices d'application de licence.
- Une extrapolation (notion ajoutée hors du cours) se fait **à ce niveau** : celui d'un cours de M2 ou d'un ouvrage de référence de la discipline.

## Procédure : « traite la matière X »

Dans l'ordre, en mettant `suivi.md` à jour à chaque étape (pour reprendre après une coupure) :

1. **Convertir** : `outils/convertir.py matieres/X` (pandoc ou Marker selon le type ; ne refait que ce qui a changé). Les fichiers illisibles par les outils sont listés : les lire soi-même, page par page, une seule fois, et écrire le Markdown dans `convertis/`.
2. **Organiser** : inventaire, plan des chapitres, trous et doublons → `organisation.md` (voir « Organiser à partir du désorganisé »). Poser les questions ambiguës à l'utilisateur.
3. **Étalonner** : lire partiels et TD **une fois** → `etalonnage.md` (une page : types d'exercices, niveau, notations, pièges, barème, ce qui tombe souvent).
4. **Notations** → `notations.md`.
5. **Découper** le cours converti en chapitres : `convertis/<id>.md` ; `matiere.json` (nom, teinte, ordre).
6. **Chapitre par chapitre** (une conversation courte par chapitre) : fiche → `fiches/<id>.md`, questions → `questions/<id>.json`, graphiques si utiles.
7. **Publier** : `outils/generer_index.py`, puis commit et `git push` (l'app se met à jour sur le téléphone).

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

- **Marker** (PDF, scans → Markdown + LaTeX) est installé dans `.venv/` de ce dossier (PC fixe), **séparé** du Python anaconda de base (qui contient un PyTorch à ne pas toucher). Lancé par `outils/convertir_pdf.sh` (voir `NOTES.md` §6), lui-même appelé par `outils/convertir.py`.
- **pandoc 3.8** (système) pour `.tex`, `.docx`, `.odt`, `.ipynb`, `.md`, `.html`, `.epub`.
- **`outils/convertir.py`** convertit tout `sources/` d'un coup : chaque document → `convertis/<type>/<nom>/<nom>.md` (type = sous-dossier de `sources/`, sinon `vrac`), pandoc ou Marker selon l'extension, seulement ce qui a changé. Il signale les figures TikZ ignorées par pandoc (→ `outils/figure.py`) et les conversions Marker presque vides (manuscrit → à lire soi-même). Ces fichiers sont la matière première : ils ne deviennent des chapitres qu'une fois découpés en `convertis/<id>.md`.
- Pas de Node.js : app en HTML/CSS/JS sans build, KaTeX embarqué.

## Hors ligne (service worker)

- `app/sw.js` garde l'app et **tous** les fichiers cités dans `matieres/index.json` (plus les images de leurs Markdown) sur le téléphone ; synchronisation à chaque ouverture avec réseau.
- ⚠️ Ajout, suppression ou renommage d'un fichier de l'app (`app/js/…`, `app/vendor/…`) → mettre à jour `FICHIERS_APP` et **changer `VERSION`** dans `app/sw.js`. Les cours, eux, n'ont besoin que d'être dans `index.json`.
- `.nojekyll` à la racine : sans lui, GitHub Pages ignore les fichiers commençant par `_` (images de Marker).

## Principe général : organiser à partir du désorganisé

Les documents arrivent **en vrac** : mal nommés, mélangés, incomplets, sans plan clair. C'est à Claude de **produire la structure**, pas à l'utilisateur de la fournir.

Pour chaque matière, `matieres/<matière>/organisation.md` (créé au premier traitement, tenu à jour) :

1. **Inventaire des sources** : un tableau, une ligne par fichier de `sources/` — type deviné (cours, TD, partiel, corrigé, notes, capture…), date ou année, chapitres couverts, fichier converti correspondant. Les sessions suivantes lisent cet inventaire au lieu de rouvrir les sources.
2. **Plan des chapitres** : déduit de **toutes** les sources (le cours, mais aussi l'ordre des TD et ce qui tombe en partiel), même si le cours n'en a pas. Chaque chapitre a un identifiant court (`gradient`, `dualite`…) réutilisé partout : `convertis/`, `fiches/`, `questions/`, `index.json`.
3. **Trous et doublons** : chapitre sans cours (seulement des TD), deux versions d'un même poly, pages manquantes… signalés à l'utilisateur, pas devinés en silence.

**Rangement des fichiers convertis** (c'est ce qui décide de ce que l'app affiche) :

- `convertis/<id>.md`, **directement** dans `convertis/` : **un chapitre** par fichier, avec son id (`convertis/gradient.md`). Un document qui couvre plusieurs chapitres est découpé.
- `convertis/td/`, `convertis/partiels/`, `convertis/notes/`, `convertis/captures/`… : tout ce qui **n'est pas** un chapitre (TD, partiels, notes, captures transcrites). Ces fichiers servent à Claude (fiches, étalonnage, questions) mais **ne deviennent jamais des chapitres** de l'app.
- `matiere.json` (facultatif) : `{"nom": "Optimisation", "teinte": 160, "ordre": ["convexite", "gradient"], "exclure": []}` — nom affiché, couleur de la matière dans l'app (`teinte` : angle 0–360 sur le cercle des couleurs ; ex. 25 rouge, 60 ambre, 160 vert, 200 bleu-vert, 268 indigo, 300 violet, 340 rose ; sinon attribuée automatiquement), ordre des chapitres (sinon alphabétique), chapitres à masquer. Donner des teintes **bien distinctes** aux matières.

## Index de l'app : `outils/generer_index.py`

`matieres/index.json` n'est **plus écrit à la main** : après tout ajout ou renommage (chapitre, fiche, questions, notations), lancer `outils/generer_index.py`. Il reconstruit l'index depuis les dossiers (titre d'un chapitre = premier `# Titre` du cours converti), vérifie les fichiers de questions et **n'écrit rien en cas d'erreur**. `--verifier` contrôle sans écrire (code 1 si erreur ou index pas à jour).

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
- Le glossaire est ajouté à l'index par `outils/generer_index.py` dès que `notations.md` existe : l'app l'affiche via le bouton « Notations ».

## Fiches de révision

Une fiche par chapitre, `matieres/<matière>/fiches/<chapitre>.md`, affichée par défaut dans l'app (onglet « Fiche », le cours complet reste à côté). Ce n'est **pas qu'un résumé** du cours :

- **Toutes les sources servent** : cours (le fond), `etalonnage.md` tiré des partiels et TD (ce qui tombe, le niveau, les pièges), notes perso et captures (ce que le prof a dit, ses insistances).
- **Extrapoler est permis** : une notion vue en TD, en partiel ou dans les notes mais absente du cours, ou une notion de niveau M2 qui éclaire le chapitre, est **ajoutée**, dans un encadré « Complément ».
- **Toute extrapolation est sourcée**, mais la source **n'a pas besoin d'apparaître dans l'app** : elle va dans un commentaire HTML, invisible à l'affichage, juste après le passage concerné :

  ```markdown
  > **Complément :** la forte convexité … <!-- source : TD 2, ex. 4 -->
  > **Complément :** le théorème de … <!-- source : Boyd & Vandenberghe, Convex Optimization (2004), §9.3.1, p. 459 -->
  ```

  - Source interne : document de `sources/` (TD 2 ex. 4, partiel 2025 ex. 1, notes du 12/10, capture IMG_2041).
  - Source externe : ouvrage de référence, cours universitaire publié ou article, **avec l'endroit précis** (chapitre, section, page). **Ne jamais inventer une référence** : si l'ajout vient de la connaissance générale de Claude sans référence vérifiable, écrire `<!-- source : connaissance générale de Claude, à vérifier -->` et le signaler à l'utilisateur.
- **Notations** : celles retenues dans `notations.md` (voir « Notations » ci-dessus) ; une notion venue d'ailleurs y est réécrite. Section `## Notations` en tête de chaque fiche.
- Dans le texte visible, ne garder une origine que si elle **sert à réviser** (« Tombé en partiel (2024, ex. 2) » dit ce qui tombe) ; sinon, la source reste dans le commentaire.
- Encadrés reconnus par l'app (citation `>` qui commence par le mot-clé en gras) :

  | Début de l'encadré | Couleur | Pour |
  |---|---|---|
  | `> **À retenir :**`, `**Définition**`, `**Théorème**`, `**Formule**` | bleu | l'essentiel |
  | `> **Méthode (TD 3) :**`, `**Astuce**`, `**Réflexe**` | vert | comment faire |
  | `> **Piège :**`, `**Attention**`, `**Erreur**` | rouge | erreurs classiques |
  | `> **Tombé en partiel (2024, ex. 2) :**`, `**Annale**` | orange | ce qui tombe |
  | `> **Complément :**`, `**Hors cours**` | violet | notion absente du cours (source en commentaire) |

- Lancer `outils/generer_index.py` (la fiche est ajoutée à l'index toute seule) et cocher la colonne « Fiche » de `suivi.md`.

## Questions

Un fichier par chapitre : `matieres/<matière>/questions/<chapitre>.json`.

```json
{
  "chapitre": "gradient",
  "questions": [
    {
      "id": "gradient-001",
      "niveau": 2,
      "section": "Descente de gradient",
      "enonce": "Markdown + LaTeX ($…$, $$…$$)",
      "corrige": ["Étape 1 en Markdown", "Étape 2", "Conclusion"],
      "source": "partiel 2025, ex. 2",
      "reference": "facultatif, non affiché : d'où vient une question extrapolée",
      "tags": ["calcul"]
    }
  ]
}
```

- **Obligatoires** : `id`, `niveau`, `enonce`, `corrige`. **Facultatifs** : `section` (titre de la section du cours ou de la fiche concernée), `source` (**affichée** dans l'app : à réserver aux annales et TD, utile pour réviser), `reference` (**non affichée** : source d'une question extrapolée, mêmes règles que pour les fiches), `tags`. `"chapitre"` = id du chapitre (nom du fichier).
- **Niveaux** : `1` restitution (définition, énoncé, formule) · `2` application directe · `3` niveau partiel (même type et même difficulté que les annales, d'après `etalonnage.md`).
- **Corrigé pas à pas** : une liste d'étapes courtes, chacune lisible seule (l'app les dévoile une par une).
- **Ids stables** : `<chapitre>-001`, `-002`… uniques dans tout le dépôt, **jamais renumérotés ni réutilisés** (ils servent à suivre les résultats). Une question supprimée laisse un trou ; une nouvelle prend le numéro suivant.
- **Notations** : celles de `notations.md`, comme pour les fiches ; tout symbole nouveau y est ajouté avant d'être utilisé.
- Citer la `source` quand la question vient d'un TD ou d'un partiel.
- Puis `outils/generer_index.py` : il vérifie le fichier (champs, niveaux, ids uniques) et l'ajoute à l'index ; cocher la colonne « Questions » de `suivi.md`.

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
