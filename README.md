# App de révision

Application web **hors ligne** (PWA) pour réviser ses cours sur un téléphone Android, dans les transports : cours lisibles sur petit écran, fiches de révision, questions sur 3 niveaux avec répétition espacée.

**L'app : https://qdesl.github.io/app_revision/**

Le contexte et toutes les décisions sont dans [`NOTES.md`](NOTES.md), les consignes pour Claude dans [`CLAUDE.md`](CLAUDE.md), l'avancement du traitement des cours dans [`suivi.md`](suivi.md).

## Sur le téléphone

### Installer

1. Ouvrir **https://qdesl.github.io/app_revision/** dans **Chrome**.
2. Toucher **« 📲 Installer l'app sur ce téléphone »** sur l'accueil, ou menu **⋮ → Installer l'application**.
3. L'ouvrir une fois **avec du réseau** : elle télécharge tous les cours. Le panneau des réglages (icône en haut à droite) affiche « Hors ligne : N fichiers enregistrés ».

Ensuite, elle marche **sans réseau** (mode avion, métro, train).

### Mettre à jour

Rien à réinstaller : à chaque ouverture avec réseau, l'app vérifie s'il y a du nouveau.

- Nouveaux cours ou fiches → bandeau **« Cours mis à jour · Actualiser »**.
- Nouvelle version de l'app → bandeau **« Nouvelle version de l'app · Actualiser »**.

### Utiliser

- **Accueil** : questions à revoir aujourd'hui, série de jours de révision, reprise de la dernière lecture, une tuile par matière (couleur propre, anneau de progression).
- **Page d'une matière** : ses chapitres, avec progression de lecture, maîtrise sur 3 niveaux (●●●) et bouton **Réviser**.
- **Lecture** : une section par écran. Onglets **Fiche** / **Cours complet**, **Σ** pour le glossaire des notations, **◎** pour réviser le chapitre.
  - Changer de section : glisser à gauche / à droite, ou les boutons du bas.
  - **Sommaire** : toucher le compteur « 3 / 5 » en bas.
  - Les équations et tableaux trop larges défilent sur le côté.
- **Révision** : une carte par question. La toucher pour la **retourner** (corrigé étape par étape), puis la **glisser à droite** (réussi) ou **à gauche** (à revoir), ou utiliser les boutons.
  - Niveaux : 1 restitution → 2 application → 3 niveau partiel. Réussir débloque le niveau suivant, rater fait redescendre.
  - Répétition espacée : une question réussie revient après 1, 3, 7, 16, 35 puis 80 jours ; ratée, plus tard dans la séance puis le lendemain.
- **Réglages** : thème clair / sombre / automatique, taille du texte.

Les progrès sont gardés **sur le téléphone** (pas de compte, rien n'est envoyé).

## Sur le PC fixe

### Une seule fois : relier le dossier à GitHub

Le dossier `~/Workspace/app_revision` du PC fixe existe déjà (avec `.venv/`, `.venv-vllm/`, `outils/convertir_pdf.sh`…). Pour le relier au dépôt **sans rien perdre** :

```bash
curl -fsSL https://raw.githubusercontent.com/qdesl/app_revision/main/outils/relier_pc_fixe.sh -o /tmp/relier.sh
bash /tmp/relier.sh ~/Workspace/app_revision
```

Le script sauvegarde d'abord les fichiers locaux que GitHub remplace (`sauvegarde_avant_git_<date>/`), laisse intact tout le reste, puis affiche les dernières étapes : ajouter `convertir_pdf.sh` au dépôt, créer une clé SSH pour pouvoir pousser.

### Ajouter une matière

1. Déposer les documents **en vrac** dans `matieres/<matière>/sources/` : cours, TD, partiels, corrigés, notes, captures, photos. Si possible dans `cours/`, `td/`, `partiels/`, `notes/`, `captures/`, sinon Claude devine.
2. Dans une session **Claude Code** ouverte dans ce dossier : **« traite la matière <matière> »**. Claude suit la procédure de `CLAUDE.md` :
   - conversion en Markdown (`outils/convertir.py`) ;
   - organisation des sources et plan des chapitres ;
   - étalonnage sur les partiels et TD, puis glossaire des notations ;
   - pour chaque chapitre, une fiche et des questions.
   
   Il pose ses questions s'il y a un doute, et tient `suivi.md` à jour pour reprendre après une coupure.
3. `git push` : le téléphone reçoit tout à la prochaine ouverture avec réseau.

### Outils

| Commande | Rôle |
|---|---|
| `outils/convertir.py matieres/X` | Convertit `sources/` en Markdown : pandoc (`.tex`, `.docx`, `.ipynb`…) ou Marker (`.pdf`, scans, photos). Ne refait que ce qui a changé ; `--liste` pour voir sans rien faire. |
| `outils/publier.sh` | Vérifie l'index, puis commit et push de ce qui est terminé dans `matieres/` (jamais les `*.brouillon.*`). Lancé aussi automatiquement à la fin de chaque session Claude Code et si Claude s'arrête sur une erreur (quota épuisé). |
| `outils/generer_index.py` | Reconstruit `matieres/index.json` (ce que l'app affiche) et vérifie les questions ; `--verifier` sans rien écrire. |
| `outils/figure.py` | Transforme les graphiques `figures/*.py` (matplotlib) et `figures/*.tex` (TikZ) en SVG. |
| `outils/convertir_pdf.sh` | Lance Marker sur le GPU (PC fixe seulement). |
| `outils/relier_pc_fixe.sh` | Relie une première fois le dossier du PC fixe à GitHub. |
| `outils/icones.py` | Redessine les icônes de l'app. |

## Arborescence

```
app/                    ← la PWA (HTML/CSS/JS sans build, bibliothèques dans app/vendor/)
matieres/
├── index.json          ← liste des matières et chapitres (générée par outils/generer_index.py)
└── <matière>/
    ├── sources/        ← documents bruts — JAMAIS publiés (.gitignore)
    ├── matiere.json    ← nom affiché, couleur (teinte), ordre des chapitres
    ├── organisation.md ← inventaire des sources + plan des chapitres (fait par Claude)
    ├── etalonnage.md   ← une page tirée des partiels et TD
    ├── notations.md    ← glossaire unique des notations
    ├── convertis/
    │   ├── <chapitre>.md        ← un fichier = un chapitre de l'app
    │   └── <type>/<doc>/<doc>.md ← conversions brutes (cours, TD, partiels, notes…), pas des chapitres
    ├── fiches/         ← une fiche de révision par chapitre
    ├── questions/      ← questions et corrigés, un JSON par chapitre
    └── figures/        ← graphiques : source .py / .tex et SVG produit
outils/                 ← scripts
```

## Ce qui est public

Le dépôt et l'app sont **publics**. Les documents d'origine (`sources/`) ne sont **jamais** envoyés sur GitHub. En revanche, tout ce que l'app affiche l'est : les cours convertis, les fiches, les questions et les graphiques. Ils sont visibles par quiconque a le lien.

## Développement

- Tester en local : `python3 -m http.server` à la racine, puis ouvrir http://localhost:8000/app/.
- Après l'ajout, la suppression ou le renommage d'un fichier de `app/` : mettre à jour `FICHIERS_APP` et **changer `VERSION`** dans `app/sw.js`, sinon le téléphone garde l'ancienne version.
- Développement étape par étape : un commit testé par étape (voir l'historique Git).
