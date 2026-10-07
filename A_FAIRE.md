# À faire (état au 2026-10-07)

Tout le code est prêt et poussé : l'app marche sur le téléphone, avec les cours encore en clair (seule la matière « Exemple », fictive, est en ligne). Il reste des réglages à faire **soi-même** sur GitHub et sur le PC fixe, **dans cet ordre**, pour que l'app ne soit jamais coupée.

> Ce fichier se lit aussi directement sur GitHub : https://github.com/qdesl/app_revision/blob/main/A_FAIRE.md
> Sur le PC fixe, le dossier n'est pas encore relié à GitHub : un simple `git pull` n'y marchera qu'après l'étape 6.

## 1. Vérifier que GitHub Pro est actif (Student Pack)

- https://github.com/settings/billing → la case « Subscriptions » doit afficher **GitHub Pro**, pas « GitHub Free ».
- Si ce n'est pas le cas : menu de gauche → **Education benefits** pour voir l'état de la demande (en attente, acceptée, refusée). La validation peut prendre de quelques heures à quelques jours. En cas de refus : la refaire avec un justificatif clair (carte étudiante ou certificat de scolarité avec une date visible).
- Les étapes 2 à 4 peuvent se faire **sans attendre** Pro. L'étape 5, **non**.

## 2. Créer le mot de passe des cours

- https://github.com/qdesl/app_revision/settings/secrets/actions → **New repository secret**.
- **Nom** : `MOT_DE_PASSE_COURS`
- **Valeur** : au moins 12 caractères. Le plus simple : 4 ou 5 mots au hasard (`girafe-tunnel-quatorze-citron`).
- **Le noter** : il sera demandé une fois sur le téléphone. GitHub ne permet pas de le relire ensuite.

## 3. Publier le site par GitHub Actions

- https://github.com/qdesl/app_revision/settings/pages → **Source** : **GitHub Actions**.

## 4. Première publication chiffrée

1. Onglet **Actions** du dépôt → **Publier le site (cours chiffrés)** → **Run workflow**.
2. Attendre la coche verte (1 à 2 minutes). En cas de croix rouge : ouvrir l'exécution, l'étape en échec dit pourquoi (souvent : secret absent ou mal nommé).
3. Sur le téléphone, ouvrir l'app **avec du réseau** :
   - toucher le bandeau « Nouvelle version de l'app · Actualiser » s'il apparaît ;
   - l'écran **« Cours protégés »** s'affiche → entrer le mot de passe ;
   - vérifier que la matière Exemple s'ouvre (fiche, graphique, révision).

Avant l'étape 2, GitHub peut envoyer un mail « workflow failed » à chaque push : c'est normal (pas de secret = rien n'est publié, l'ancien site reste en ligne).

## 5. Rendre le dépôt privé — SEULEMENT si Pro est actif et l'étape 4 a marché

- https://github.com/qdesl/app_revision/settings → tout en bas, **Danger Zone** → **Change visibility** → **Private**.
- Sans Pro, GitHub arrête le site d'un dépôt privé.
- Tant que le dépôt est public, son contenu reste lisible sur GitHub, même si le site est chiffré : **ne traiter aucun vrai cours avant cette étape**.

## 6. Relier le PC fixe

Dans un terminal WSL sur le PC fixe.

1. Créer une clé SSH pour ce PC et l'enregistrer sur GitHub :
   ```bash
   ssh-keygen -t ed25519 -C "PC fixe"     # Entrée à chaque question
   cat ~/.ssh/id_ed25519.pub              # copier la ligne affichée
   ```
   Puis https://github.com/settings/keys → **New SSH key** → coller → **Add SSH key**.
2. Relier le dossier existant `~/Workspace/app_revision` (il garde `.venv/`, `convertir_pdf.sh`, `essais_marker/`, les sources ; les anciens `CLAUDE.md` / `NOTES.md` sont sauvegardés avant d'être remplacés) :
   ```bash
   git clone git@github.com:qdesl/app_revision.git /tmp/app_revision_script
   bash /tmp/app_revision_script/outils/relier_pc_fixe.sh ~/Workspace/app_revision
   ```
3. Suivre les « Étapes suivantes » affichées par le script :
   ```bash
   cd ~/Workspace/app_revision
   git config user.name qdesl && git config user.email qdesl@users.noreply.github.com
   git add outils/convertir_pdf.sh && git commit -m "Ajoute le script Marker" && git push
   rm -rf /tmp/app_revision_script
   ```
4. Si le script a sauvegardé des fichiers (`sauvegarde_avant_git_<date>/`), comparer avec `diff -r sauvegarde_avant_git_* .`. Les nouvelles versions contiennent tout ce qui était dans l'archive `Gmail.zip` ; s'il manque quelque chose (par exemple des résultats d'essais de Marker dans `NOTES.md`), le dire à Claude.

Ensuite, `git pull` suffit pour récupérer les mises à jour.

## 7. Première vraie matière

1. Ouvrir Claude Code **dans `~/Workspace/app_revision`** sur le PC fixe : `CLAUDE.md`, `NOTES.md` et `suivi.md` donnent tout le contexte.
2. Déposer les documents en vrac dans `matieres/<matière>/sources/` (si possible `cours/`, `td/`, `partiels/`, `notes/`, `captures/`).
3. Dire : **« traite la matière <matière> »**. Claude convertit, organise, étalonne sur les partiels, puis écrit fiches et questions chapitre par chapitre, en publiant après chaque chapitre.
4. Premier point à vérifier avec Claude : que `outils/convertir_pdf.sh` écrit bien `$SORTIE/<nom>/<nom>.md` (ce que suppose `outils/convertir.py`, jamais testé avec le vrai Marker).
5. Une fois la matière en place : supprimer la matière `exemple` (`matieres/exemple/`, puis `outils/generer_index.py` et `outils/publier.sh`).

## Bon à savoir

- **Changer le mot de passe** : modifier le secret `MOT_DE_PASSE_COURS`, puis relancer l'étape 4 (Run workflow). Le téléphone affichera « Le mot de passe a changé ».
- Ne **jamais** modifier `matieres/chiffrement.json` : le téléphone redemanderait le mot de passe.
- Quota de Claude épuisé en plein travail : rien ne casse ; ce qui est terminé est publié automatiquement, la matière apparaît « en cours » dans l'app, et la session suivante reprend grâce à `suivi.md`.
- Mode d'emploi complet : [`README.md`](README.md). Toutes les décisions : [`NOTES.md`](NOTES.md).

Supprimer ce fichier une fois tout fait.
