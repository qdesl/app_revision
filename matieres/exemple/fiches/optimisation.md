# Optimisation convexe — fiche de révision

> **À retenir :** exemple de fiche pour tester l'app. Les références aux TD et partiels ci-dessous sont **fictives**.

## Notations

| Symbole | Signification |
|---|---|
| $f$ | fonction à minimiser, de $\mathbb{R}^n$ dans $\mathbb{R}$ |
| $\lambda \in [0,1]$ | coefficient de la combinaison convexe |
| $\nabla f$, $\nabla^2 f$ | gradient, hessienne |
| $A \succeq 0$ | $A$ semi-définie positive ; $I$ l'identité |
| $x_k$, $x^\star$ | $k$-ième itéré, minimiseur |
| $\eta$ | pas de la descente |
| $L$, $\mu$ | constantes de lissité et de forte convexité |
| $a$ | coefficient de la quadratique test $f(x) = a x^2$ |

## Fonctions convexes

**Définition.** $f$ est convexe si $f(\lambda x + (1-\lambda) y) \le \lambda f(x) + (1-\lambda) f(y)$ pour tous $x, y$ et $\lambda \in [0,1]$ : la corde est au-dessus du graphe.

**Critère pratique** (deux fois dérivable) : $f$ convexe $\iff \nabla^2 f(x) \succeq 0$ pour tout $x$.

> **Méthode (TD 1, ex. 3) :** pour montrer qu'une fonction est convexe, calculer la hessienne et vérifier que ses valeurs propres sont $\ge 0$ ; en dimension 1, vérifier $f'' \ge 0$.

> **Piège :** convexe n'implique pas dérivable ($|x|$ en $0$). Au partiel, ne pas utiliser le gradient sans l'avoir justifié.

## Descente de gradient

$$x_{k+1} = x_k - \eta \nabla f(x_k)$$

- Si $f$ est convexe et $L$-lisse, avec $\eta = 1/L$ : $f(x_k) - f(x^\star) \le \dfrac{L \lVert x_0 - x^\star \rVert^2}{2k}$, soit une vitesse en $O(1/k)$.
- Pas trop grand ($\eta > 2/L$) : divergence possible.

![Petit pas : convergence lente ; grand pas : oscillations.](../figures/descente.svg)

> **Tombé en partiel (2025, ex. 2) :** calculer les 3 premiers itérés sur une quadratique, puis trouver pour quelles valeurs de $\eta$ la suite converge. Réflexe : $x_{k+1} = (1 - 2\eta a) x_k$ pour $f(x) = a x^2$, donc convergence $\iff |1 - 2\eta a| < 1$.

> **Complément (TD 2, ex. 4) :** la *forte convexité*, absente du cours. $f$ est $\mu$-fortement convexe si $\nabla^2 f(x) \succeq \mu I$ ; avec $\eta = 1/L$, la convergence devient linéaire : $f(x_k) - f(x^\star) \le \left(1 - \frac{\mu}{L}\right)^k \bigl(f(x_0) - f(x^\star)\bigr)$. Le TD note $m$ ce que le cours noterait $\mu$.

> **Ce que le prof a dit** (notes du 12/10) : « la preuve du $O(1/k)$ n'est pas exigible, mais l'énoncé oui ».
