// Vita e2e — Chrome headless CDP, viewport téléphone.
// Usage : node test/e2e-cdp.mjs <url> [capture-dir]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
const url = process.argv[2], shots = process.argv[3] || '/tmp/vita-shots';
mkdirSync(shots, { recursive: true });
const prof = mkdtempSync('/tmp/chr-vita-');
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--remote-debugging-port=9344',
  '--user-data-dir=' + prof, '--autoplay-policy=no-user-gesture-required',
  '--disable-gpu', 'about:blank'
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const errors = [];
async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const l = await (await fetch('http://127.0.0.1:9344/json')).json();
      const t = l.find(x => x.type === 'page');
      if (t) return t.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('chrome injoignable');
}
const send = (method, params = {}) => new Promise((r, j) => {
  const i = ++id; pend.set(i, { r, j });
  ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.text || 'eval error');
  return res.result?.result?.value;
};
async function tap(x, y) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  }
  await sleep(80);
}
async function drag(x1, y1, x2, y2, steps = 8) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 });
  for (let s = 1; s <= steps; s++) {
    const x = x1 + (x2 - x1) * (s / steps);
    const y = y1 + (y2 - y1) * (s / steps);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' });
    await sleep(16);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 });
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${shots}/${name}.png`, Buffer.from(r.result.data, 'base64'));
  console.log('shot', name);
}
try {
  ws = new WebSocket(await connect());
  await new Promise(r => ws.onopen = r);
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) {
      const { r } = pend.get(d.id); pend.delete(d.id); r(d);
    }
    if (d.method === 'Runtime.exceptionThrown') {
      errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    }
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') {
      errors.push(d.params.entry.text + ' ' + (d.params.entry.url || ''));
    }
  };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true
  });
  await send('Page.navigate', { url });
  for (let i = 0; i < 60 && !(await ev('!!(window.Vita && window.VitaLogic)')); i++) await sleep(200);
  await sleep(400);
  if (!(await ev('!!window.Vita'))) throw new Error('Vita non chargé');
  await shot('01-grille');

  const before = await ev('Vita.state.gen');
  await ev('Vita.state.playing = true; Vita.state.lastTick = 0; document.getElementById("btnPlay").textContent = "Pause"');
  await sleep(1200);
  const after = await ev('Vita.state.gen');
  console.log('générations pendant play:', before, '→', after);
  if (!(after > before)) throw new Error('play n’avance pas les générations');
  await shot('02-grille-play');
  await ev('Vita.state.playing = false; document.getElementById("btnPlay").textContent = "Lecture"');

  // Toucher pour dessiner
  const alive0 = await ev('Vita.getAlive()');
  await ev('Vita.state.tool = "pinceau"; document.querySelectorAll("#tools [data-tool]").forEach(x=>x.classList.toggle("active", x.dataset.tool==="pinceau"))');
  await drag(120, 280, 260, 360, 12);
  await sleep(200);
  const alive1 = await ev('Vita.getAlive()');
  console.log('cellules avant/après dessin:', alive0, alive1);
  if (!(alive1 > alive0)) throw new Error('le dessin n’ajoute pas de cellules');
  await shot('03-dessin');

  // Mode tournesol
  await ev('document.querySelector("#modes [data-mode=tournesol]").click()');
  await sleep(500);
  const mode1 = await ev('Vita.state.mode');
  if (mode1 !== 'tournesol') throw new Error('mode tournesol non actif');
  await shot('04-tournesol');
  const g0 = await ev('Vita.state.gen');
  await ev('Vita.state.playing = true; Vita.state.lastTick = 0');
  await sleep(1000);
  const g1 = await ev('Vita.state.gen');
  console.log('tournesol gens:', g0, '→', g1);
  if (!(g1 > g0)) throw new Error('tournesol ne tourne pas');
  await ev('Vita.state.playing = false');

  // Mode triangle
  await ev('document.querySelector("#modes [data-mode=triangle]").click()');
  await sleep(400);
  const mode2 = await ev('Vita.state.mode');
  if (mode2 !== 'triangle') throw new Error('mode triangle non actif');
  await ev('Vita.state.playing = true; Vita.state.lastTick = 0');
  await sleep(900);
  await shot('05-triangle');
  await ev('Vita.state.playing = false');

  // Preset Pascal
  await ev('document.querySelector("#modes [data-mode=grille]").click()');
  await sleep(200);
  await ev('document.querySelector("#presets [data-preset=pascal]").click()');
  await sleep(300);
  const pascalCells = await ev('Vita.getAlive()');
  console.log('cellules Pascal mod2:', pascalCells);
  if (!(pascalCells > 10)) throw new Error('preset Pascal vide');
  await shot('06-pascal');

  console.log('erreurs JS:', errors.length ? errors : 'aucune');
  if (errors.length) process.exitCode = 1;
  else console.log('E2E OK');
} catch (e) {
  console.error('ÉCHEC', e.message, errors);
  process.exitCode = 1;
} finally {
  try { chrome.kill(); } catch {}
}
