#!/usr/bin/env python3
"""Régénère matieres/index.json à partir des dossiers, et vérifie les fichiers de questions.

Ce qui est lu, pour chaque dossier matieres/<matière>/ :
  convertis/<id>.md        un chapitre par fichier, directement dans convertis/ (obligatoire)
  convertis/<sous-dossier>/  TD, partiels, notes convertis… : ce ne sont PAS des chapitres, ignorés
  fiches/<id>.md           fiche de révision du chapitre (facultatif)
  questions/<id>.json      questions du chapitre (facultatif, vérifiées)
  notations.md             glossaire de la matière (facultatif)
  matiere.json             facultatif : {"nom": "…", "teinte": 160, "ordre": ["id1", "id2"], "exclure": ["id"]}
                           (teinte : couleur de la matière dans l'app, angle de 0 à 360 sur le cercle des couleurs)

Titre d'un chapitre : premier titre « # … » du cours converti, sinon son id.
Ordre des chapitres : celui de « ordre » dans matiere.json, puis les autres par ordre alphabétique.

Usage :
  outils/generer_index.py              # vérifie puis écrit matieres/index.json
  outils/generer_index.py --verifier   # vérifie seulement, n'écrit rien (code 1 si erreur ou index pas à jour)

En cas d'erreur, rien n'est écrit.
"""
import argparse
import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
MATIERES = RACINE / "matieres"
INDEX = MATIERES / "index.json"

CHAMPS_QUESTION = {"id", "niveau", "section", "enonce", "corrige", "source", "tags"}


class Rapport:
    def __init__(self):
        self.erreurs: list[str] = []
        self.avertissements: list[str] = []
        self.questions = 0  # questions valides référencées dans l'index

    def erreur(self, message: str):
        self.erreurs.append(message)

    def avertir(self, message: str):
        self.avertissements.append(message)


def relatif(chemin: Path) -> str:
    """Chemin tel qu'écrit dans index.json : relatif à matieres/, avec des /."""
    return chemin.relative_to(MATIERES).as_posix()


def lire_json(chemin: Path, rapport: Rapport):
    try:
        return json.loads(chemin.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        rapport.erreur(f"{relatif(chemin)} : JSON illisible ({e})")
        return None


def titre_du_markdown(chemin: Path) -> str | None:
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        trouve = re.match(r"#\s+(.+?)\s*#*\s*$", ligne)
        if trouve:
            return trouve.group(1)
    return None


def verifier_questions(chemin: Path, id_chapitre: str, ids_vus: dict[str, str], rapport: Rapport) -> bool:
    """Vérifie un fichier questions/<id>.json. Renvoie False s'il contient une erreur."""
    nom = relatif(chemin)
    donnees = lire_json(chemin, rapport)
    if donnees is None:
        return False
    if not isinstance(donnees, dict) or not isinstance(donnees.get("questions"), list):
        rapport.erreur(f"{nom} : il faut un objet {{\"chapitre\": …, \"questions\": [ … ]}}")
        return False
    nb_erreurs = len(rapport.erreurs)
    if donnees.get("chapitre") != id_chapitre:
        rapport.erreur(f"{nom} : \"chapitre\" vaut {donnees.get('chapitre')!r}, attendu {id_chapitre!r}")

    for i, q in enumerate(donnees["questions"], start=1):
        ou = f"{nom}, question {i}"
        if not isinstance(q, dict):
            rapport.erreur(f"{ou} : ce n'est pas un objet")
            continue
        qid = q.get("id")
        if not isinstance(qid, str) or not qid.strip():
            rapport.erreur(f"{ou} : \"id\" manquant")
        else:
            ou = f"{nom}, {qid}"
            if qid in ids_vus:
                rapport.erreur(f"{ou} : id déjà utilisé dans {ids_vus[qid]}")
            ids_vus[qid] = nom
            if not qid.startswith(f"{id_chapitre}-"):
                rapport.avertir(f"{ou} : l'id devrait commencer par « {id_chapitre}- »")
        if q.get("niveau") not in (1, 2, 3):
            rapport.erreur(f"{ou} : \"niveau\" doit valoir 1, 2 ou 3 (reçu {q.get('niveau')!r})")
        if not isinstance(q.get("enonce"), str) or not q["enonce"].strip():
            rapport.erreur(f"{ou} : \"enonce\" manquant ou vide")
        corrige = q.get("corrige")
        if not isinstance(corrige, list) or not corrige or not all(isinstance(e, str) and e.strip() for e in corrige):
            rapport.erreur(f"{ou} : \"corrige\" doit être une liste d'étapes (textes non vides)")
        for champ in ("section", "source"):
            if champ in q and not isinstance(q[champ], str):
                rapport.erreur(f"{ou} : \"{champ}\" doit être un texte")
        if "tags" in q and not (isinstance(q["tags"], list) and all(isinstance(t, str) for t in q["tags"])):
            rapport.erreur(f"{ou} : \"tags\" doit être une liste de textes")
        inconnus = set(q) - CHAMPS_QUESTION
        if inconnus:
            rapport.avertir(f"{ou} : champ(s) inconnu(s) ignoré(s) par l'app : {', '.join(sorted(inconnus))}")
    if len(rapport.erreurs) > nb_erreurs:
        return False
    rapport.questions += len(donnees["questions"])
    return True


def construire_matiere(dossier: Path, ids_vus: dict[str, str], rapport: Rapport) -> dict | None:
    convertis = dossier / "convertis"
    cours = sorted(convertis.glob("*.md")) if convertis.is_dir() else []
    if not cours:
        return None

    reglages = {}
    if (dossier / "matiere.json").exists():
        reglages = lire_json(dossier / "matiere.json", rapport) or {}
    exclure = set(reglages.get("exclure", []))
    ordre = reglages.get("ordre", [])

    ids = [c.stem for c in cours if c.stem not in exclure]
    for inconnu in [i for i in ordre if i not in ids]:
        rapport.avertir(f"{dossier.name}/matiere.json : « {inconnu} » dans \"ordre\" mais pas dans convertis/")
    ids = [i for i in ordre if i in ids] + sorted(i for i in ids if i not in ordre)

    matiere = {"id": dossier.name, "nom": reglages.get("nom") or dossier.name.replace("_", " ").capitalize()}
    teinte = reglages.get("teinte")
    if teinte is not None:
        if isinstance(teinte, (int, float)) and 0 <= teinte <= 360:
            matiere["teinte"] = teinte
        else:
            rapport.avertir(f"{dossier.name}/matiere.json : \"teinte\" doit être un nombre entre 0 et 360")
    if (dossier / "notations.md").exists():
        matiere["notations"] = relatif(dossier / "notations.md")

    chapitres = []
    for id_chapitre in ids:
        fichier = convertis / f"{id_chapitre}.md"
        chapitre = {
            "id": id_chapitre,
            "titre": titre_du_markdown(fichier) or id_chapitre,
            "fichier": relatif(fichier),
        }
        fiche = dossier / "fiches" / f"{id_chapitre}.md"
        if fiche.exists():
            chapitre["fiche"] = relatif(fiche)
        questions = dossier / "questions" / f"{id_chapitre}.json"
        if questions.exists() and verifier_questions(questions, id_chapitre, ids_vus, rapport):
            chapitre["questions"] = relatif(questions)
        chapitres.append(chapitre)
    matiere["chapitres"] = chapitres

    # Fichiers rattachés à un chapitre qui n'existe pas (faute de frappe dans le nom ?).
    for sous_dossier, extension in (("fiches", ".md"), ("questions", ".json")):
        for orphelin in sorted((dossier / sous_dossier).glob(f"*{extension}")):
            if orphelin.stem not in ids:
                rapport.avertir(f"{relatif(orphelin)} : aucun chapitre « {orphelin.stem} » dans convertis/, fichier ignoré")
    return matiere


def construire_index(rapport: Rapport) -> dict:
    ids_vus: dict[str, str] = {}
    matieres = []
    for dossier in sorted(p for p in MATIERES.iterdir() if p.is_dir() and not p.name.startswith((".", "_"))):
        matiere = construire_matiere(dossier, ids_vus, rapport)
        if matiere:
            matieres.append(matiere)
        else:
            rapport.avertir(f"{dossier.name}/ : aucun chapitre dans convertis/, matière ignorée")
    return {"matieres": matieres}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--verifier", action="store_true", help="vérifier seulement, sans écrire index.json")
    args = parser.parse_args()

    rapport = Rapport()
    index = construire_index(rapport)
    texte = json.dumps(index, ensure_ascii=False, indent=2) + "\n"
    actuel = INDEX.read_text(encoding="utf-8") if INDEX.exists() else ""

    for message in rapport.avertissements:
        print(f"⚠️  {message}", file=sys.stderr)
    for message in rapport.erreurs:
        print(f"❌ {message}", file=sys.stderr)

    nb_chapitres = sum(len(m["chapitres"]) for m in index["matieres"])
    resume = f"{len(index['matieres'])} matière(s), {nb_chapitres} chapitre(s), {rapport.questions} question(s)"
    if rapport.erreurs:
        print(f"Index non écrit : {len(rapport.erreurs)} erreur(s). ({resume})", file=sys.stderr)
        return 1
    if texte == actuel:
        print(f"✅ index.json à jour ({resume})")
        return 0
    if args.verifier:
        print(f"⚠️  index.json pas à jour : lancer outils/generer_index.py ({resume})", file=sys.stderr)
        return 1
    INDEX.write_text(texte, encoding="utf-8")
    print(f"✅ index.json écrit ({resume})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
