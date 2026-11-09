# Vita — Jeu de la vie

Jeu de la vie de Conway, avec un mode **tournesol** (phyllotaxie à l’angle d’or) et un mode **triangle de Pascal** (Sierpiński / règle 90). Esthétique encre + or Fibonacci. Jouable au doigt (portrait) et sur ordinateur.

**Jouer :** https://passcool17.github.io/vita/

- JavaScript + canvas, aucune étape de build.
- `logic.js` : règles (grille, graphe tournesol, Pascal, Rule 90) — testable dans Node.
- `game.js` : rendu, outils tactiles, modes.

## Tests

```sh
node test/logic.test.js
node test/e2e-cdp.mjs https://passcool17.github.io/vita/ /tmp/vita-shots
```

Concept, contrôles et prochaines idées : [GAME.md](GAME.md).
