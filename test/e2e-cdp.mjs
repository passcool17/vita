// Vita e2e — Chrome headless CDP.
// Usage : node test/e2e-cdp.mjs <url> [capture-dir]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
const url = process.argv[2], shots = process.argv[3] || '/tmp/vita-shots';
mkdirSync(shots, { recursive: true });
const prof = mkdtempSync('/tmp/chr-vita-');
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--remote-debugging-port=9345',
  '--user-data-dir=' + prof, '--autoplay-policy=no-user-gesture-required',
  '--disable-gpu', 'about:blank'
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const errors = [];
async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const l = await (await fetch('http://127.0.0.1:9345/json')).json();
      const t = l.find(x => x.type === 'page');
      if (t) return t.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('chrome injoignable');
}
const send = (method, params = {}) => new Promise((r) => {
  const i = ++id; pend.set(i, r);
  ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.text || 'eval error');
  return res.result?.result?.value;
};
async function setViewport(width, height, dpr = 1) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: dpr, mobile: true
  });
  await sleep(200);
  await ev('window.dispatchEvent(new Event("resize"))');
  await sleep(150);
}
async function drag(x1, y1, x2, y2, steps = 8) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 });
  for (let s = 1; s <= steps; s++) {
    const x = x1 + (x2 - x1) * (s / steps);
    const y = y1 + (y2 - y1) * (s / steps);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' });
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 });
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${shots}/${name}.png`, Buffer.from(r.result.data, 'base64'));
  console.log('shot', name);
}
async function assertNoHOverflow(label) {
  const m = await ev(`({
    iw: window.innerWidth,
    sw: document.documentElement.scrollWidth,
    bw: document.body.scrollWidth,
    aw: document.getElementById('app').scrollWidth,
    cw: document.getElementById('stage').clientWidth
  })`);
  console.log('overflow', label, m);
  if (m.sw > m.iw || m.bw > m.iw || m.aw > m.iw) {
    throw new Error(`débordement horizontal à ${label}: scrollWidth=${m.sw} > innerWidth=${m.iw}`);
  }
  if (m.cw > m.iw) throw new Error(`canvas trop large à ${label}: ${m.cw} > ${m.iw}`);
}
try {
  ws = new WebSocket(await connect());
  await new Promise(r => ws.onopen = r);
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') {
      errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    }
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') {
      const txt = (d.params.entry.text || '') + ' ' + (d.params.entry.url || '');
      if (/favicon\.ico/i.test(txt)) return;
      errors.push(txt);
    }
    if (d.method === 'Runtime.exceptionThrown') { /* already handled */ }
  };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await setViewport(390, 844, 1);
  await send('Page.navigate', { url });
  let loaded = false;
  for (let i = 0; i < 80; i++) {
    loaded = await ev('!!(window.Vita && window.VitaLogic)');
    if (loaded) break;
    await sleep(200);
  }
  await sleep(300);
  if (!loaded) {
    const href = await ev('location.href');
    const title = await ev('document.title');
    throw new Error('Vita non chargé @ ' + href + ' title=' + title);
  }
  // drop favicon noise collected during boot
  for (let i = errors.length - 1; i >= 0; i--) if (/favicon/i.test(errors[i])) errors.splice(i, 1);

  for (const w of [360, 390, 430]) {
    await setViewport(w, 844, 1);
    await assertNoHOverflow(w + 'px');
  }

  // Reachability: Aléatoire / Effacer / Tore in viewport
  const reach = await ev(`(() => {
    const ids = ['btnRandom','btnClear','tore'];
    const iw = window.innerWidth, ih = window.innerHeight;
    return ids.map(id => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      return { id, visible: r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= iw + 1 && r.top >= 0 && r.bottom <= ih + 1, left: r.left, right: r.right };
    });
  })()`);
  console.log('reach', JSON.stringify(reach));
  for (const r of reach) if (!r.visible) throw new Error(r.id + ' hors viewport / caché');

  await setViewport(390, 844, 1);
  const before = await ev('Vita.state.gen');
  await ev('Vita.state.playing = true; Vita.state.lastTick = 0; document.getElementById("btnPlay").textContent = "Pause"');
  await sleep(900);
  const after = await ev('Vita.state.gen');
  console.log('play gens', before, '→', after);
  if (!(after > before)) throw new Error('play n’avance pas');
  await ev('Vita.state.playing = false; document.getElementById("btnPlay").textContent = "Lecture"');

  const alive0 = await ev('Vita.getAlive()');
  await ev('Vita.state.tool = "pinceau"');
  await drag(80, 240, 200, 320, 10);
  await sleep(150);
  const alive1 = await ev('Vita.getAlive()');
  console.log('draw', alive0, '→', alive1);
  if (!(alive1 > alive0)) throw new Error('dessin n’ajoute pas de cellules');

  await ev('document.querySelector("#modes [data-mode=tournesol]").click()');
  await sleep(400);
  if ((await ev('Vita.state.mode')) !== 'tournesol') throw new Error('mode tournesol');
  await assertNoHOverflow('tournesol-390');
  await shot('fix-tournesol');

  await ev('document.querySelector("#modes [data-mode=triangle]").click()');
  await sleep(300);
  await ev('document.querySelector("#modes [data-mode=grille]").click()');
  await sleep(200);
  await ev('document.querySelector("#presets [data-preset=pascal]").click()');
  await sleep(200);
  if ((await ev('Vita.getAlive()')) < 10) throw new Error('preset Pascal vide');

  console.log('erreurs JS:', errors.length ? errors : 'aucune');
  if (errors.length) process.exitCode = 1;
  else console.log('E2E OK');
} catch (e) {
  console.error('ÉCHEC', e.message, errors);
  process.exitCode = 1;
} finally {
  try { chrome.kill(); } catch {}
}
