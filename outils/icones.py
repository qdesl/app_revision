#!/usr/bin/env python3
"""Dessine les icônes de l'app (livre ouvert blanc sur fond bleu) dans app/icones/.

Usage : outils/icones.py   (nécessite Pillow)
"""
from pathlib import Path

from PIL import Image, ImageDraw

DOSSIER = Path(__file__).resolve().parent.parent / "app" / "icones"
BLEU = (47, 95, 208)
BLANC = (255, 255, 255)
SURECHANTILLONNAGE = 4  # dessin en grand puis réduit : bords lisses


def dessiner(taille: int, marge: float, arrondi: float) -> Image.Image:
    """marge : part du côté laissée vide autour du livre ; arrondi : rayon des coins (0 = carré)."""
    t = taille * SURECHANTILLONNAGE
    image = Image.new("RGBA", (t, t), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    d.rounded_rectangle([0, 0, t - 1, t - 1], radius=int(arrondi * t), fill=BLEU)

    # Livre ouvert : deux pages légèrement inclinées, une reliure au milieu.
    g, dr = marge * t, (1 - marge) * t
    haut, bas, milieu = 0.30 * t, 0.72 * t, t / 2
    creux = 0.035 * t
    page_gauche = [(g, haut), (milieu - creux, haut + creux * 1.6), (milieu - creux, bas + creux * 1.6), (g, bas)]
    page_droite = [(milieu + creux, haut + creux * 1.6), (dr, haut), (dr, bas), (milieu + creux, bas + creux * 1.6)]
    d.polygon(page_gauche, fill=BLANC)
    d.polygon(page_droite, fill=BLANC)

    # Lignes de texte sur les pages.
    epaisseur = max(1, int(0.022 * t))
    for i in range(4):
        y = haut + (0.08 + 0.085 * i) * t
        d.line([(g + 0.05 * t, y), (milieu - creux - 0.05 * t, y + creux * 0.8)], fill=BLEU, width=epaisseur)
        d.line([(milieu + creux + 0.05 * t, y + creux * 0.8), (dr - 0.05 * t, y)], fill=BLEU, width=epaisseur)

    return image.resize((taille, taille), Image.LANCZOS)


def main() -> None:
    DOSSIER.mkdir(parents=True, exist_ok=True)
    # Icônes « any » : coins arrondis, livre assez grand.
    for taille in (192, 512):
        dessiner(taille, marge=0.16, arrondi=0.22).save(DOSSIER / f"icone-{taille}.png")
    # Icône « maskable » : Android la découpe (cercle, goutte…) → fond plein, livre dans la zone sûre (80 %).
    dessiner(512, marge=0.24, arrondi=0).save(DOSSIER / "icone-maskable-512.png")
    # Icône d'écran d'accueil iOS / favicon.
    dessiner(180, marge=0.16, arrondi=0).save(DOSSIER / "icone-180.png")
    for fichier in sorted(DOSSIER.iterdir()):
        print(f"✅ {fichier.relative_to(DOSSIER.parent.parent)}")


if __name__ == "__main__":
    main()
