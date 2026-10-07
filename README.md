# App de révision

Application web **hors ligne** (PWA) pour réviser ses cours sur un téléphone Android, dans les transports.

> 🚧 En construction, étape par étape. Le contexte et les décisions sont dans [`NOTES.md`](NOTES.md), l'avancement du traitement des cours dans [`suivi.md`](suivi.md).

## Arborescence

```
app/                    ← la PWA (HTML/CSS/JS sans build)
matieres/<matière>/
├── sources/            ← documents bruts — NON publiés (.gitignore)
│   └── cours/ td/ partiels/ notes/ captures/   (facultatif, sinon en vrac)
├── organisation.md     ← inventaire des sources + plan des chapitres (fait par Claude)
├── notations.md        ← glossaire unique des notations de la matière
├── matiere.json        ← facultatif : nom affiché, ordre des chapitres
├── convertis/          ← Markdown produit par pandoc / Marker
│   ├── <chapitre>.md   ← un fichier = un chapitre de l'app
│   └── td/ partiels/ notes/ captures/   ← convertis aussi, mais pas des chapitres
├── etalonnage.md       ← fiche d'une page tirée des partiels et TD
├── fiches/             ← fiches de révision par chapitre (cours + TD + partiels + notes)
├── figures/            ← graphiques : source .py / .tex et SVG produit
└── questions/          ← questions et corrigés, un fichier JSON par chapitre
outils/                 ← scripts (conversion, figures, index…)
```

## Mettre à jour l'index

Après un ajout ou un renommage dans `matieres/` :

```bash
outils/generer_index.py              # reconstruit matieres/index.json et vérifie les questions
outils/generer_index.py --verifier   # contrôle seulement, sans rien écrire
```

⚠️ Le dépôt est **public** : les documents de `sources/` ne sont jamais envoyés sur GitHub.
