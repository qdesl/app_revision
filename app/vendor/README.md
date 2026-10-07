# Bibliothèques et polices embarquées

Copiées telles quelles, pour que l'app marche **sans réseau** (aucun CDN).

| Bibliothèque | Version | Licence | Fichiers gardés |
|---|---|---|---|
| [KaTeX](https://katex.org) | 0.19.0 | MIT | `katex.min.js`, `katex.min.css`, polices `.woff2` seulement (lues par Chrome Android) |
| [marked](https://marked.js.org) | 18.1.0 | MIT | `marked.umd.js` |
| [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans) | v12 (Google Fonts) | OFL | `jakarta/` : sous-ensemble latin, graisses 400–800 (police variable) — interface |
| [Literata](https://github.com/googlefonts/literata) | v40 (Google Fonts) | OFL | sous-ensemble latin, normal + italique, graisses 400–700 (police variable) |

Mise à jour de KaTeX ou marked : télécharger `https://registry.npmjs.org/<nom>/-/<nom>-<version>.tgz` et remplacer ces fichiers ; puis changer `VERSION` dans `app/sw.js`.

Icônes : [Lucide](https://lucide.dev) 1.52.0 (ISC), recopiées dans `app/js/icones.js` (seulement celles utilisées).
