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
├── convertis/          ← Markdown produit par pandoc / Marker
├── etalonnage.md       ← fiche d'une page tirée des partiels et TD
├── fiches/             ← fiches de révision par chapitre (cours + TD + partiels + notes)
├── figures/            ← graphiques : source .py / .tex et SVG produit
└── questions/          ← questions et corrigés, un fichier par chapitre
outils/                 ← scripts (conversion, index…)
```

⚠️ Le dépôt est **public** : les documents de `sources/` ne sont jamais envoyés sur GitHub.
