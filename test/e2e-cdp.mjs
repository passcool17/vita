// Vita e2e — Chrome headless CDP.
// Usage : node test/e2e-cdp.mjs <url> [capture-dir]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
const url = process.argv[2], shots = process.argv[3] || '/tmp/vita-shots';
mkdirSync(shots, { recursive: true });
const prof = mkdtempSync('/tmp/chr-vita-');
const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--remote-debugging-port=9347',
  '--user-data-dir=' + prof, '--disable-gpu', 'about:blank'
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = new Map(); const errors = [];
async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const l = await (await fetch('http://127.0.0.1:9347/json')).json();
      const t = l.find(x => x.type === 'page');
      if (t) return t.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('chrome injoignable');
}
const send = (method, params = {}) => new Promise((r) => {
  const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.text || 'eval error');
  return res.result?.result?.value;
};
async function setViewport(width, height, dpr = 1) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: true });
  await sleep(150);
  await ev('window.dispatchEvent(new Event("resize"))');
  await sleep(100);
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${shots}/${name}.png`, Buffer.from(r.result.data, 'base64'));
  console.log('shot', name);
}
async function assertNoHOverflow(label) {
  const m = await ev(`({ iw: innerWidth, sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, aw: document.getElementById('app').scrollWidth })`);
  console.log('overflow', label, m);
  if (m.sw > m.iw || m.bw > m.iw || m.aw > m.iw) throw new Error('overflow ' + label);
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
      if (!/favicon/i.test(txt)) errors.push(txt);
    }
  };
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await setViewport(390, 844, 1);
  await send('Page.navigate', { url });
  let loaded = false;
  for (let i = 0; i < 80; i++) {
    loaded = await ev('!!(window.Vita && window.VitaLogic && VitaLogic.stepUntangledGrowth)');
    if (loaded) break;
    await sleep(200);
  }
  if (!loaded) throw new Error('Vita non chargé');
  for (let i = errors.length - 1; i >= 0; i--) if (/favicon/i.test(errors[i])) errors.splice(i, 1);

  for (const w of [360, 390, 430]) {
    await setViewport(w, 844, 1);
    await assertNoHOverflow(w + 'px');
  }
  await setViewport(390, 844, 1);

  // Untangled growth populations via API
  const seq = await ev(`(() => {
    const c = VitaLogic.createUntangledColony(0,0,7);
    const got = [];
    for (let i = 0; i < 7; i++) got.push(VitaLogic.stepUntangledGrowth(c));
    return got.join(',');
  })()`);
  console.log('untangled seq', seq);
  if (seq !== '1,3,6,10,15,21,28') throw new Error('mauvaise suite ' + seq);

  // Preset Untangled + play a few steps
  await ev('document.querySelector("#presets [data-preset=untangled]").click()');
  await sleep(300);
  await ev('Vita.state.playing = true; Vita.state.lastTick = 0; document.getElementById("btnPlay").textContent = "Pause"');
  await sleep(1400);
  await ev('Vita.state.playing = false');
  const reached = await ev('Vita.state.colony && Vita.state.colony.reached');
  const pop = await ev('Vita.state.colony ? Vita.state.colony.alive.size : 0');
  console.log('colony reached', reached, 'pop', pop);
  if (!(reached >= 2 && pop >= 3)) throw new Error('croissance Untangled inactive');
  await shot('untangled');
  await shot('fix-tournesol'); // keep overflow shot path updated if tournesol later

  await ev('document.querySelector("#modes [data-mode=tournesol]").click()');
  await sleep(300);
  await ev('document.querySelector("#presets [data-preset=untangled]").click()');
  await sleep(200);
  await ev('Vita.state.playing = true; Vita.state.lastTick = 0');
  await sleep(900);
  await ev('Vita.state.playing = false');
  await shot('untangled-tournesol');
  await assertNoHOverflow('untangled-390');

  // modes switch no errors
  await ev('document.querySelector("#modes [data-mode=triangle]").click()');
  await sleep(200);
  await ev('document.querySelector("#modes [data-mode=grille]").click()');
  await sleep(200);

  console.log('erreurs JS:', errors.length ? errors : 'aucune');
  if (errors.length) process.exitCode = 1;
  else console.log('E2E OK');
} catch (e) {
  console.error('ÉCHEC', e.message, errors);
  process.exitCode = 1;
} finally { try { chrome.kill(); } catch {} }
