// popup.js — on/off toggle, model status, last 20 renames.
const $ = (id) => document.getElementById(id);

async function init() {
  const { enabled = true, history = [] } = await chrome.storage.local.get(['enabled', 'history']);
  $('enabled').checked = enabled;
  $('enabledLabel').textContent = enabled ? 'On' : 'Off';
  $('enabled').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ enabled: e.target.checked });
    $('enabledLabel').textContent = e.target.checked ? 'On' : 'Off';
  });

  const list = $('list');
  const recent = history.slice(0, 20);
  if (!recent.length) {
    list.innerHTML = '<div class="empty">No renames yet. Download any file to try it.</div>';
  }
  for (const h of recent) {
    const li = document.createElement('li');
    const orig = document.createElement('div'); orig.className = 'orig'; orig.textContent = h.original + ' →';
    const nw = document.createElement('div'); nw.className = 'new'; nw.textContent = h.name;
    const via = document.createElement('span'); via.className = 'via ' + h.via;
    via.textContent = h.via === 'ai' ? 'AI' : h.via;
    if (h.reason) via.title = h.reason;
    nw.appendChild(via);
    li.append(orig, nw);
    list.appendChild(li);
  }

  $('openEval').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('eval.html') }));

  try {
    const r = await chrome.runtime.sendMessage({ type: 'model-status' });
    const s = r && r.status;
    const text = {
      available: '✅ Gemini Nano ready (on-device)',
      downloadable: '⬇️ Gemini Nano not downloaded yet: open the accuracy test and click “Set up Gemini Nano”',
      downloading: '⏳ Gemini Nano is downloading…',
      unavailable: '⚠️ Gemini Nano unavailable on this device: using rule-based naming',
      unsupported: '⚠️ Prompt API not supported in this Chrome: using rule-based naming',
    }[s] || `Model status: ${s}`;
    $('status').textContent = text;
  } catch (e) {
    $('status').textContent = 'Model status unknown: ' + e.message;
  }
}

init();
