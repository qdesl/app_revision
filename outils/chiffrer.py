#!/usr/bin/env python3
"""Construit le site à publier : l'app telle quelle + les cours CHIFFRÉS.

Seuls les fichiers que l'app utilise sont publiés (index.json, cours découpés, fiches,
notations, questions, et les images citées dans leur Markdown), tous chiffrés :

  _site/
  ├── index.html, .nojekyll, app/…        (l'app, en clair : elle ne contient aucun cours)
  └── matieres/
      ├── acces.json      sel et nombre d'itérations (publics), pour dériver la clé du mot de passe
      ├── fichiers.json   noms des fichiers chiffrés + empreinte (le téléphone sait ce qui a changé)
      └── f/<nom>         un fichier chiffré par fichier d'origine ; <nom> ne révèle pas le chemin

Chiffrement :
  - clé : PBKDF2-HMAC-SHA256(mot de passe, sel, itérations) → 64 octets :
          32 pour AES-256-GCM, 32 pour HMAC-SHA256 ;
  - nom d'un fichier : HMAC(chemin) ; contenu : nonce (12 octets) + AES-GCM(données),
    avec le chemin en données associées (un fichier ne peut pas être échangé avec un autre) ;
  - nonce = HMAC(chemin + empreinte du contenu) : même contenu → mêmes octets d'une publication
    à l'autre (le téléphone ne retélécharge que ce qui a changé), jamais deux contenus avec le même nonce.

Le mot de passe est lu dans la variable d'environnement MOT_DE_PASSE_COURS (jamais en argument).
Le sel est dans matieres/chiffrement.json (créé par --init, à ne plus changer : sinon le téléphone
redemande le mot de passe).

Usage :
  outils/chiffrer.py --init                          crée matieres/chiffrement.json (une fois)
  MOT_DE_PASSE_COURS=… outils/chiffrer.py            construit _site/
  MOT_DE_PASSE_COURS=… outils/chiffrer.py --sortie dossier
"""
import argparse
import base64
import hashlib
import hmac
import json
import os
import posixpath
import re
import secrets
import shutil
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

RACINE = Path(__file__).resolve().parent.parent
MATIERES = RACINE / "matieres"
REGLAGES = MATIERES / "chiffrement.json"
ITERATIONS = 600_000
EXTENSIONS = (".md", ".json", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif")


def deriver_cles(mot_de_passe: str, sel: bytes, iterations: int) -> tuple[bytes, bytes]:
    cle = hashlib.pbkdf2_hmac("sha256", mot_de_passe.encode("utf-8"), sel, iterations, dklen=64)
    return cle[:32], cle[32:]


def nom_chiffre(cle_hmac: bytes, chemin: str) -> str:
    return "f/" + hmac.new(cle_hmac, chemin.encode("utf-8"), hashlib.sha256).hexdigest()[:32]


def chiffrer(cle_aes: bytes, cle_hmac: bytes, chemin: str, donnees: bytes) -> bytes:
    empreinte = hashlib.sha256(donnees).digest()
    nonce = hmac.new(cle_hmac, b"nonce\0" + chemin.encode("utf-8") + b"\0" + empreinte, hashlib.sha256).digest()[:12]
    return nonce + AESGCM(cle_aes).encrypt(nonce, donnees, chemin.encode("utf-8"))


def chemins_de_l_index(valeur, chemins: set) -> set:
    """Tous les chemins de fichiers cités dans index.json (même logique que le service worker)."""
    if isinstance(valeur, str) and valeur.lower().endswith(EXTENSIONS):
        chemins.add(valeur)
    elif isinstance(valeur, dict):
        for v in valeur.values():
            chemins_de_l_index(v, chemins)
    elif isinstance(valeur, list):
        for v in valeur:
            chemins_de_l_index(v, chemins)
    return chemins


def images_du_markdown(texte: str, chemin_md: str) -> list[str]:
    """Images ![…](chemin) relatives, résolues par rapport au dossier du fichier .md."""
    dossier = posixpath.dirname(chemin_md)
    images = []
    for cible in re.findall(r"!\[[^\]]*\]\(\s*<?([^)\s>]+)", texte):
        if re.match(r"^[a-z]+:", cible, re.I) or cible.startswith("/"):
            continue
        images.append(posixpath.normpath(posixpath.join(dossier, cible)))
    return images


def initialiser() -> int:
    if REGLAGES.exists():
        print(f"{REGLAGES.relative_to(RACINE)} existe déjà : ne pas le changer (le téléphone redemanderait le mot de passe).")
        return 1
    REGLAGES.write_text(json.dumps({"sel": base64.b64encode(secrets.token_bytes(16)).decode(),
                                    "iterations": ITERATIONS}, indent=2) + "\n")
    print(f"✅ {REGLAGES.relative_to(RACINE)} créé.")
    return 0


def construire(sortie: Path, mot_de_passe: str) -> int:
    reglages = json.loads(REGLAGES.read_text())
    sel = base64.b64decode(reglages["sel"])
    cle_aes, cle_hmac = deriver_cles(mot_de_passe, sel, reglages["iterations"])

    if sortie.exists():
        shutil.rmtree(sortie)
    shutil.copytree(RACINE / "app", sortie / "app")
    shutil.copy2(RACINE / "index.html", sortie / "index.html")
    (sortie / ".nojekyll").touch()
    (sortie / "matieres" / "f").mkdir(parents=True)

    a_chiffrer = ["index.json"] + sorted(chemins_de_l_index(json.loads((MATIERES / "index.json").read_text()), set()))
    vus, fichiers, manquants = set(), {}, []
    while a_chiffrer:
        chemin = a_chiffrer.pop(0)
        if chemin in vus:
            continue
        vus.add(chemin)
        source = MATIERES / chemin
        if not source.is_file():
            manquants.append(chemin)
            continue
        donnees = source.read_bytes()
        if chemin.endswith(".md"):
            a_chiffrer += images_du_markdown(donnees.decode("utf-8", errors="replace"), chemin)
        nom = nom_chiffre(cle_hmac, chemin)
        contenu = chiffrer(cle_aes, cle_hmac, chemin, donnees)
        (sortie / "matieres" / nom).write_bytes(contenu)
        fichiers[nom] = hashlib.sha256(contenu).hexdigest()[:16]

    (sortie / "matieres" / "acces.json").write_text(json.dumps(
        {"version": 1, "sel": reglages["sel"], "iterations": reglages["iterations"]}, indent=2) + "\n")
    (sortie / "matieres" / "fichiers.json").write_text(json.dumps(
        {"fichiers": dict(sorted(fichiers.items()))}, indent=2) + "\n")

    print(f"✅ {sortie} : {len(fichiers)} fichier(s) chiffré(s).")
    for chemin in manquants:
        print(f"⚠️ cité mais introuvable : matieres/{chemin}", file=sys.stderr)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--init", action="store_true", help="créer matieres/chiffrement.json (une seule fois)")
    parser.add_argument("--sortie", default=str(RACINE / "_site"), help="dossier du site (défaut : _site/)")
    args = parser.parse_args()
    if args.init:
        return initialiser()
    mot_de_passe = os.environ.get("MOT_DE_PASSE_COURS", "")
    if len(mot_de_passe) < 12:
        print("❌ MOT_DE_PASSE_COURS absent ou trop court (12 caractères minimum).", file=sys.stderr)
        return 1
    if not REGLAGES.exists():
        print("❌ matieres/chiffrement.json manquant : lancer d'abord outils/chiffrer.py --init.", file=sys.stderr)
        return 1
    return construire(Path(args.sortie), mot_de_passe)


if __name__ == "__main__":
    sys.exit(main())
