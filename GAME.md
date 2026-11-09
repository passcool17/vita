# Vita — fiche du jeu

## Concept
Une boîte à outils pour le **Jeu de la vie**, revisitée avec les motifs du dessin « Untangled » (triangle de Pascal, nombres triangulaires, tournesol de Kepler / Fibonacci). Trois modes :

| Mode | Idée |
|---|---|
| **Grille** | Conway classique sur une grille, option tore, âge des cellules en or→ambre |
| **Tournesol** | Graines placées en phyllotaxie (angle d’or ~137,5°). Voisins = plus proches graines. Les bras (parastiches) affichent une paire Fibonacci |
| **Triangle** | Croissance Rule 90 (= Pascal mod 2 / Sierpiński). Presets Pascal mod 2 et mod 5 à tamponner sur la grille |

Cartes d’info factuelles (mathématiques seulement) pour chaque motif.

## Contrôles
- **Pinceau / Gomme** : dessiner ou effacer au doigt (ou souris).
- **Déplacer** : glisser pour panser la vue (grille ou tournesol).
- **Pincer** : zoom (grille via le curseur aussi ; tournesol scale).
- **Lecture / Pause / +1** : animer ou avancer d’une génération.
- **Aléatoire / Effacer / Tore** : toujours visibles sous les outils (pas de défilement caché).
- **Zoom / Vitesse** : curseurs sur la dernière rangée.
- **Presets** : Planeur, Vaisseau, Pulsar, Gosper, Gland, Pascal mod 2 / mod 5.

## État (v1.1, 2026-11-09)
- Trois modes jouables, palette encre/or, compteurs gén/cell, infos contextuelles.
- Layout mobile corrigé : pas de débordement horizontal à 360/390/430 px ; Aléatoire, Effacer et Tore toujours visibles (les presets seuls défilent).
- Tests unitaires : blinker, planeur, tore, voisins tournesol symétriques, Pascal mod 2/5, Rule 90.
- Vérifié dans Chrome headless (390×844) sur GitHub Pages, y compris `scrollWidth <= innerWidth`.
- Pas encore testé sur un vrai téléphone.

## Prochaines idées
- Compteur de parastiches mesuré (pas seulement estimé) et surlignage des bras.
- Mode triangle coloré en direct (mod n) pendant la lecture.
- Partage d’une graine (URL hash) et bibliothèque de methuselahs.
- Vibration légère au rythme des naissances sur mobile.
