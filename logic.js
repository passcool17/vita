// Vita — logique pure (grille, tournesol, triangle de Pascal).
// Navigateur : window.VitaLogic  |  Node : module.exports
(function (root) {
  'use strict';

  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5°

  function createGrid(w, h, fill) {
    const g = new Array(h);
    for (let y = 0; y < h; y++) {
      g[y] = new Array(w);
      for (let x = 0; x < w; x++) g[y][x] = fill ? fill(x, y) : 0;
    }
    return g;
  }

  function cloneGrid(g) {
    return g.map((row) => row.slice());
  }

  function countAlive(g) {
    let n = 0;
    for (let y = 0; y < g.length; y++) {
      const row = g[y];
      for (let x = 0; x < row.length; x++) if (row[x] > 0) n++;
    }
    return n;
  }

  function neighbors8(g, x, y, wrap) {
    const h = g.length, w = g[0].length;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        let nx = x + dx, ny = y + dy;
        if (wrap) {
          nx = ((nx % w) + w) % w;
          ny = ((ny % h) + h) % h;
        } else if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (g[ny][nx] > 0) n++;
      }
    }
    return n;
  }

  /** Une génération Conway classique. Âge : cellules vivantes incrémentent leur âge. */
  function stepGrid(g, wrap) {
    const h = g.length, w = g[0].length;
    const next = createGrid(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alive = g[y][x] > 0;
        const n = neighbors8(g, x, y, wrap);
        if (alive && (n === 2 || n === 3)) next[y][x] = g[y][x] + 1;
        else if (!alive && n === 3) next[y][x] = 1;
      }
    }
    return next;
  }

  function clearGrid(g) {
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) g[y][x] = 0;
  }

  function randomizeGrid(g, density, rnd) {
    rnd = rnd || Math.random;
    for (let y = 0; y < g.length; y++) {
      for (let x = 0; x < g[y].length; x++) g[y][x] = rnd() < density ? 1 : 0;
    }
  }

  /** Motifs classiques (ancrés en haut-gauche relatif). */
  const PRESETS = {
    planeur: [[0, 1, 0], [0, 0, 1], [1, 1, 1]],
    vaisseau: [
      [0, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [0, 0, 0, 0, 1],
      [1, 0, 0, 1, 0]
    ],
    pulsar: (function () {
      const cells = [
        [2,4],[2,5],[2,6],[2,10],[2,11],[2,12],
        [4,2],[5,2],[6,2],[10,2],[11,2],[12,2],
        [4,7],[5,7],[6,7],[10,7],[11,7],[12,7],
        [4,9],[5,9],[6,9],[10,9],[11,9],[12,9],
        [4,14],[5,14],[6,14],[10,14],[11,14],[12,14],
        [7,4],[7,5],[7,6],[7,10],[7,11],[7,12],
        [9,4],[9,5],[9,6],[9,10],[9,11],[9,12],
        [14,4],[14,5],[14,6],[14,10],[14,11],[14,12]
      ];
      const g = createGrid(17, 17);
      for (const [x, y] of cells) g[y][x] = 1;
      return g;
    })(),
    gosper: (function () {
      const coords = [
        [24,0],[22,1],[24,1],[12,2],[13,2],[20,2],[21,2],[34,2],[35,2],
        [11,3],[15,3],[20,3],[21,3],[34,3],[35,3],
        [0,4],[1,4],[10,4],[16,4],[20,4],[21,4],
        [0,5],[1,5],[10,5],[14,5],[16,5],[17,5],[22,5],[24,5],
        [10,6],[16,6],[24,6],[11,7],[15,7],[12,8],[13,8]
      ];
      const g = createGrid(36, 9);
      for (const [x, y] of coords) g[y][x] = 1;
      return g;
    })(),
    // Acorn (gland) — methuselah classique
    gland: [[0,1,0,0,0,0,0],[0,0,0,1,0,0,0],[1,1,0,0,1,1,1]]
  };

  function stampPreset(g, name, ox, oy) {
    const p = PRESETS[name];
    if (!p) return;
    const h = p.length, w = p[0].length;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!p[y][x]) continue;
        const tx = ox + x, ty = oy + y;
        if (ty >= 0 && ty < g.length && tx >= 0 && tx < g[0].length) g[ty][tx] = p[y][x] > 0 ? 1 : 0;
      }
    }
  }

  /** Vogel / phyllotaxis : n graines. */
  function phyllotaxisPoints(n, c) {
    c = c == null ? 1 : c;
    const pts = new Array(n);
    for (let i = 0; i < n; i++) {
      const r = c * Math.sqrt(i);
      const a = i * GOLDEN_ANGLE;
      pts[i] = { x: r * Math.cos(a), y: r * Math.sin(a), i };
    }
    return pts;
  }

  /** k plus proches voisins pour chaque graine (listes symétrisées). */
  function buildNeighbourLists(pts, k) {
    k = k || 6;
    const n = pts.length;
    const lists = Array.from({ length: n }, () => []);
    // Pour petits n (< ~2000) O(n²) suffit.
    for (let i = 0; i < n; i++) {
      const dists = [];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        dists.push({ j, d: dx * dx + dy * dy });
      }
      dists.sort((a, b) => a.d - b.d);
      for (let t = 0; t < Math.min(k, dists.length); t++) lists[i].push(dists[t].j);
    }
    // Symétriser : si A voit B, B voit A
    const set = lists.map((L) => new Set(L));
    for (let i = 0; i < n; i++) {
      for (const j of set[i]) set[j].add(i);
    }
    return set.map((s) => Array.from(s));
  }

  function stepGraph(alive, ages, neighbours) {
    const n = alive.length;
    const nextAlive = new Uint8Array(n);
    const nextAges = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      let count = 0;
      const neigh = neighbours[i];
      for (let t = 0; t < neigh.length; t++) if (alive[neigh[t]]) count++;
      if (alive[i]) {
        if (count === 2 || count === 3) {
          nextAlive[i] = 1;
          nextAges[i] = Math.min(32767, ages[i] + 1);
        }
      } else if (count === 3) {
        nextAlive[i] = 1;
        nextAges[i] = 1;
      }
    }
    return { alive: nextAlive, ages: nextAges };
  }

  /** Compte approximatif de parastiches (Fibonacci) pour un tournesol. */
  function fibonacciUpTo(max) {
    const f = [1, 1];
    while (true) {
      const n = f[f.length - 1] + f[f.length - 2];
      if (n > max) break;
      f.push(n);
    }
    return f;
  }

  function estimateParastichies(nSeeds) {
    const fibs = fibonacciUpTo(nSeeds);
    // Paires Fibonacci typiques sous nSeeds
    const pairs = [];
    for (let i = 2; i < fibs.length - 1; i++) {
      if (fibs[i] + fibs[i + 1] <= nSeeds * 1.2) pairs.push([fibs[i], fibs[i + 1]]);
    }
    // Meilleure paire visible autour de sqrt(n)
    const target = Math.sqrt(nSeeds);
    let best = pairs[0] || [8, 13];
    let bestScore = Infinity;
    for (const p of pairs) {
      const score = Math.abs(p[0] + p[1] - target * 2);
      if (score < bestScore) { bestScore = score; best = p; }
    }
    return { fibs, pair: best };
  }

  /** Ligne n du triangle de Pascal, coefficients mod m (m=2 → Sierpiński). */
  function pascalRow(n, mod) {
    mod = mod || 2;
    const row = new Array(n + 1);
    row[0] = 1;
    for (let k = 1; k <= n; k++) {
      // C(n,k) = C(n,k-1) * (n-k+1) / k  — en entier mod m via big-safe iterative
      // Utilise récurrence additive : build from previous row would be safer for mod.
      row[k] = 0; // rempli ci-dessous
    }
    // Construction additive
    const out = [1];
    for (let i = 0; i < n; i++) {
      const next = [1];
      for (let j = 1; j < out.length; j++) next.push((out[j - 1] + out[j]) % mod);
      next.push(1 % mod);
      out.length = 0;
      Array.prototype.push.apply(out, next);
    }
    return out;
  }

  /** Remplit une grille avec les n premières lignes de Pascal mod m (centré). */
  function stampPascal(g, rows, mod, ox, oy) {
    mod = mod || 2;
    for (let r = 0; r < rows; r++) {
      const row = pascalRow(r, mod);
      const start = ox - Math.floor(row.length / 2);
      for (let i = 0; i < row.length; i++) {
        const x = start + i, y = oy + r;
        if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) continue;
        if (row[i] !== 0) g[y][x] = 1 + (row[i] % 7); // couleur via âge/mod
      }
    }
  }

  /** Une génération « Rule 90 » / Pascal : chaque cellule = XOR des deux voisines du dessus (mod 2). */
  function stepRule90(g) {
    const h = g.length, w = g[0].length;
    const next = createGrid(w, h);
    // Garde la dernière ligne générée et avance d'une ligne
    // Ici : pour chaque ligne y>0, next[y][x] = g[y-1][x-1] XOR g[y-1][x+1]
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (y === 0) { next[y][x] = g[y][x]; continue; }
        const L = x > 0 ? (g[y - 1][x - 1] > 0 ? 1 : 0) : 0;
        const R = x < w - 1 ? (g[y - 1][x + 1] > 0 ? 1 : 0) : 0;
        next[y][x] = (L ^ R) ? 1 : 0;
      }
    }
    return next;
  }

  /** Seed une seule cellule en haut au centre (départ Rule 90 / Pascal). */
  function seedRule90(g) {
    clearGrid(g);
    const mid = Math.floor(g[0].length / 2);
    g[0][mid] = 1;
  }


  // ——— Untangled (John Daniel 2026) ———
  // Deux sources +1 / −1 ; croisements = cellules 1..28 ; rangée n a n cellules.
  // Totaux = nombres triangulaires T_n = n(n+1)/2.

  function triangularNumber(n) {
    return (n * (n + 1)) / 2;
  }

  /** Cellules du tableau : n=1..T_rows, rangée 1-based, col 0-based. */
  function untangledCells(rows) {
    rows = rows || 7;
    const cells = [];
    let n = 1;
    for (let r = 1; r <= rows; r++) {
      for (let c = 0; c < r; c++) {
        cells.push({
          n: n,
          row: r,
          col: c,
          // géométrie relative : apex (0,0), rangée r à y=r-1, centrée
          x: c - (r - 1) / 2,
          y: r - 1
        });
        n++;
      }
    }
    return cells;
  }

  /** Sources +1 (haut-gauche) et −1 (haut-droite) du dessin. */
  function untangledSources(rows) {
    rows = rows || 7;
    const half = (rows - 1) / 2;
    return {
      plus1: { x: -half - 0.8, y: -1.2, label: '+1' },
      minus1: { x: half + 0.8, y: -1.2, label: '−1' }
    };
  }

  /**
   * Colonie Untangled.
   * Règle (v1.2) : croissance par rangées triangulaires.
   * - Départ : apex = cellule nº1 → population 1.
   * - Chaque pas ajoute toute la rangée suivante (n cellules au pas n) → pop T_n.
   * - À T_7=28 : colonie complète ; le prochain pas ensemence un nouvel apex
   *   (repart à 1) — « split » du tableau.
   * Conway B3/S23 reste le moteur hors mode Untangled ; en mode Untangled,
   * les naissances Conway sont remplacées par cette agenda, et la survie
   * Conway s'applique seulement aux cellules hors de la structure protégée.
   */
  function createUntangledColony(ox, oy, rows) {
    rows = rows || 7;
    const cells = untangledCells(rows);
    return {
      ox: ox || 0,
      oy: oy || 0,
      rows: rows,
      cells: cells,
      sources: untangledSources(rows),
      /** rangée atteinte (0 = vide, 1 = apex seul, … 7 = complet) */
      reached: 0,
      /** numéros vivants dans la structure */
      alive: new Set(),
      generation: 0
    };
  }

  function untangledPopulation(colony) {
    return colony.alive.size;
  }

  /** Un pas de croissance triangulaire. Retourne la population après le pas. */
  function stepUntangledGrowth(colony) {
    if (colony.reached >= colony.rows) {
      // Split : nouvel apex, on repart
      colony.alive = new Set();
      colony.reached = 0;
    }
    const nextRow = colony.reached + 1;
    for (const cell of colony.cells) {
      if (cell.row === nextRow) colony.alive.add(cell.n);
    }
    colony.reached = nextRow;
    colony.generation++;
    return colony.alive.size;
  }

  /** Populations attendues : 1,3,6,10,15,21,28 */
  function untangledPopulationSequence(rows) {
    rows = rows || 7;
    const seq = [];
    for (let r = 1; r <= rows; r++) seq.push(triangularNumber(r));
    return seq;
  }

  /** Tamponne la colonie (rangées 1..reached) sur une grille. */
  function stampUntangledColony(grid, colony, age) {
    age = age || 1;
    const scale = 2; // 1 unité géométrique = 2 cellules pour aérer
    for (const cell of colony.cells) {
      if (!colony.alive.has(cell.n)) continue;
      const gx = Math.round(colony.ox + cell.x * scale);
      const gy = Math.round(colony.oy + cell.y * scale);
      if (gy >= 0 && gy < grid.length && gx >= 0 && gx < grid[0].length) {
        grid[gy][gx] = age + (cell.n % 5);
      }
    }
  }

  /** Dessin exact du tableau (toutes les 28 cellules + métadonnées de rayons). */
  function createFullUntangledDrawing(ox, oy) {
    const colony = createUntangledColony(ox, oy, 7);
    for (let i = 0; i < 7; i++) stepUntangledGrowth(colony);
    return colony;
  }

  /** Applique Conway puis réimpose les naissances Untangled planifiées (hybride). */
  function stepGridWithUntangled(grid, wrap, colony) {
    // 1) Conway classique
    const next = stepGrid(grid, wrap);
    // 2) Protéger / forcer les cellules de la structure selon reached
    //    D'abord un pas de croissance triangulaire
    stepUntangledGrowth(colony);
    // Effacer puis restamper la structure (fidélité au tableau)
    // On n'efface pas toute la grille : on restampe par-dessus
    stampUntangledColony(next, colony, 1);
    return next;
  }


  const INFO = {
    grille: {
      title: 'Grille de Conway',
      body: 'Chaque cellule vivante survit avec 2 ou 3 voisines ; une morte naît avec exactement 3. C’est le Jeu de la vie classique (1970).'
    },
    tournesol: {
      title: 'Tournesol (phyllotaxie)',
      body: 'Les graines suivent l’angle d’or (~137,5°). Les bras en spirale (parastiches) tombent souvent sur des nombres de Fibonacci : 21/34, 34/55…'
    },
    triangle: {
      title: 'Triangle de Pascal',
      body: 'Chaque nombre est la somme des deux au-dessus. Modulo 2, on obtient le triangle de Sierpiński — aussi généré par la règle 90 d’automate cellulaire.'
    },
    planeur: { title: 'Planeur', body: 'Petit motif qui se décale en diagonale toutes les 4 générations. Découvert par Richard Guy.' },
    vaisseau: { title: 'Vaisseau léger', body: 'Spaceship léger (LWSS) : avance horizontalement en laissant une traînée périodique.' },
    pulsar: { title: 'Pulsar', body: 'Oscillateur de période 3, un des plus connus du Jeu de la vie.' },
    gosper: { title: 'Pistolet de Gosper', body: 'Premier canon à planeurs découvert (1970). Produit un planeur toutes les 30 générations.' },
    gland: { title: 'Gland (acorn)', body: 'Methuselah : 7 cellules qui évoluent pendant 5206 générations avant de se stabiliser.' },
    tore: { title: 'Tore', body: 'Les bords se rejoignent : haut↔bas et gauche↔droite, comme à la surface d’un beigne.' },
    fibo: { title: 'Fibonacci & Kepler', body: 'Kepler a noté que les graines de tournesol s’organisent en spirales Fibonacci grâce à l’angle d’or, un remplissage optimal de l’espace.' },
    untangled: { title: 'Untangled (croissance triangulaire)', body: 'Deux sources +1 et −1 envoient des rayons ; chaque croisement est une cellule. On grandit par rangées : 1, puis +2, +3… jusqu’à 28 (7ᵉ nombre triangulaire). Ensuite la colonie ensemence un nouvel apex.' }
  };

  const api = {
    GOLDEN_ANGLE,
    createGrid, cloneGrid, countAlive, neighbors8, stepGrid,
    clearGrid, randomizeGrid, PRESETS, stampPreset,
    phyllotaxisPoints, buildNeighbourLists, stepGraph,
    fibonacciUpTo, estimateParastichies,
    pascalRow, stampPascal, stepRule90, seedRule90,
    triangularNumber, untangledCells, untangledSources,
    createUntangledColony, untangledPopulation, stepUntangledGrowth,
    untangledPopulationSequence, stampUntangledColony,
    createFullUntangledDrawing, stepGridWithUntangled,
    INFO
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VitaLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
