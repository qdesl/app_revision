# App de révision

Application web **hors ligne** (PWA) pour réviser ses cours sur un téléphone Android, dans les transports.

> 🚧 En construction, étape par étape. Le contexte et les décisions sont dans [`NOTES.md`](NOTES.md), l'avancement du traitement des cours dans [`suivi.md`](suivi.md).

## Arborescence

```
app/                    ← la PWA (HTML/CSS/JS sans build)
matieres/<matière>/
├── sources/            ← documents bruts (PDF, photos, .tex…) — NON publiés (.gitignore)
├── convertis/          ← Markdown produit par pandoc / Marker
├── etalonnage.md       ← fiche d'une page tirée des partiels et TD
└── questions/          ← questions et corrigés, un fichier par chapitre
outils/                 ← scripts (conversion, index…)
```

⚠️ Le dépôt est **public** : les documents de `sources/` ne sont jamais envoyés sur GitHub.
