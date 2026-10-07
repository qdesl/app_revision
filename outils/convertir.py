#!/usr/bin/env python3
"""Convertit en Markdown tous les documents déposés dans matieres/<matière>/sources/.

Chaque document devient un dossier dans convertis/<type>/ :
  sources/td/TD2.pdf          → convertis/td/TD2/TD2.md   (+ ses images)
  sources/cours/poly.tex      → convertis/cours/poly/poly.md
  sources/IMG_2041.jpg        → convertis/vrac/IMG_2041/IMG_2041.md
<type> = premier sous-dossier de sources/ (cours, td, partiels, notes, captures…), « vrac » sinon.
Ces fichiers ne sont PAS des chapitres : c'est Claude qui découpe ensuite le cours en
convertis/<id>.md (voir CLAUDE.md).

Outils :
  - pandoc  : .tex .docx .odt .ipynb .md .html .rtf .epub (formules en $…$ / $$…$$)
  - Marker  : .pdf .png .jpg .jpeg .webp .pptx, via outils/convertir_pdf.sh (PC fixe, GPU) ;
              un seul démarrage du serveur par lot de fichiers.

Seuls les documents nouveaux ou modifiés depuis leur conversion sont traités.

Usage :
  outils/convertir.py matieres/optimisation          # une matière
  outils/convertir.py                                # toutes les matières
  outils/convertir.py --liste matieres/optimisation  # montre ce qui serait fait, sans rien faire
  outils/convertir.py --tout ...                     # reconvertit tout
"""
import argparse
import os
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SCRIPT_MARKER = RACINE / "outils" / "convertir_pdf.sh"

POUR_PANDOC = {".tex": "latex", ".docx": "docx", ".odt": "odt", ".ipynb": "ipynb", ".md": "markdown",
               ".html": "html", ".htm": "html", ".rtf": "rtf", ".epub": "epub"}
POUR_MARKER = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".pptx"}

# Markdown lisible par l'app (marked) : pas de blocs ::: ni d'attributs {#id .classe} propres à pandoc.
FORMAT_SORTIE = "markdown-fenced_divs-bracketed_spans-header_attributes-link_attributes-raw_attribute-simple_tables-multiline_tables-grid_tables+pipe_tables"
TEXTE_MINIMUM = 200  # caractères : sous ce seuil, une conversion Marker a sans doute échoué (manuscrit, scan flou…)


def type_de(source: Path, dossier_sources: Path) -> str:
    parties = source.relative_to(dossier_sources).parts
    return parties[0].lower() if len(parties) > 1 else "vrac"


def sortie_de(source: Path, dossier_sources: Path) -> Path:
    convertis = dossier_sources.parent / "convertis"
    return convertis / type_de(source, dossier_sources) / source.stem / f"{source.stem}.md"


def a_faire(source: Path, sortie: Path, tout: bool) -> bool:
    return tout or not sortie.exists() or sortie.stat().st_mtime < source.stat().st_mtime


def avec_pandoc(source: Path, sortie: Path) -> None:
    sortie.parent.mkdir(parents=True, exist_ok=True)
    commande = ["pandoc", str(source), "-f", POUR_PANDOC[source.suffix.lower()], "-t", FORMAT_SORTIE,
                "--wrap=none", "--extract-media", ".", "-o", sortie.name]
    # Lancé depuis le dossier de sortie : les images extraites y sont rangées avec des chemins relatifs.
    resultat = subprocess.run(commande, cwd=sortie.parent, capture_output=True, text=True)
    if resultat.returncode != 0:
        raise RuntimeError(resultat.stderr.strip().splitlines()[-1] if resultat.stderr.strip() else "échec de pandoc")


def avec_marker(sources: list[Path], dossier_sortie: Path) -> None:
    """Un appel pour tout le lot : le serveur du modèle ne démarre qu'une fois."""
    dossier_sortie.mkdir(parents=True, exist_ok=True)
    resultat = subprocess.run([str(SCRIPT_MARKER), *map(str, sources)], cwd=RACINE,
                              env={**os.environ, "SORTIE": str(dossier_sortie)})
    if resultat.returncode != 0:
        raise RuntimeError(f"convertir_pdf.sh a échoué (code {resultat.returncode})")


def traiter(dossier_matiere: Path, tout: bool, liste: bool) -> dict:
    dossier_sources = dossier_matiere / "sources"
    bilan = defaultdict(list)
    if not dossier_sources.is_dir():
        print(f"  (pas de dossier sources/ dans {dossier_matiere.name})")
        return bilan

    fichiers = sorted(p for p in dossier_sources.rglob("*") if p.is_file() and not p.name.startswith("."))
    lots_marker = defaultdict(list)  # dossier de sortie → sources
    for source in fichiers:
        extension = source.suffix.lower()
        sortie = sortie_de(source, dossier_sources)
        if extension not in POUR_PANDOC and extension not in POUR_MARKER:
            bilan["ignorés (format inconnu)"].append(source)
        elif not a_faire(source, sortie, tout):
            bilan["déjà à jour"].append(source)
        elif liste:
            bilan["à convertir (pandoc)" if extension in POUR_PANDOC else "à convertir (Marker)"].append(source)
        elif extension in POUR_PANDOC:
            try:
                avec_pandoc(source, sortie)
                bilan["convertis (pandoc)"].append(source)
                # pandoc ignore les dessins TikZ : à refaire avec outils/figure.py (voir CLAUDE.md).
                if extension == ".tex" and "tikzpicture" in source.read_text(encoding="utf-8", errors="replace"):
                    bilan["figures TikZ ignorées par pandoc (→ outils/figure.py)"].append(source)
            except Exception as erreur:
                bilan["échecs"].append(source)
                print(f"  ❌ {source.name} : {erreur}", file=sys.stderr)
        else:
            lots_marker[sortie.parent.parent].append(source)

    for dossier_sortie, lot in lots_marker.items():
        if not SCRIPT_MARKER.exists():
            bilan["en attente de Marker (PC fixe)"].extend(lot)
            continue
        try:
            avec_marker(lot, dossier_sortie)
        except Exception as erreur:
            print(f"  ❌ Marker : {erreur}", file=sys.stderr)
        for source in lot:
            sortie = sortie_de(source, dossier_sources)
            bilan["convertis (Marker)" if sortie.exists() else "échecs"].append(source)

    # Conversions Marker presque vides : souvent du manuscrit que l'OCR lit mal.
    for source in bilan["convertis (Marker)"]:
        sortie = sortie_de(source, dossier_sources)
        if len(sortie.read_text(encoding="utf-8", errors="replace").strip()) < TEXTE_MINIMUM:
            bilan["à lire par Claude (conversion presque vide)"].append(source)
    return bilan


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("matieres", nargs="*", help="dossiers matieres/<matière> (défaut : toutes)")
    parser.add_argument("--tout", action="store_true", help="reconvertir même ce qui est à jour")
    parser.add_argument("--liste", action="store_true", help="montrer ce qui serait fait, sans rien convertir")
    args = parser.parse_args()

    if not args.liste and not shutil.which("pandoc"):
        print("⚠️ pandoc introuvable : les .tex, .docx, .ipynb… ne pourront pas être convertis.", file=sys.stderr)

    dossiers = [Path(d) for d in args.matieres] or sorted(p for p in (RACINE / "matieres").iterdir() if p.is_dir())
    echec = False
    for dossier in dossiers:
        print(f"📁 {dossier.name}")
        bilan = traiter(dossier.resolve(), args.tout, args.liste)
        for categorie, sources in bilan.items():
            if not sources:
                continue
            print(f"  {categorie} : {len(sources)}")
            if categorie != "déjà à jour":
                for source in sources:
                    print(f"    - {source.relative_to(dossier.resolve() / 'sources')}")
        echec |= bool(bilan["échecs"])
    return 1 if echec else 0


if __name__ == "__main__":
    sys.exit(main())
