/* Vita — rendu canvas + interactions tactiles */
(function () {
  'use strict';
  const V = window.VitaLogic;
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const wrap = document.getElementById('stage-wrap');
  const elGen = document.getElementById('gen');
  const elCells = document.getElementById('cells');
  const elPara = document.getElementById('para');
  const elParaStat = document.getElementById('paraStat');
  const infoEl = document.getElementById('info');
  const infoTitle = infoEl.querySelector('strong');
  const infoBody = infoEl.querySelector('span');

  const GW = 64, GH = 64;
  const SUN_N = 610; // ~ Fibonacci-friendly seed count
  const SUN_K = 6;

  const state = {
    mode: 'grille', // grille | tournesol | triangle
    tool: 'pinceau',
    playing: false,
    wrap: false,
    gen: 0,
    zoom: 12,
    speed: 8, // gens / sec approx
    grid: V.createGrid(GW, GH),
    // camera (grille)
    camX: 0, camY: 0,
    // tournesol
    sunPts: null,
    sunNeigh: null,
    sunAlive: null,
    sunAges: null,
    sunScale: 1,
    sunOffX: 0,
    sunOffY: 0,
    // triangle / rule90 uses grid too
    triangleMod: 2,
    lastTick: 0,
    infoTimer: 0
  };

  function initSun() {
    state.sunPts = V.phyllotaxisPoints(SUN_N, 1);
    state.sunNeigh = V.buildNeighbourLists(state.sunPts, SUN_K);
    state.sunAlive = new Uint8Array(SUN_N);
    state.sunAges = new Int16Array(SUN_N);
    // seed a glowing core + spiral flecks
    for (let i = 0; i < 120; i++) {
      if (i < 30 || i % 4 !== 0) {
        state.sunAlive[i] = 1;
        state.sunAges[i] = 1 + (i % 7);
      }
    }
    for (let i = 120; i < 280; i += 5) {
      state.sunAlive[i] = 1;
      state.sunAges[i] = 1;
    }
    const p = V.estimateParastichies(SUN_N);
    elPara.textContent = p.pair[0] + '/' + p.pair[1];
  }

  function resize() {
    const r = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    // Give stage flexible height: fill remaining
    wrap.style.height = Math.max(240, window.innerHeight - 300) + 'px';
    const r2 = wrap.getBoundingClientRect();
    canvas.width = Math.floor(r2.width * dpr);
    canvas.height = Math.floor(r2.height * dpr);
    canvas.style.width = r2.width + 'px';
    canvas.style.height = r2.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Fit sunflower
    const pad = 18;
    const maxR = Math.sqrt(SUN_N);
    state.sunScale = Math.min(r2.width, r2.height) * 0.46 / Math.max(1, maxR);
    state.sunOffX = r2.width / 2;
    state.sunOffY = r2.height / 2 + 4;
  }

  function showInfo(key) {
    const info = V.INFO[key];
    if (!info) return;
    infoTitle.textContent = info.title;
    infoBody.textContent = info.body;
    infoEl.classList.add('show');
    clearTimeout(state.infoTimer);
    state.infoTimer = setTimeout(() => infoEl.classList.remove('show'), 4200);
  }

  function ageColor(age, alive) {
    if (!alive) return null;
    // Palette Fibonacci / tournesol : or → ambre → braise selon l'âge
    const t = Math.min(1, Math.log2(1 + age) / 6);
    const r = Math.round(230 - t * 40);
    const g = Math.round(184 - t * 110);
    const b = Math.round(77 - t * 40);
    return `rgb(${r},${Math.max(40, g)},${Math.max(20, b)})`;
  }

  function glowColor(age) {
    const t = Math.min(1, age / 20);
    return `rgba(240, 215, 140, ${0.15 + t * 0.35})`;
  }

  function drawGrid() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const z = state.zoom;
    ctx.fillStyle = '#0c0a08';
    ctx.fillRect(0, 0, w, h);

    // paper-dot texture
    ctx.fillStyle = 'rgba(232,220,200,0.035)';
    for (let i = 0; i < 80; i++) {
      const x = (i * 97 + state.gen * 3) % w;
      const y = (i * 53 + 17) % h;
      ctx.fillRect(x, y, 1, 1);
    }

    const cols = Math.ceil(w / z) + 2;
    const rows = Math.ceil(h / z) + 2;
    const ox = Math.floor(state.camX);
    const oy = Math.floor(state.camY);
    const fx = -(state.camX - ox) * z;
    const fy = -(state.camY - oy) * z;

    // faint grid
    if (z >= 8) {
      ctx.strokeStyle = 'rgba(232,220,200,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= cols; x++) {
        const px = fx + x * z;
        ctx.moveTo(px + 0.5, 0); ctx.lineTo(px + 0.5, h);
      }
      for (let y = 0; y <= rows; y++) {
        const py = fy + y * z;
        ctx.moveTo(0, py + 0.5); ctx.lineTo(w, py + 0.5);
      }
      ctx.stroke();
    }

    for (let y = 0; y < rows; y++) {
      const gy = oy + y;
      if (gy < 0 || gy >= GH) continue;
      for (let x = 0; x < cols; x++) {
        const gx = ox + x;
        if (gx < 0 || gx >= GW) continue;
        const age = state.grid[gy][gx];
        if (!age) continue;
        const px = fx + x * z;
        const py = fy + y * z;
        const pad = Math.max(0.5, z * 0.12);
        // glow
        if (z >= 10) {
          ctx.fillStyle = glowColor(age);
          ctx.beginPath();
          ctx.arc(px + z / 2, py + z / 2, z * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = ageColor(age, true);
        const rr = Math.min(4, z * 0.22);
        roundRect(ctx, px + pad, py + pad, z - pad * 2, z - pad * 2, rr);
        ctx.fill();
      }
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawSun() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = '#0c0a08';
    ctx.fillRect(0, 0, w, h);

    // ink rings
    ctx.strokeStyle = 'rgba(232,220,200,0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 6; i++) {
      ctx.beginPath();
      ctx.arc(state.sunOffX, state.sunOffY, i * state.sunScale * Math.sqrt(SUN_N) / 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // faint neighbour segments for living cells
    ctx.strokeStyle = 'rgba(230,184,77,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < SUN_N; i++) {
      if (!state.sunAlive[i]) continue;
      const a = state.sunPts[i];
      const ax = state.sunOffX + a.x * state.sunScale;
      const ay = state.sunOffY + a.y * state.sunScale;
      const neigh = state.sunNeigh[i];
      for (let t = 0; t < neigh.length; t++) {
        const j = neigh[t];
        if (j < i || !state.sunAlive[j]) continue;
        const b = state.sunPts[j];
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(state.sunOffX + b.x * state.sunScale, state.sunOffY + b.y * state.sunScale);
        ctx.stroke();
      }
    }

    const baseR = Math.max(1.6, state.sunScale * 0.55);
    for (let i = 0; i < SUN_N; i++) {
      const p = state.sunPts[i];
      const x = state.sunOffX + p.x * state.sunScale;
      const y = state.sunOffY + p.y * state.sunScale;
      if (state.sunAlive[i]) {
        const age = state.sunAges[i];
        ctx.fillStyle = glowColor(age);
        ctx.beginPath();
        ctx.arc(x, y, baseR * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ageColor(age, true);
        ctx.beginPath();
        ctx.arc(x, y, baseR * (1 + Math.min(0.6, age / 30)), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(232,220,200,0.12)';
        ctx.beginPath();
        ctx.arc(x, y, baseR * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // center ink disc
    ctx.fillStyle = 'rgba(12,10,8,0.55)';
    ctx.beginPath();
    ctx.arc(state.sunOffX, state.sunOffY, baseR * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    if (state.mode === 'tournesol') drawSun();
    else drawGrid();
    updateStats();
  }

  function updateStats() {
    elGen.textContent = String(state.gen);
    if (state.mode === 'tournesol') {
      let n = 0;
      for (let i = 0; i < SUN_N; i++) if (state.sunAlive[i]) n++;
      elCells.textContent = String(n);
      elParaStat.style.display = '';
    } else {
      elCells.textContent = String(V.countAlive(state.grid));
      elParaStat.style.display = 'none';
    }
  }

  function stepOnce() {
    if (state.mode === 'tournesol') {
      const next = V.stepGraph(state.sunAlive, state.sunAges, state.sunNeigh);
      state.sunAlive = next.alive;
      state.sunAges = next.ages;
    } else if (state.mode === 'triangle') {
      state.grid = V.stepRule90(state.grid);
    } else {
      state.grid = V.stepGrid(state.grid, state.wrap);
    }
    state.gen++;
  }

  function tick(ts) {
    if (state.playing) {
      const interval = 1000 / Math.max(1, state.speed);
      if (ts - state.lastTick >= interval) {
        stepOnce();
        state.lastTick = ts;
      }
    }
    draw();
    requestAnimationFrame(tick);
  }

  // --- pointer / touch ---
  let drawing = false;
  let lastGx = -1, lastGy = -1;
  let lastSun = -1;
  let panLast = null;
  let paintValue = 1;

  function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] || e.changedTouches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  function gridAt(pos) {
    const z = state.zoom;
    const gx = Math.floor(state.camX + pos.x / z);
    const gy = Math.floor(state.camY + pos.y / z);
    return { gx, gy };
  }

  function sunAt(pos) {
    let best = -1, bestD = Infinity;
    const hitR = Math.max(10, state.sunScale * 1.1);
    for (let i = 0; i < SUN_N; i++) {
      const p = state.sunPts[i];
      const x = state.sunOffX + p.x * state.sunScale;
      const y = state.sunOffY + p.y * state.sunScale;
      const dx = pos.x - x, dy = pos.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    return bestD <= hitR * hitR ? best : -1;
  }

  function paintGrid(gx, gy, val) {
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return;
    if (val) state.grid[gy][gx] = state.grid[gy][gx] || 1;
    else state.grid[gy][gx] = 0;
  }

  function onDown(e) {
    e.preventDefault();
    const pos = canvasPos(e);
    drawing = true;
    if (state.tool === 'deplacer') {
      panLast = pos;
      return;
    }
    paintValue = state.tool === 'gomme' ? 0 : 1;
    if (state.mode === 'tournesol') {
      const i = sunAt(pos);
      lastSun = i;
      if (i >= 0) {
        state.sunAlive[i] = paintValue ? 1 : 0;
        state.sunAges[i] = paintValue ? 1 : 0;
      }
    } else {
      const { gx, gy } = gridAt(pos);
      lastGx = gx; lastGy = gy;
      paintGrid(gx, gy, paintValue);
    }
  }

  function onMove(e) {
    if (!drawing) return;
    e.preventDefault();
    const pos = canvasPos(e);
    if (state.tool === 'deplacer') {
      if (!panLast) { panLast = pos; return; }
      const dx = pos.x - panLast.x;
      const dy = pos.y - panLast.y;
      if (state.mode === 'tournesol') {
        state.sunOffX += dx;
        state.sunOffY += dy;
      } else {
        state.camX -= dx / state.zoom;
        state.camY -= dy / state.zoom;
      }
      panLast = pos;
      return;
    }
    if (state.mode === 'tournesol') {
      const i = sunAt(pos);
      if (i >= 0 && i !== lastSun) {
        state.sunAlive[i] = paintValue ? 1 : 0;
        state.sunAges[i] = paintValue ? 1 : 0;
        lastSun = i;
      }
    } else {
      const { gx, gy } = gridAt(pos);
      if (gx !== lastGx || gy !== lastGy) {
        // Bresenham-ish line paint
        const steps = Math.max(Math.abs(gx - lastGx), Math.abs(gy - lastGy), 1);
        for (let s = 0; s <= steps; s++) {
          const x = Math.round(lastGx + (gx - lastGx) * (s / steps));
          const y = Math.round(lastGy + (gy - lastGy) * (s / steps));
          paintGrid(x, y, paintValue);
        }
        lastGx = gx; lastGy = gy;
      }
    }
  }

  function onUp(e) {
    if (e) e.preventDefault();
    drawing = false;
    panLast = null;
    lastGx = lastGy = -1;
    lastSun = -1;
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // pinch zoom (two fingers) — optional simple
  let pinch = null;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinch = { dist: Math.hypot(dx, dy), zoom: state.zoom, scale: state.sunScale };
      drawing = false;
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinch) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / pinch.dist;
      if (state.mode === 'tournesol') {
        state.sunScale = Math.max(0.5, Math.min(8, pinch.scale * ratio));
      } else {
        state.zoom = Math.max(4, Math.min(28, pinch.zoom * ratio));
        document.getElementById('zoom').value = String(Math.round(state.zoom));
      }
    }
  }, { passive: true });
  canvas.addEventListener('touchend', () => { pinch = null; });

  // --- UI wiring ---
  document.getElementById('modes').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]');
    if (!b) return;
    document.querySelectorAll('#modes button').forEach((x) => x.classList.toggle('active', x === b));
    setMode(b.dataset.mode);
  });

  document.getElementById('tools').addEventListener('click', (e) => {
    const t = e.target.closest('button[data-tool]');
    if (t) {
      document.querySelectorAll('#tools [data-tool]').forEach((x) => x.classList.toggle('active', x === t));
      state.tool = t.dataset.tool;
      return;
    }
  });

  document.getElementById('btnPlay').addEventListener('click', () => {
    state.playing = !state.playing;
    state.lastTick = performance.now();
    document.getElementById('btnPlay').textContent = state.playing ? 'Pause' : 'Lecture';
  });
  document.getElementById('btnStep').addEventListener('click', () => {
    state.playing = false;
    document.getElementById('btnPlay').textContent = 'Lecture';
    stepOnce();
  });
  document.getElementById('btnClear').addEventListener('click', () => {
    if (state.mode === 'tournesol') {
      state.sunAlive.fill(0); state.sunAges.fill(0);
    } else {
      V.clearGrid(state.grid);
    }
    state.gen = 0;
  });
  document.getElementById('btnRandom').addEventListener('click', () => {
    if (state.mode === 'tournesol') {
      for (let i = 0; i < SUN_N; i++) {
        const on = Math.random() < 0.28;
        state.sunAlive[i] = on ? 1 : 0;
        state.sunAges[i] = on ? 1 : 0;
      }
    } else if (state.mode === 'triangle') {
      V.seedRule90(state.grid);
      // random sparks on first row
      for (let x = 0; x < GW; x++) if (Math.random() < 0.04) state.grid[0][x] = 1;
    } else {
      V.randomizeGrid(state.grid, 0.28);
    }
    state.gen = 0;
  });

  document.getElementById('presets').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-preset]');
    if (!b) return;
    const name = b.dataset.preset;
    if (name === 'pascal' || name === 'pascal5') {
      setMode('grille');
      document.querySelectorAll('#modes button').forEach((x) => x.classList.toggle('active', x.dataset.mode === 'grille'));
      V.clearGrid(state.grid);
      V.stampPascal(state.grid, 32, name === 'pascal' ? 2 : 5, Math.floor(GW / 2), 2);
      state.gen = 0;
      state.camX = 0; state.camY = 0;
      showInfo('triangle');
      return;
    }
    setMode('grille');
    document.querySelectorAll('#modes button').forEach((x) => x.classList.toggle('active', x.dataset.mode === 'grille'));
    // stamp near center of view
    const ox = Math.floor(state.camX + canvas.clientWidth / state.zoom / 2) - 6;
    const oy = Math.floor(state.camY + canvas.clientHeight / state.zoom / 2) - 4;
    V.stampPreset(state.grid, name, Math.max(0, ox), Math.max(0, oy));
    showInfo(name === 'vaisseau' ? 'vaisseau' : name);
  });

  document.getElementById('zoom').addEventListener('input', (e) => {
    state.zoom = +e.target.value;
  });
  document.getElementById('speed').addEventListener('input', (e) => {
    state.speed = +e.target.value;
  });
  document.getElementById('tore').addEventListener('change', (e) => {
    state.wrap = e.target.checked;
    if (state.wrap) showInfo('tore');
  });

  function setMode(mode) {
    state.mode = mode;
    state.playing = false;
    document.getElementById('btnPlay').textContent = 'Lecture';
    state.gen = 0;
    if (mode === 'tournesol') {
      if (!state.sunPts) initSun();
      showInfo('tournesol');
    } else if (mode === 'triangle') {
      V.seedRule90(state.grid);
      state.camX = 0; state.camY = 0;
      state.zoom = Math.max(state.zoom, 8);
      document.getElementById('zoom').value = String(state.zoom);
      showInfo('triangle');
    } else {
      showInfo('grille');
    }
  }

  // Expose for e2e
  window.Vita = {
    state,
    stepOnce,
    setMode,
    draw,
    resize,
    paintGrid,
    getAlive: () => state.mode === 'tournesol'
      ? state.sunAlive.reduce((a, b) => a + b, 0)
      : V.countAlive(state.grid)
  };

  initSun();
  // nice opening: Gosper-ish small stamp + random
  V.randomizeGrid(state.grid, 0.22);
  window.addEventListener('resize', resize);
  resize();
  showInfo('grille');
  requestAnimationFrame(tick);
})();
