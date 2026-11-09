# Vita — fiche du jeu

## Concept
Une boîte à outils pour le **Jeu de la vie**, revisitée avec le tableau **« Untangled »** (John Daniel, 2026) : triangle de Pascal, nombres triangulaires, tournesol de Kepler / Fibonacci. Trois modes (Grille, Tournesol, Triangle), tous soumis à la même règle de croissance quand **Untangled** est actif.

## Règle Untangled (croissance triangulaire)

Le dessin fixe le cadre : deux sources au sommet, **+1** (haut-gauche) et **−1** (haut-droite). Chacune envoie 7 rayons vers la base ; leurs croisements forment un triangle de **7 rangées**. La rangée *n* contient *n* cellules, numérotées **1…28**. Les totaux cumulés sont les **nombres triangulaires** :

> 1 → 3 → 6 → 10 → 15 → 21 → 28

**Croissance (modèle v1.2, le plus simple fidèle au tableau)**  
1. Une colonie part d’un **apex** (cellule nº 1) : population = 1.  
2. Chaque pas de Lecture / +1 **ajoute toute la rangée suivante** (*n* naissances au pas *n*), placées aux croisements +1/−1 dans l’ordre 1…28.  
3. La population passe donc strictement par 1, 3, 6, 10, 15, 21, 28.  
4. À **28**, la colonie est complète : le pas suivant **ensemence un nouvel apex** (split) et recommence.  
5. **Conway B3/S23** reste le moteur quand Untangled est **désactivé**. Quand Untangled est **actif**, les naissances Conway sont remplacées par l’agenda triangulaire (sinon on casserait la suite 1…28) ; la survie/mort Conway continue de s’appliquer au reste de la grille hors structure.

Calque optionnel **Rayons** : rayons +1/−1, diagonale vers 28, et numéros sur les cellules. Preset **Untangled** : pose l’apex et anime 1→28.

## Modes

| Mode | Idée |
|---|---|
| **Grille** | Conway classique (si Untangled off) ou tampon triangulaire sur la grille |
| **Tournesol** | Phyllotaxie à l’angle d’or ; sous Untangled, les nº 1…28 allument les graines du spiral |
| **Triangle** | Rule 90 / Pascal ; compatible avec la colonie Untangled superposée |

## Contrôles
- **Pinceau / Gomme / Déplacer**, **Lecture / Pause / +1**, **Zoom / Vitesse**
- **Aléatoire / Effacer / Tore** : toujours visibles
- **Untangled / Rayons** : activer la croissance triangulaire et le calque du tableau
- **Presets** : Planeur, Vaisseau, Pulsar, Gosper, Gland, Pascal mod 2 / 5, **Untangled**

## État (v1.2, 2026-11-09)
- Layout mobile sans débordement horizontal (360/390/430).
- Croissance Untangled testée (suite 1…28 + split).
- Vérifié Chrome headless 390×844 sur GitHub Pages.
- Pas encore testé sur un vrai téléphone.

## Prochaines idées
- Plusieurs colonies Untangled simultanées (plusieurs paires +1/−1).
- Mesure réelle des parastiches sur le tournesol.
- Partage d’une graine (URL hash).
