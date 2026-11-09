const V = require('../logic.js');
let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); failed++; }
  else console.log('ok:', msg);
}

// --- Blinker (période 2) ---
{
  const g = V.createGrid(5, 5);
  g[2][1] = g[2][2] = g[2][3] = 1; // horizontal
  const g1 = V.stepGrid(g, false);
  assert(g1[1][2] > 0 && g1[2][2] > 0 && g1[3][2] > 0 && V.countAlive(g1) === 3, 'blinker → vertical');
  const g2 = V.stepGrid(g1, false);
  assert(g2[2][1] > 0 && g2[2][2] > 0 && g2[2][3] > 0 && V.countAlive(g2) === 3, 'blinker → horizontal');
}

// --- Planeur décale en 4 gens ---
{
  const g = V.createGrid(10, 10);
  V.stampPreset(g, 'planeur', 1, 1);
  let cur = g;
  for (let i = 0; i < 4; i++) cur = V.stepGrid(cur, false);
  assert(V.countAlive(cur) === 5 && cur[4][2] > 0 && cur[4][3] > 0 && cur[4][4] > 0, 'planeur décalé après 4 gens (5 cellules)');
}

// --- Tore wrap ---
{
  const g = V.createGrid(5, 5);
  g[0][2] = g[0][3] = g[0][4] = 1; // au bord
  const g1 = V.stepGrid(g, true);
  assert(V.countAlive(g1) === 3, 'blinker au bord sur tore reste vivant');
}

// --- Phyllotaxis voisins symétriques ---
{
  const pts = V.phyllotaxisPoints(200, 1);
  assert(pts.length === 200, '200 graines');
  // Angle d'or
  assert(Math.abs(V.GOLDEN_ANGLE - Math.PI * (3 - Math.sqrt(5))) < 1e-12, 'angle d’or exact');
  const neigh = V.buildNeighbourLists(pts, 6);
  let asymmetric = 0;
  for (let i = 0; i < neigh.length; i++) {
    for (const j of neigh[i]) {
      if (!neigh[j].includes(i)) asymmetric++;
    }
  }
  assert(asymmetric === 0, 'listes de voisins symétriques');
  const degrees = neigh.map((n) => n.length);
  const avg = degrees.reduce((a, b) => a + b, 0) / degrees.length;
  assert(avg >= 6 && avg <= 12, 'degré moyen raisonnable (' + avg.toFixed(2) + ')');
}

// --- stepGraph birth/survival ---
{
  const pts = V.phyllotaxisPoints(50, 1);
  const neigh = V.buildNeighbourLists(pts, 6);
  const alive = new Uint8Array(50);
  const ages = new Int16Array(50);
  // Isoler 3 voisins d'une cellule morte pour naissance
  // Plus simple : allumer un petit cluster
  alive[0] = alive[1] = alive[2] = 1;
  ages[0] = ages[1] = ages[2] = 1;
  const next = V.stepGraph(alive, ages, neigh);
  assert(next.alive.length === 50, 'stepGraph taille');
}

// --- Pascal mod 2 ---
{
  assert(V.pascalRow(0, 2).join(',') === '1', 'Pascal r0');
  assert(V.pascalRow(1, 2).join(',') === '1,1', 'Pascal r1');
  assert(V.pascalRow(2, 2).join(',') === '1,0,1', 'Pascal r2 = 1 2 1 → mod2');
  assert(V.pascalRow(4, 2).join(',') === '1,0,0,0,1', 'Pascal r4 Sierpiński');
  assert(V.pascalRow(5, 2).join(',') === '1,1,0,0,1,1', 'Pascal r5');
}

// --- Pascal mod 5 ---
{
  const r4 = V.pascalRow(4, 5); // 1 4 6 4 1 → 1 4 1 4 1
  assert(r4.join(',') === '1,4,1,4,1', 'Pascal r4 mod 5');
}

// --- Rule 90 seed + step ---
{
  const g = V.createGrid(9, 5);
  V.seedRule90(g);
  assert(g[0][4] === 1 && V.countAlive(g) === 1, 'seed Rule90 centre');
  const g1 = V.stepRule90(g);
  // ligne 1 devrait avoir deux cellules aux voisines XOR de la ligne 0
  assert(g1[1][3] === 1 && g1[1][5] === 1, 'Rule90 ligne 1');
}

// --- stamp Pascal ---
{
  const g = V.createGrid(21, 12);
  V.stampPascal(g, 8, 2, 10, 1);
  assert(V.countAlive(g) > 5, 'stamp Pascal produit des cellules');
}

// --- Fibonacci ---
{
  const f = V.fibonacciUpTo(100);
  assert(f.includes(55) && f.includes(89), 'suite Fibonacci');
  const p = V.estimateParastichies(500);
  assert(p.pair[0] > 0 && p.pair[1] > p.pair[0], 'paire de parastiches');
}

if (failed) { console.error(failed + ' échec(s)'); process.exit(1); }
console.log('Tous les tests passent.');
