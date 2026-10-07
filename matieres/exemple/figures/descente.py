# Itérés de la descente de gradient sur f(x) = x², pour deux pas différents.
import numpy as np
import matplotlib.pyplot as plt

f = lambda x: x**2
x = np.linspace(-2.2, 2.2, 200)
plt.plot(x, f(x), color="gray", label="$f(x) = x^2$")

for eta, couleur in [(0.1, "tab:blue"), (0.9, "tab:orange")]:
    xk = [2.0]
    for _ in range(6):
        xk.append(xk[-1] - eta * 2 * xk[-1])
    plt.plot(xk, [f(v) for v in xk], "o-", color=couleur, label=f"$\\eta = {eta}$")

plt.xlabel("$x$")
plt.ylabel("$f(x)$")
plt.title("Descente de gradient")
plt.legend()
