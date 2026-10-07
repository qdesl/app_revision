# App de révision — notes de conception

Tout ce qui a été dit et décidé avec Claude, pour pouvoir reprendre le projet plus tard.
Commencé le 2026-10-06. Le 2026-10-07, la PWA a été codée (étapes 1 à 20, voir l'historique Git), mise en ligne sur https://qdesl.github.io/app_revision/ et installée sur le téléphone. Mode d'emploi : `README.md`.

---

## 1. Le besoin

- Une app **perso** (pas destinée à être publiée) pour **stocker et réviser ses cours dans les transports** (métro, RER, train).
- Le téléphone est un **Android**.
- Le problème de départ : lire un PDF A4 sur un téléphone, c'est pénible (zoom, défilement dans tous les sens). Il faut que le texte **se recompose à la largeur de l'écran**.
- Elle doit être **assez évoluée** mais **simple à utiliser**.
- Il faut pouvoir y mettre des **partiels et des TD**, pour que Claude **adapte les questions et la difficulté** au niveau des examens.

## 2. Les documents à intégrer

- **De tout, et souvent pas structuré** : PDF de profs, diapos, scans, photos de notes manuscrites, .tex de styles variés, Word, notebooks.
- ⚠️ Ne **pas** s'appuyer sur la structure des fiches LaTeX actuelles (environnements `definition`/`theorem`, boîtes `recognizebox`/`trapbox` de `Methode_opti.tex`…). Ce n'est au mieux qu'un bonus : les futurs documents n'auront pas forcément cette forme.
- Les documents seront rangés par matière (voir §5, organisation des dossiers).

## 3. Décisions prises

| Sujet | Décision | Pourquoi |
|---|---|---|
| Type d'app | **PWA hors ligne** : une web app installée depuis Chrome, avec son icône, en plein écran | Il faut qu'elle marche dans le train et les tunnels, sans réseau |
| Option écartée | App publiée sur claude.ai (artifact) | Pas d'hébergement, ajout de photos depuis le téléphone, résultats lus directement par Claude, correction en direct… mais **ne marche pas sans réseau** |
| Qui produit le contenu | **Claude fait tout** : fiches, questions, corrigés | Au plus simple. Un modèle local (type Mistral) avait été envisagé puis **écarté** |
| Limite de tokens | **Méthode du §5** : conversion locale, un chapitre à la fois, fichier de suivi, étalonnage compact | Pour que le traitement de tous les cours aille au bout |
| Hébergement | Gratuit, en HTTPS (obligatoire pour le hors-ligne). Ex. : dépôt GitHub privé + Cloudflare Pages, ou GitHub Pages (pack étudiant) | **Compte pas encore créé** : à faire au moment du déploiement |
| Ajout de documents | Depuis le PC (pas depuis le téléphone, pas de serveur) | Conséquence du choix PWA |
| Retour des résultats vers Claude | Bouton « Exporter » dans l'app (V1) | Une synchro automatique pourra venir plus tard |
| Conversion des documents | **En local, en Markdown, avant que Claude ne les lise** | Économie de tokens (§5) |
| Graphiques (2026-10-07) | Claude écrit une source matplotlib (`.py`) ou TikZ (`.tex`) → SVG via `outils/figure.py` | Courbes et schémas nets sur téléphone, mode sombre, source modifiable |
| Fiches de révision (2026-10-07) | Une fiche par chapitre, ouverte par défaut, construite à partir de **toutes** les sources (cours, TD, partiels, notes, captures) ; peut **ajouter** des notions absentes du cours, dans les **notations du cours** | Réviser ce qui tombe vraiment, pas seulement le cours |
| Organisation (2026-10-07) | Claude **organise à partir du désorganisé** : `organisation.md` par matière (inventaire des sources, plan des chapitres, trous et doublons) | Les documents arrivent en vrac ; l'inventaire évite de relire les sources |
| Notations (2026-10-07) | Priorité : cours > notes de l'utilisateur > TD/partiels > choix de Claude ; **tout symbole défini** dans `notations.md` (glossaire unique) et en tête de chaque fiche | Cohérence entre cours, TD, partiels et fiches |
| Niveau et sources (2026-10-07) | Fiches et questions au niveau **M2 d'école d'ingénieur** ; toute extrapolation **sourcée** dans un commentaire invisible (`<!-- source : … -->`, champ `reference` des questions), jamais de référence inventée | Situer la difficulté ; pouvoir vérifier chaque ajout sans encombrer l'app |
| Confidentialité (2026-10-07) | Dépôt **privé** (Student Pack) ; site GitHub Pages publié par GitHub Actions avec les cours **chiffrés** (AES-256-GCM, PBKDF2 600 000 itérations, noms de fichiers chiffrés) ; mot de passe demandé une fois sur le téléphone | Rendre le dépôt privé ne cache pas le site : seul le chiffrement protège les cours ; garder le hors-ligne |
| Dépôt (2026-10-07, remplacé : voir Confidentialité) | GitHub **public** `qdesl/app_revision` ; `sources/` jamais publié | GitHub Pages gratuit ; documents des profs gardés en local |

## 4. Fonctionnement prévu

```
cours en vrac + partiels/TD ──▶ conversion locale (gratuite) ──▶ Markdown ──▶ app sur Android
                                                                   │   ▲
                                                Claude : questions,│   │ tes résultats
                                                corrections        ▼   │ (bouton Exporter)
                                                              banque de questions
```

1. **Déposer** les documents en vrac dans `matieres/<matière>/sources/`.
2. **Convertir en local** vers du Markdown (formules en LaTeX) :
   - `.tex`, `.docx`, `.ipynb`, `.md` → **pandoc** (déjà installé, pas d'IA) ;
   - PDF et scans → **Marker** (utilise la carte graphique RTX 4070) ;
   - écriture manuscrite que Marker lit mal → **lue directement par Claude**, une seule fois, puis sauvegardée en Markdown.
3. **L'app affiche directement ce Markdown**, découpé en sections, formules rendues avec KaTeX. La plupart des fiches ne coûtent donc **aucun token**.
4. **Claude intervient là où il faut réfléchir** :
   - rédiger les **questions** en s'étalonnant sur les partiels et les TD ;
   - corriger les passages mal convertis ;
   - transcrire le manuscrit.
5. **Boucle d'adaptation** : l'app exporte les résultats → à la session suivante, Claude prépare de nouvelles questions sur les points faibles.

### L'app (V1)

- **Lecture** : une section par écran, texte qui s'adapte à la largeur, formules bien rendues, équations trop larges qui défilent sur le côté au lieu de rétrécir, mode sombre, taille du texte réglable, reprise à la dernière section lue.
- **Révision** : questions sur **3 niveaux**, chacune avec un **corrigé pas à pas** :
  1. restitution (« redonne la définition de X ») ;
  2. application directe ;
  3. niveau partiel (même type et même difficulté que les annales).
  - Réussi → l'app monte d'un niveau ; raté → elle redescend et **repose la question plus tard** (répétition espacée).
  - Gros boutons en bas de l'écran, pour s'en servir d'une main, debout.
- **Session courte** : « j'ai 10 minutes » → les questions les plus urgentes, puis c'est fini.
- **D'où viennent les cartes / questions** (rien ne dépend de la structure des documents) :
  - générées automatiquement à partir des **titres** de sections (« Que sais-tu sur X ? ») ;
  - créées **en lisant**, par appui long sur un paragraphe ou une formule ;
  - **préparées par Claude** quand un cours est ajouté ;
  - bonus : définitions et théorèmes détectés automatiquement quand le document en contient.

### Idées pour plus tard (V2)

- **Formules à trous** : une macro `\trou{...}` dans les `.tex`, invisible dans le PDF, qui crée une carte « complète la formule ».
- Bouton **« pas compris »** sur une carte → liste des passages à retravailler sur PC.
- **Statistiques par chapitre** pour voir ses points faibles avant l'examen.
- **Synchro automatique** des résultats (petite fonction sur l'hébergeur au lieu du bouton Exporter).
- **Figures TikZ** des `.tex` : pandoc les ignore → les compiler à part en SVG avec `dvisvgm` (déjà installé).

## 5. Limiter les tokens de Claude, pour aller au bout

Claude fait tout. Pour que ça tienne dans le quota jusqu'au dernier cours, on applique ces règles :

1. **Convertir avant de lire.** Claude ne lit jamais un PDF entier, seulement le Markdown produit par pandoc ou Marker.
   - Mesure sur `Cours_Apprentissage_Stats_P1` (39 pages) : environ **67 000 caractères en Markdown ≈ 20 000 tokens**, contre de l'ordre de **100 000 tokens** en lisant le PDF, où chaque page arrive en texte + image (estimation). **Environ 5 fois moins.**
   - Le PDF d'origine n'est rouvert que pour vérifier une page douteuse, une page à la fois.
2. **Un chapitre à la fois.** On lit un chapitre, on produit ses questions, on enregistre, on passe au suivant. Jamais un cours entier d'un coup.
3. **Un fichier de suivi, `suivi.md`**, mis à jour à la fin de chaque chapitre. Si le quota s'épuise en route, la session suivante reprend au premier chapitre non terminé, sans rien relire.
4. **Une fiche d'étalonnage par matière, `etalonnage.md`.** Les partiels et TD sont lus **une seule fois**, puis résumés en une page : types d'exercices, niveau, notations, pièges, barème. Pour chaque chapitre, Claude relit cette fiche, pas les partiels.
5. **Le manuscrit et les scans mal lus par Marker** sont lus page par page, une seule fois, transcrits en Markdown, et plus jamais relus.
6. **Tout va dans des fichiers**, rien n'est recopié dans la conversation : Claude répond en quelques lignes et écrit les questions directement dans `questions/`.
7. **Des conversations courtes.** Repartir d'une conversation neuve (`/clear`) entre deux chapitres ou deux matières : dans une longue conversation, tout l'historique est renvoyé à chaque échange, ce qui coûte de plus en plus cher. `CLAUDE.md` et `suivi.md` suffisent pour reprendre.
8. **Le niveau d'effort.** La conception s'est faite en effort « max », le réglage le plus gourmand. Pour la production de routine (les questions d'un chapitre), un effort plus bas suffit et consomme beaucoup moins (`/effort`).

### Organisation des dossiers

```
app_revision/
├── matieres/<matière>/
│   ├── sources/        ← documents bruts déposés en vrac (PDF, photos, .tex…)
│   ├── convertis/      ← Markdown produit par pandoc / Marker
│   ├── etalonnage.md   ← fiche d'une page tirée des partiels et TD
│   └── questions/      ← questions et corrigés, un fichier par chapitre
├── suivi.md            ← où on en est, chapitre par chapitre
├── outils/             ← scripts (conversion…)
└── essais_marker/      ← résultats des premiers tests de Marker
```

## 6. Outils de conversion

| Outil | Pour quoi | Statut |
|---|---|---|
| [Marker](https://github.com/datalab-to/marker) 2.0 | PDF, scans → Markdown + formules LaTeX ; utilise le GPU | **Installé** dans `.venv/`, testé (§7) |
| vLLM 0.31.0 | Fait tourner le modèle de lecture de Marker 2 | **Installé** dans `.venv-vllm/` |
| pandoc 3.8 | `.tex`, `.docx`, `.ipynb`, `.md` | Déjà installé sur le système |
| MarkItDown (Microsoft) | ❌ **À éviter** : il réduit les PDF à du texte brut et perd les formules | — |

### Comment Marker 2 fonctionne ici (important)

- Marker 2.0 (avec surya-ocr 0.22) lit la mise en page, le texte et les tableaux avec **un seul modèle de vision**, `datalab-to/surya-ocr-2` (0,7 Md de paramètres, architecture Qwen3.5, licence OpenRAIL, pas besoin de compte Hugging Face).
- Ce modèle doit tourner dans un **serveur** compatible OpenAI. Sur une carte NVIDIA, Marker le lance par défaut **dans Docker** (`vllm/vllm-openai:v0.20.1`). **Docker n'est pas installé dans ce WSL** → premier essai en échec (`docker run failed`).
- Solution retenue, sans rien installer au niveau du système : **vLLM installé par pip dans `.venv-vllm/`**, lancé à la main avec les réglages de la commande Docker de surya (adaptés à 8 Go). Marker s'y connecte via la variable `SURYA_INFERENCE_URL`.
- ⚠️ **Versions** : vLLM 0.20.1 (celle de l'image Docker) ne marche pas installé par pip. Le modèle exige transformers ≥ 5 (tokenizer `TokenizersBackend`), mais pip installe transformers 4.57 parce que xgrammar 0.2.5 l'impose. Forcer transformers 5 casse ensuite l'accord xgrammar / apache-tvm-ffi. **vLLM 0.31.0** règle tout : transformers 5.17, xgrammar 0.2.7, torch 2.13, `pip check` sans erreur.
- Tout ça est automatisé par **`outils/convertir_pdf.sh`** : démarre le serveur, convertit, arrête le serveur.

```bash
cd ~/Workspace/app_revision
outils/convertir_pdf.sh ../Cours_optimisation.pdf          # → convertis/Cours_optimisation/Cours_optimisation.md
SORTIE=autre_dossier outils/convertir_pdf.sh a.pdf b.pdf   # plusieurs fichiers, autre dossier de sortie
```

- Place disque : `.venv/` ≈ 6 Go, `.venv-vllm/` ≈ 8 Go ; les modèles sont dans `~/.cache/huggingface` et `~/.cache/datalab`.

## 7. Essais de Marker

_(à compléter avec les résultats des tests)_

## 8. Ce qu'on avait constaté sur les fiches LaTeX existantes

- pandoc lit sans erreur `Methode_opti`, `Cours_Apprentissage_Stats_P1`, `Fiche_stats_appliquees`, `fiche_kalman`, `correction_td`, `fiche_app_stat_p2` (code de sortie 0, aucun avertissement).
- Il garde le titre des définitions et théorèmes (`\begin{definition}[Perte Hinge]` → « Définition 1 (Perte Hinge) ») et transforme les boîtes perso en blocs reconnaissables (`recognizebox`, `trapbox`, `note`, `tcolorbox`).
- Il en sort aussi bien les sections des fiches sans aucune boîte (`fiche_sic` : 19 sections, `fiche_sondage` : 8).
- Il **ignore les figures TikZ** (les 4 de `Fiche_stats_appliquees` disparaissent).

## 9. Environnement de travail

- WSL2 sous Windows (32 Go de RAM, dont ~15 Go visibles par WSL) ; GPU **NVIDIA RTX 4070 Laptop (8 Go)**, CUDA fonctionne depuis WSL.
- Python de base : anaconda 3.11, avec **PyTorch 2.14.1+cu130** → **ne pas y toucher** (d'où les environnements séparés `.venv/` et `.venv-vllm/`).
- Installés : pandoc 3.8, TeX Live 2023 (pdflatex, lualatex, latexmk), dvisvgm, poppler (`pdftotext`, `pdftocairo`).
- **Pas de Node.js ni de Docker.** L'app sera en HTML/CSS/JS sans étape de build, avec KaTeX embarqué.

## 10. Prochaines étapes

Fait le 2026-10-07 : PWA (lecture, fiches, notations, sommaire, révision en cartes, hors ligne), hébergement GitHub Pages, installation sur le téléphone, scripts `convertir.py`, `generer_index.py`, `figure.py`, `relier_pc_fixe.sh`.

1. Sur le PC fixe : lancer `outils/relier_pc_fixe.sh` (README, « Sur le PC fixe »), ajouter `outils/convertir_pdf.sh` au dépôt, créer une clé SSH. Vérifier que `convertir_pdf.sh` écrit bien dans `$SORTIE/<nom>/<nom>.md` (ce que suppose `convertir.py`, non testé avec le vrai Marker).
2. Choisir une **première matière**, déposer cours + partiels + TD + notes dans `matieres/<matière>/sources/`, puis « traite la matière X » (procédure dans `CLAUDE.md`).
3. Supprimer la matière `exemple` une fois une vraie matière en place.
4. Plus tard (écarté pour l'instant) : session « j'ai 10 minutes », cartes créées par appui long, bouton Exporter (résultats → Claude), statistiques, mode noir pur.

## 11. Préférences pour travailler ensemble

- Échanges en **français**.
- Poser les questions **en texte libre**, pas avec un formulaire à choix multiples (refusé une fois).
- Aller **au plus simple**.
