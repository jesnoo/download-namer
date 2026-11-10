// background.js — renames every download at the moment it starts.
import { nameFile, createModelRunner, basename, hostOf, AI_TIMEOUT_MS } from './namer.js';

const HARD_DEADLINE_MS = 7500; // Chrome must always get a name back; AI limit is 6 s
const CLICK_MAX_AGE_MS = 30000;
const HISTORY_MAX = 200;

// ---------- Gemini Nano access ----------
// If the Prompt API exists in this service worker, use it directly.
// Otherwise host the model in an offscreen document and message it.
const directRunner = typeof LanguageModel !== 'undefined' ? createModelRunner() : null;
const OFFSCREEN_URL = 'offscreen.html';
let creatingOffscreen = null;

async function ensureOffscreen() {
  const url = chrome.runtime.getURL(OFFSCREEN_URL);
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [url] });
  if (existing.length) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['DOM_PARSER'],
      justification: 'Hosts the on-device Gemini Nano (Prompt API) session used to name downloads.',
    }).finally(() => { creatingOffscreen = null; });
  }
  await creatingOffscreen;
}

async function askModel(promptText) {
  if (directRunner) return directRunner.prompt(promptText);
  await ensureOffscreen();
  const r = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'prompt', text: promptText });
  if (!r || !r.ok) throw new Error((r && r.error) || 'offscreen did not reply');
  return r.text;
}

async function modelStatus() {
  if (directRunner) return { status: await directRunner.status(), where: 'service worker' };
  await ensureOffscreen();
  const r = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'status' });
  return { status: (r && r.status) || 'unknown', where: 'offscreen document' };
}

function warmUp() {
  if (directRunner) directRunner.warmUp().catch(() => {});
  else ensureOffscreen().then(() => chrome.runtime.sendMessage({ target: 'offscreen', type: 'warmup' })).catch(() => {});
}

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled } = await chrome.storage.local.get('enabled');
  if (enabled === undefined) await chrome.storage.local.set({ enabled: true });
  warmUp();
});
chrome.runtime.onStartup.addListener(warmUp);

// ---------- Messages from content script / popup ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target === 'offscreen') return;
  if (msg.type === 'click' && sender.tab) {
    const rec = { text: msg.text || '', title: sender.tab.title || msg.title || '', tabUrl: sender.tab.url || '', at: Date.now() };
    chrome.storage.session.set({ ['click:' + sender.tab.id]: rec, lastClick: { ...rec, tabId: sender.tab.id } });
    return;
  }
  if (msg.type === 'model-status') {
    modelStatus().then(sendResponse).catch(e => sendResponse({ status: 'error: ' + e.message }));
    return true;
  }
});

// ---------- Context for a download ----------
function sameOrigin(a, b) {
  try { return new URL(a).origin === new URL(b).origin; } catch { return false; }
}

async function gatherContext(item) {
  const ctx = {
    url: item.url, finalUrl: item.finalUrl, referrer: item.referrer,
    mime: item.mime, filename: item.filename, now: Date.now(),
  };
  try {
    let tab = null;
    let related = false;
    if (item.referrer) {
      const tabs = await chrome.tabs.query({});
      tab = tabs.find(t => t.url === item.referrer) ||
        tabs.filter(t => t.url && sameOrigin(t.url, item.referrer))
            .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || null;
      related = !!tab;
    }
    if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

    const store = await chrome.storage.session.get(tab ? ['click:' + tab.id, 'lastClick'] : ['lastClick']);
    let click = tab && store['click:' + tab.id];
    if (!click || Date.now() - click.at > CLICK_MAX_AGE_MS) click = null;
    if (click) related = true;
    // Downloads that open in a new tab (which then closes): use the very last click anywhere.
    if (!click && store.lastClick && Date.now() - store.lastClick.at < 10000) {
      click = store.lastClick;
      ctx.title = click.title;
      ctx.tabUrl = click.tabUrl;
      ctx.tabRelated = true;
    }
    if (click) ctx.linkText = click.text;
    if (tab && related) {
      ctx.title = tab.title || ctx.title;
      ctx.tabUrl = tab.url;
      ctx.tabRelated = true;
    } else if (tab && !ctx.tabUrl) {
      ctx.tabUrl = tab.url; // weak hint only: used for the source if nothing better exists
      ctx.tabRelated = false;
    }
  } catch (e) {
    // Context is best-effort; the namer still works with url/filename/mime.
  }
  return ctx;
}

// ---------- History (for popup + eval) ----------
let logChain = Promise.resolve();
function logRename(entry) {
  logChain = logChain.then(async () => {
    const { history = [] } = await chrome.storage.local.get('history');
    history.unshift(entry);
    await chrome.storage.local.set({ history: history.slice(0, HISTORY_MAX) });
  }).catch(() => {});
}

// ---------- The hook ----------
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (item.byExtensionId === chrome.runtime.id) return false; // e.g. our own CSV export

  let done = false;
  let fallbackName = null;
  const finish = (filename) => {
    if (done) return;
    done = true;
    try {
      if (filename) suggest({ filename, conflictAction: 'uniquify' });
      else suggest();
    } catch (e) { /* download already moved on */ }
  };
  const hardStop = setTimeout(() => finish(fallbackName), HARD_DEADLINE_MS);

  (async () => {
    const { enabled = true } = await chrome.storage.local.get('enabled');
    if (!enabled) return null;
    const ctx = await gatherContext(item);
    const t0 = Date.now();
    const result = await nameFile(ctx, askModel, AI_TIMEOUT_MS);
    fallbackName = result.fallbackFilename;
    logRename({
      id: item.id, original: basename(item.filename), name: result.filename, via: result.via,
      reason: result.reason || '', ms: Date.now() - t0, ts: Date.now(),
      site: hostOf(ctx.tabUrl || item.referrer || item.finalUrl || item.url),
    });
    return result.filename;
  })()
    .then(name => { clearTimeout(hardStop); finish(name); })
    .catch(() => { clearTimeout(hardStop); finish(fallbackName); });

  return true; // we will call suggest() asynchronously
});
