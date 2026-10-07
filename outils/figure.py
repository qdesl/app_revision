#!/usr/bin/env python3
"""Génère les graphiques des cours en SVG, à partir d'un script Python ou d'un fichier LaTeX.

Les sources sont rangées dans matieres/<matière>/figures/ :
  - <nom>.py  : script matplotlib (sans plt.show() ni savefig : ce script s'en charge).
                Chaque figure ouverte est enregistrée : <nom>.svg, puis <nom>-2.svg, <nom>-3.svg…
  - <nom>.tex : dessin TikZ / pgfplots. Soit un document complet (\\documentclass…),
                soit seulement le dessin (\\begin{tikzpicture}…) : il est alors placé dans
                un document « standalone » avec tikz, pgfplots, amsmath et amssymb.

Le SVG est produit à côté de la source, et s'insère dans un cours avec :
  ![Légende](../figures/<nom>.svg)

Usage :
  outils/figure.py                          # toutes les figures à refaire (source plus récente que le SVG)
  outils/figure.py matieres/stats/figures   # un dossier
  outils/figure.py chemin/vers/courbe.py    # un fichier
  outils/figure.py --tout ...               # refait même les figures à jour
  outils/figure.py --python ~/anaconda3/bin/python ...   # Python à utiliser pour matplotlib

Outils nécessaires : matplotlib (pour .py), pdflatex + pdftocairo (pour .tex).
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

# Exécuté dans un processus Python à part : style lisible sur téléphone, puis le script de
# l'utilisateur, puis l'enregistrement de chaque figure en SVG à fond transparent.
LANCEUR_MATPLOTLIB = r"""
import runpy, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.rcParams.update({
    "figure.figsize": (6, 4), "font.size": 13, "lines.linewidth": 2,
    "axes.grid": True, "grid.alpha": 0.3, "svg.fonttype": "path",
})
source, sortie = sys.argv[1], sys.argv[2]
runpy.run_path(source, run_name="__main__")
for i, numero in enumerate(plt.get_fignums()):
    chemin = sortie + (".svg" if i == 0 else f"-{i + 1}.svg")
    plt.figure(numero).savefig(chemin, format="svg", transparent=True, bbox_inches="tight")
    print(chemin)
if not plt.get_fignums():
    sys.exit("aucune figure créée par le script")
"""

MODELE_TEX = r"""\documentclass[border=4pt]{standalone}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb}
\usepackage{tikz}
\usetikzlibrary{arrows.meta,positioning,calc,shapes,decorations.pathreplacing}
\usepackage{pgfplots}
\pgfplotsset{compat=1.18}
\begin{document}
%s
\end{document}
"""


def depuis_python(source: Path, python: str) -> list[Path]:
    resultat = subprocess.run(
        [python, "-c", LANCEUR_MATPLOTLIB, str(source), str(source.with_suffix(""))],
        cwd=source.parent, capture_output=True, text=True,
    )
    if resultat.returncode != 0:
        raise RuntimeError(resultat.stderr.strip().splitlines()[-1] if resultat.stderr.strip() else "échec")
    return [Path(ligne) for ligne in resultat.stdout.split() if ligne.endswith(".svg")]


def depuis_latex(source: Path) -> list[Path]:
    texte = source.read_text(encoding="utf-8")
    if r"\documentclass" not in texte:
        texte = MODELE_TEX % texte
    with tempfile.TemporaryDirectory() as dossier:
        tex = Path(dossier) / "figure.tex"
        tex.write_text(texte, encoding="utf-8")
        # Les fichiers voisins (données .csv…) restent accessibles via TEXINPUTS.
        env = {"TEXINPUTS": f"{source.parent}:", **os.environ}
        resultat = subprocess.run(
            ["pdflatex", "-interaction=nonstopmode", "-halt-on-error", "figure.tex"],
            cwd=dossier, capture_output=True, text=True, env=env,
        )
        if resultat.returncode != 0:
            erreurs = [l for l in resultat.stdout.splitlines() if l.startswith("!")]
            raise RuntimeError(erreurs[0] if erreurs else "échec de pdflatex")
        svg = source.with_suffix(".svg")
        subprocess.run(["pdftocairo", "-svg", str(Path(dossier) / "figure.pdf"), str(svg)], check=True)
    return [svg]


def a_refaire(source: Path) -> bool:
    svg = source.with_suffix(".svg")
    return not svg.exists() or svg.stat().st_mtime < source.stat().st_mtime


def lister_sources(chemins: list[str]) -> list[Path]:
    if not chemins:
        chemins = [str(p) for p in sorted((RACINE / "matieres").glob("*/figures"))]
    sources = []
    for chemin in map(Path, chemins):
        if chemin.is_dir():
            sources += sorted(p for p in chemin.iterdir() if p.suffix in (".py", ".tex"))
        elif chemin.suffix in (".py", ".tex"):
            sources.append(chemin)
        else:
            print(f"ignoré : {chemin}", file=sys.stderr)
    return sources


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("chemins", nargs="*", help="fichiers .py/.tex ou dossiers figures/")
    parser.add_argument("--tout", action="store_true", help="refaire même les figures à jour")
    parser.add_argument("--python", default=sys.executable, help="Python avec matplotlib (défaut : celui-ci)")
    args = parser.parse_args()

    if any(p.suffix == ".tex" for p in lister_sources(args.chemins)):
        for outil in ("pdflatex", "pdftocairo"):
            if not shutil.which(outil):
                print(f"outil manquant : {outil}", file=sys.stderr)
                return 1

    echecs = 0
    for source in lister_sources(args.chemins):
        if not args.tout and not a_refaire(source):
            continue
        try:
            produits = depuis_python(source, args.python) if source.suffix == ".py" else depuis_latex(source)
            for svg in produits:
                print(f"✅ {svg.relative_to(RACINE) if svg.is_relative_to(RACINE) else svg}")
        except Exception as erreur:
            echecs += 1
            print(f"❌ {source} : {erreur}", file=sys.stderr)
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
