// eval.js — accuracy test on past downloads (the CV number).
import { nameFile, createModelRunner, basename, hostOf, AI_TIMEOUT_MS } from './namer.js';

const $ = (id) => document.getElementById(id);
const runner = createModelRunner();
let results = []; // { id, site, original, name, via, verdict: true|false|null }
let lastMarked = [];

// ---------- Model setup ----------
async function refreshStatus() {
  const s = await runner.status();
  $('modelStatus').textContent = s;
  $('setup').disabled = s === 'available' || s === 'unavailable' || s === 'unsupported';
  if (s !== 'available') $('useAi').checked = false;
  return s;
}

$('setup').addEventListener('click', async () => {
  // This click counts as the user gesture Chrome needs before it downloads the model.
  $('setup').disabled = true;
  try {
    await runner.warmUp((p) => { $('modelStatus').textContent = `downloading… ${Math.round((p || 0) * 100)}%`; });
    $('useAi').checked = true;
    await refreshStatus();
  } catch (e) {
    $('modelStatus').textContent = 'could not start: ' + e.message;
    $('setup').disabled = false;
  }
});

// ---------- Speed test ----------
$('speed').addEventListener('click', async () => {
  $('speed').disabled = true;
  const out = $('speedOut');
  try {
    out.textContent = 'Loading model…';
    let t = performance.now();
    await runner.warmUp();
    const load = Math.round(performance.now() - t);
    const times = [];
    for (let i = 0; i < 3; i++) {
      out.textContent = `Model loaded in ${load} ms. Prompt ${i + 1}/3…`;
      t = performance.now();
      await runner.prompt('Website: www.amazon.in (use source "Amazon")\nPage title: Your Orders\nClicked link/button text: Invoice\nOriginal filename: invoice_83920.pdf');
      times.push(Math.round(performance.now() - t));
    }
    out.textContent = `Model load ${load} ms · prompts ${times.join(' / ')} ms (limit ${AI_TIMEOUT_MS} ms)`;
  } catch (e) {
    out.textContent = 'Model error: ' + e.message;
  }
  $('speed').disabled = false;
});

// ---------- Run ----------
$('run').addEventListener('click', async () => {
  $('run').disabled = true;
  $('export').disabled = true;
  const n = Number($('count').value);
  if ($('mode').value === 'live') {
    const { history = [] } = await chrome.storage.local.get('history');
    results = history.slice(0, n).map(h => ({ id: h.id, site: h.site, original: h.original, name: h.name, via: h.via, reason: h.reason || '', verdict: null }));
    $('progress').textContent = `Loaded ${results.length} live renames` + (results.length < n ? ` — download more files to reach ${n}` : '');
    await save(); render();
    $('run').disabled = false;
    return;
  }
  const useAi = $('useAi').checked && (await runner.status()) === 'available';

  const { history = [] } = await chrome.storage.local.get('history');
  const renamedByUs = new Set(history.map(h => h.id));
  const all = await chrome.downloads.search({ orderBy: ['-startTime'], limit: 2000 });
  const items = all.filter(d => d.state === 'complete' && d.filename &&
    !renamedByUs.has(d.id) && d.byExtensionId !== chrome.runtime.id).slice(0, n);

  results = [];
  render();
  if (useAi) {
    $('progress').textContent = 'Loading Gemini Nano…';
    try { await runner.warmUp(); } catch (e) { $('progress').textContent = 'Model failed to load: ' + e.message; }
  }
  let pending = Promise.resolve();
  const ask = (text) => { const p = runner.prompt(text); pending = p.catch(() => {}); return p; };

  for (let i = 0; i < items.length; i++) {
    const d = items[i];
    const ctx = {
      url: d.url, finalUrl: d.finalUrl, referrer: d.referrer, mime: d.mime,
      filename: basename(d.filename), now: new Date(d.startTime).getTime(),
    };
    const r = await nameFile(ctx, useAi ? ask : null, AI_TIMEOUT_MS);
    results.push({ id: d.id, site: hostOf(d.referrer || d.finalUrl || d.url), original: ctx.filename, name: r.filename, via: r.via, reason: r.reason || '', verdict: null });
    // Don't let timed-out prompts pile up and slow the next file unfairly.
    await Promise.race([pending, new Promise(res => setTimeout(res, 15000))]);
    $('progress').textContent = `Named ${i + 1} / ${items.length}${useAi ? ' (Gemini Nano + fallback)' : ' (fallback only)'}`;
    if (i % 5 === 4 || i === items.length - 1) render();
  }
  if (items.length < n) $('progress').textContent += ` — only ${items.length} past downloads found`;
  await save();
  render();
  $('run').disabled = false;
});

// ---------- Rating ----------
function mark(i, verdict) {
  if (!results[i]) return;
  results[i].verdict = verdict;
  lastMarked.push(i);
  save();
  render();
}

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'u' && lastMarked.length) { const i = lastMarked.pop(); results[i].verdict = null; save(); render(); return; }
  if (k !== 'y' && k !== 'n') return;
  const i = results.findIndex(r => r.verdict === null);
  if (i >= 0) { mark(i, k === 'y'); lastMarked.pop(); lastMarked.push(i); }
});

// ---------- Render ----------
function pct(a, b) { return b ? Math.round((a / b) * 1000) / 10 + '%' : '–'; }

function render() {
  const rated = results.filter(r => r.verdict !== null);
  const correct = rated.filter(r => r.verdict).length;
  const ai = rated.filter(r => r.via === 'ai');
  const fb = rated.filter(r => r.via !== 'ai');
  const aiCount = results.filter(r => r.via === 'ai').length;
  $('stats').innerHTML = `
    <div class="stat"><b>${pct(correct, rated.length)}</b><span>Accuracy (${correct} / ${rated.length} rated)</span></div>
    <div class="stat"><b>${rated.length} / ${results.length}</b><span>Rated so far</span></div>
    <div class="stat"><b>${pct(ai.filter(r => r.verdict).length, ai.length)}</b><span>AI names (${aiCount} total)</span></div>
    <div class="stat"><b>${pct(fb.filter(r => r.verdict).length, fb.length)}</b><span>Fallback names (${results.length - aiCount} total)</span></div>`;

  const tbody = $('rows');
  tbody.innerHTML = '';
  const firstOpen = results.findIndex(r => r.verdict === null);
  results.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === firstOpen) tr.className = 'current';
    const cells = [String(i + 1), r.original, r.name];
    cells.forEach((t, j) => { const td = document.createElement('td'); td.textContent = t; if (j === 1) td.className = 'orig'; if (j === 2) td.className = 'name'; tr.appendChild(td); });
    const via = document.createElement('td');
    via.innerHTML = `<span class="via ${r.via}">${r.via === 'ai' ? 'AI' : r.via}</span>`;
    if (r.reason) { const why = document.createElement('div'); why.className = 'muted'; why.style.fontSize = '11px'; why.textContent = r.reason; via.appendChild(why); }
    tr.appendChild(via);
    const v = document.createElement('td');
    const yes = document.createElement('button'); yes.className = 'vbtn good' + (r.verdict === true ? ' on' : ''); yes.textContent = '✅';
    const no = document.createElement('button'); no.className = 'vbtn bad' + (r.verdict === false ? ' on' : ''); no.textContent = '❌';
    yes.onclick = () => mark(i, true);
    no.onclick = () => mark(i, false);
    v.append(yes, no);
    tr.appendChild(v);
    tbody.appendChild(tr);
  });
  $('export').disabled = results.length === 0;
}

// ---------- Save / load / export ----------
async function save() { await chrome.storage.local.set({ evalResults: results }); }

$('export').addEventListener('click', async () => {
  const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const head = ['row', 'download_id', 'site', 'original_name', 'new_name', 'named_by', 'fallback_reason', 'verdict'];
  const lines = results.map((r, i) => [i + 1, r.id, r.site, r.original, r.name, r.via, r.reason || '',
    r.verdict === null ? 'unrated' : (r.verdict ? 'correct' : 'incorrect')].map(esc).join(','));
  const rated = results.filter(r => r.verdict !== null);
  const correct = rated.filter(r => r.verdict).length;
  lines.push('', esc(`Accuracy: ${correct}/${rated.length} = ${pct(correct, rated.length)}`));
  const blob = new Blob([head.join(',') + '\n' + lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  await chrome.downloads.download({ url, filename: `smart-namer-eval-${d.toISOString().slice(0, 10)}.csv` });
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

(async () => {
  await refreshStatus();
  const { evalResults = [] } = await chrome.storage.local.get('evalResults');
  results = evalResults;
  render();
})();
