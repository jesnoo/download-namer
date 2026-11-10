// namer.js — shared naming logic.
// Used by background.js (live downloads), offscreen.js (Gemini Nano host) and eval.js (accuracy test).
// Pattern: "Source - What - Date.ext"

export const AI_TIMEOUT_MS = 6000; // Gemini Nano on CPU-only laptops often needs 3-6 s
export const MAX_LEN = 80;

export const MODEL_OPTS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------- Known sites ----------
// Exact hosts (or their subdomains) that need a specific name.
const HOST_MAP = {
  'drive.google.com': 'Google Drive',
  'drive.usercontent.google.com': 'Google Drive',
  'docs.google.com': 'Google Docs',
  'mail.google.com': 'Gmail',
  'mail-attachment.googleusercontent.com': 'Gmail',
  'photos.google.com': 'Google Photos',
  'classroom.google.com': 'Google Classroom',
  'web.whatsapp.com': 'WhatsApp',
  'outlook.live.com': 'Outlook',
  'outlook.office.com': 'Outlook',
};

// Registrable-domain label -> brand name.
const SITE_MAP = {
  amazon: 'Amazon', flipkart: 'Flipkart', myntra: 'Myntra', meesho: 'Meesho', nykaa: 'Nykaa', ajio: 'AJIO',
  swiggy: 'Swiggy', zomato: 'Zomato', blinkit: 'Blinkit', zepto: 'Zepto', zeptonow: 'Zepto', bigbasket: 'BigBasket',
  hdfcbank: 'HDFC', hdfc: 'HDFC', icicibank: 'ICICI', icici: 'ICICI', onlinesbi: 'SBI', sbi: 'SBI', sbicard: 'SBI Card',
  axisbank: 'Axis Bank', kotak: 'Kotak', kotak811: 'Kotak', yesbank: 'Yes Bank', idfcfirstbank: 'IDFC First',
  paytm: 'Paytm', phonepe: 'PhonePe', cred: 'CRED', zerodha: 'Zerodha', groww: 'Groww',
  irctc: 'IRCTC', makemytrip: 'MakeMyTrip', goibibo: 'Goibibo', cleartrip: 'Cleartrip', goindigo: 'IndiGo', airindia: 'Air India',
  uber: 'Uber', olacabs: 'Ola', rapido: 'Rapido', bookmyshow: 'BookMyShow',
  airtel: 'Airtel', jio: 'Jio', myvi: 'Vi',
  incometax: 'Income Tax', epfindia: 'EPFO', uidai: 'UIDAI', digilocker: 'DigiLocker',
  arxiv: 'arXiv', github: 'GitHub', linkedin: 'LinkedIn', naukri: 'Naukri', notion: 'Notion', dropbox: 'Dropbox',
  canva: 'Canva', figma: 'Figma', slack: 'Slack', zoom: 'Zoom', youtube: 'YouTube', wikipedia: 'Wikipedia',
  medium: 'Medium', coursera: 'Coursera', udemy: 'Udemy', google: 'Google', microsoft: 'Microsoft', live: 'Microsoft', office: 'Microsoft', microsoftonline: 'Microsoft',
  overleaf: 'Overleaf', pinterest: 'Pinterest', claude: 'Claude', anthropic: 'Anthropic', openai: 'OpenAI', chatgpt: 'ChatGPT',
};

// File hosts / CDNs: the download URL's host says nothing about the real source.
const CDN_HOSTS = ['amazonaws.com', 'cloudfront.net', 'googleusercontent.com', 'akamaihd.net', 'akamaized.net',
  'cloudinary.com', 'azureedge.net', 'core.windows.net', 'fastly.net', 'githubusercontent.com', 'storage.googleapis.com'];

const MULTI_TLD = new Set(['co.in', 'gov.in', 'ac.in', 'org.in', 'net.in', 'nic.in', 'firm.in', 'res.in', 'edu.in', 'gen.in', 'ind.in', 'ernet.in', 'co.uk', 'org.uk',
  'ac.uk', 'gov.uk', 'com.au', 'co.jp', 'com.sg', 'co.nz', 'com.br']);

// ---------- Document-type keywords (most specific first) ----------
const KEYWORDS = [
  ['credit card statement', 'Credit Card Statement'], ['card statement', 'Card Statement'],
  ['account statement', 'Account Statement'], ['bank statement', 'Bank Statement'], ['statement', 'Statement'],
  ['tax invoice', 'Tax Invoice'], ['invoice', 'Invoice'], ['order receipt', 'Order Receipt'], ['receipt', 'Receipt'],
  ['order summary', 'Order Summary'], ['boarding pass', 'Boarding Pass'], ['e-ticket', 'E-Ticket'], ['eticket', 'E-Ticket'],
  ['ticket', 'Ticket'], ['itinerary', 'Itinerary'], ['payslip', 'Payslip'], ['pay slip', 'Payslip'],
  ['salary slip', 'Salary Slip'], ['offer letter', 'Offer Letter'], ['appointment letter', 'Appointment Letter'],
  ['relieving letter', 'Relieving Letter'], ['experience letter', 'Experience Letter'], ['form 16', 'Form 16'],
  ['form16', 'Form 16'], ['26as', 'Form 26AS'], ['cover letter', 'Cover Letter'], ['resume', 'Resume'],
  ['admit card', 'Admit Card'], ['marksheet', 'Marksheet'], ['transcript', 'Transcript'], ['certificate', 'Certificate'],
  ['policy', 'Policy'], ['prescription', 'Prescription'], ['quotation', 'Quotation'], ['warranty', 'Warranty'],
  ['contract', 'Contract'], ['agreement', 'Agreement'], ['bill', 'Bill'], ['report', 'Report'],
];

const GENERIC_NAME_WORDS = new Set(['download', 'downloads', 'downloaded', 'file', 'files', 'untitled', 'copy', 'document',
  'doc', 'docs', 'final', 'new', 'attachment', 'export', 'print', 'view', 'pdf', 'getfile', 'blob', 'output', 'default', 'index']);
const GENERIC_WHAT = new Set(['download', 'file', 'pdf', 'attachment', 'unknown', 'n/a', 'none', '']);
const GENERIC_LINK = new Set(['download', 'download pdf', 'download file', 'click here', 'here', 'save', 'pdf', 'export',
  'get', 'open', 'view', 'print', 'download now', 'save as pdf', 'download all', 'continue', 'ok', 'yes', 'submit']);
const GENERIC_TITLE = new Set(['home', 'dashboard', 'netbanking', 'net banking', 'online banking', 'login', 'log in',
  'sign in', 'welcome', 'untitled', 'new tab', 'loading', 'redirecting']);

const MIME_EXT = {
  'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'text/csv': '.csv', 'text/plain': '.txt', 'application/zip': '.zip', 'application/json': '.json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/msword': '.doc', 'application/vnd.ms-excel': '.xls',
};

// ---------- Small helpers ----------
export function basename(p) {
  return String(p || '').split(/[\\/]/).pop() || '';
}

export function hostOf(u) {
  try {
    const url = new URL(String(u).replace(/^blob:/, ''));
    return /^https?:$/.test(url.protocol) ? url.hostname.toLowerCase() : '';
  } catch { return ''; }
}

function urlPath(u) {
  try { const url = new URL(u); return /^https?:$/.test(url.protocol) ? decodeURIComponent(url.pathname) : ''; }
  catch { return ''; }
}

function isCdn(host) {
  return !!host && CDN_HOSTS.some(c => host === c || host.endsWith('.' + c));
}

function titleCase(s) {
  return String(s).split(' ').map(w => (w && w === w.toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

export function sanitize(s) {
  return String(s || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[.\s-]+|[.\s-]+$/g, '');
}

function limitWords(s, n) {
  return String(s).split(/\s+/).filter(Boolean).slice(0, n).join(' ');
}

function normText(s) {
  return String(s || '').replace(/[_+]+/g, ' ').replace(/\.(?=[a-z])/gi, ' ');
}

export function formatDay(d) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function formatMonth(y, m) {
  return `${MONTHS[m]} ${y}`;
}

// ---------- Source ----------
function siteLabel(host) {
  const parts = host.replace(/^www\d*\./, '').split('.');
  if (parts.length < 2) return parts[0];
  const last2 = parts.slice(-2).join('.');
  const i = MULTI_TLD.has(last2) ? parts.length - 3 : parts.length - 2;
  return parts[Math.max(0, i)];
}

export function sourceFromHost(host) {
  host = host.toLowerCase().replace(/^www\d*\./, '');
  for (const [k, v] of Object.entries(HOST_MAP)) {
    if (host === k || host.endsWith('.' + k)) return { name: v, known: true };
  }
  const label = siteLabel(host);
  if (SITE_MAP[label]) return { name: SITE_MAP[label], known: true };
  // e.g. netbanking.hdfcbank.com already handled; try every label as a last resort
  for (const part of host.split('.')) if (SITE_MAP[part]) return { name: SITE_MAP[part], known: true };
  return { name: titleCase(label.replace(/-/g, ' ')), known: false };
}

function pickSource(ctx) {
  const order = [];
  if (ctx.tabUrl && ctx.tabRelated) order.push(ctx.tabUrl);
  if (ctx.referrer) order.push(ctx.referrer);
  for (const u of [ctx.finalUrl, ctx.url]) if (u && !isCdn(hostOf(u))) order.push(u);
  if (ctx.tabUrl) order.push(ctx.tabUrl);
  order.push(ctx.finalUrl, ctx.url);
  for (const u of order) {
    const h = hostOf(u);
    if (h) return { ...sourceFromHost(h), host: h };
  }
  return { name: 'Web', known: false, host: '' };
}

// ---------- What ----------
function findKeyword(text) {
  const t = ' ' + normText(text).toLowerCase() + ' ';
  for (const [k, label] of KEYWORDS) {
    const re = new RegExp(`(?:^|[^a-z0-9])${k.replace(/[-]/g, '\\-')}(?:$|[^a-z0-9])`);
    if (re.test(t)) return label;
  }
  return null;
}

function stripDateWords(s) {
  return String(s)
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s,'’-]*(20\d{2})\b/gi, ' ')
    .replace(/\b(january|february|march|april|june|july|august|september|october|november|december)\b/gi, ' ')
    .replace(/\b20\d{2}\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanLinkText(t) {
  let s = String(t || '').replace(/\s+/g, ' ').trim();
  if (!s || s.length > 80) return '';
  s = s.replace(/^(download|save|get|export|view|print)\s+(as\s+)?(pdf\s+)?/i, '')
       .replace(/\s*\(?\b(pdf|csv|xlsx?)\)?\s*$/i, '')
       .trim();
  if (s.length < 3 || GENERIC_LINK.has(s.toLowerCase())) return '';
  return s;
}

function bestTitleSegment(title, source) {
  if (!title) return '';
  const t = String(title).replace(/^\[\d{4}\.\d{4,5}(v\d+)?\]\s*/, ''); // arXiv "[2411.01234] Title"
  const src = source.name.toLowerCase();
  const segs = t.split(/\s*[|–—·•»]\s*|\s+-\s+|:\s+/).map(s => s.trim()).filter(Boolean);
  for (const s of segs) {
    const low = s.toLowerCase();
    if (s.length < 3) continue;
    if (low.includes(src) || (source.host && low.includes(siteLabel(source.host)))) continue;
    if (GENERIC_TITLE.has(low)) continue;
    return s;
  }
  return '';
}

export function cleanOriginal(filename) {
  let b = basename(filename).replace(/\.[a-z0-9]{1,5}$/i, '');
  b = b.replace(/\(\d+\)/g, ' ').replace(/[_\-.+~]+/g, ' ');
  const words = b.split(/\s+/).filter(Boolean).map(w => {
    if (/^(img|pxl|dsc|dscn|photo|image|pic)$/i.test(w)) return 'Photo';
    if (/^screenshot$/i.test(w)) return 'Screenshot';
    if (/^(scan|scanned)$/i.test(w)) return 'Scan';
    if (/^vid$/i.test(w)) return 'Video';
    return w;
  }).filter(w =>
    !/^\d+$/.test(w) &&
    !(/\d/.test(w) && w.length >= 6) &&
    !/^[0-9a-f]{8,}$/i.test(w) &&
    !GENERIC_NAME_WORDS.has(w.toLowerCase())
  );
  const kept = limitWords(words.join(' '), 5).split(' ');
  while (kept.length > 1 && /^(and|of|the|for|to|in|on|with|sub|a|an|&)$/i.test(kept[kept.length - 1])) kept.pop();
  return titleCase(kept.join(' '));
}

function mimeGeneric(mime) {
  mime = String(mime || '');
  if (mime === 'application/pdf' || /word/.test(mime)) return 'Document';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.startsWith('video/')) return 'Video';
  if (mime.startsWith('audio/')) return 'Audio';
  if (/zip|compressed|tar/.test(mime)) return 'Archive';
  if (/sheet|excel|csv/.test(mime)) return 'Spreadsheet';
  if (/presentation|powerpoint/.test(mime)) return 'Presentation';
  if (/html/.test(mime)) return 'Web Page';
  if (/apple-diskimage|octet-stream|x-msdownload|x-newton|pkg/.test(mime)) return 'Installer';
  return 'File';
}

function cleanWhat(s, isPaper) {
  let w = sanitize(stripDateWords(s)).replace(/\.(pdf|docx?|xlsx?|csv|jpe?g|png)$/i, '');
  w = w.replace(/^(download(ed)?|file)\s+/i, '');
  return limitWords(w, isPaper ? 14 : 5);
}

// ---------- Date ----------
function findDate(texts, now) {
  const maxYear = now.getFullYear() + 1;
  const ok = (y) => y >= 2000 && y <= maxYear;
  for (const raw of texts) {
    if (!raw) continue;
    const t = normText(raw);
    let m = t.match(/(?:^|\D)(20\d{2})[-.\/ ]?(0[1-9]|1[0-2])[-.\/ ]?(0[1-9]|[12]\d|3[01])(?!\d)/);
    if (m && ok(+m[1])) return formatDay(new Date(+m[1], +m[2] - 1, +m[3]));
    m = t.match(/(?:^|\D)(0?[1-9]|[12]\d|3[01])[-.\/](0?[1-9]|1[0-2])[-.\/](20\d{2})(?!\d)/);
    if (m && ok(+m[3])) return formatDay(new Date(+m[3], +m[2] - 1, +m[1]));
    m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,.-]*(20\d{2}|['’]\d{2})\b/i);
    if (m) {
      const y = m[2].length === 4 ? +m[2] : 2000 + +m[2].slice(1);
      if (ok(y)) return formatMonth(y, MONTHS.findIndex(x => x.toLowerCase() === m[1].slice(0, 3).toLowerCase()));
    }
    m = t.match(/(?:^|\D)(20\d{2})[-\/](0[1-9]|1[0-2])(?![\d])/);
    if (m && ok(+m[1])) return formatMonth(+m[1], +m[2] - 1);
  }
  return null;
}

function arxivDate(ctx) {
  const m = `${basename(ctx.filename)} ${ctx.url || ''}`.match(/(?:^|\D)(\d{2})(0[1-9]|1[0-2])\.\d{4,5}/);
  return m ? formatMonth(2000 + +m[1], +m[2] - 1) : null;
}

function normalizeDate(s, now) {
  s = String(s || '').trim();
  const m = s.match(/^(?:(\d{1,2})\s+)?([A-Za-z]{3,9})\.?,?\s+(20\d{2})$/);
  if (!m) return null;
  const mi = MONTHS.findIndex(x => x.toLowerCase() === m[2].slice(0, 3).toLowerCase());
  const y = +m[3];
  if (mi < 0 || y < 2000 || y > now.getFullYear() + 1) return null;
  if (m[1]) {
    const d = +m[1];
    if (d < 1 || d > 31) return null;
    return formatDay(new Date(y, mi, d));
  }
  return formatMonth(y, mi);
}

// ---------- Extension ----------
export function getExt(ctx) {
  const m = basename(ctx.filename).match(/(\.[A-Za-z0-9]{1,6})$/);
  if (m) return m[1];
  return MIME_EXT[String(ctx.mime || '').split(';')[0]] || '';
}

// ---------- Filename building ----------
export function buildFilename({ source, what, date }, ext) {
  const src = sanitize(source) || 'Web';
  let w = sanitize(what) || 'File';
  const dt = sanitize(date);
  const tail = `${dt ? ' - ' + dt : ''}${ext}`;
  const room = MAX_LEN - tail.length - src.length - 3;
  if (w.length > room) {
    let cut = w.slice(0, Math.max(room, 8));
    if (cut.includes(' ') && cut.length < w.length) cut = cut.slice(0, cut.lastIndexOf(' '));
    w = cut.trim();
  }
  return `${src} - ${w}${tail}`.replace(/\s{2,}/g, ' ');
}

// ---------- Rule-based fallback ----------
export function fallbackParts(ctx) {
  const now = new Date(ctx.now || Date.now());
  const source = pickSource(ctx);
  const isPaper = source.name === 'arXiv';
  const link = cleanLinkText(ctx.linkText);
  const titleSeg = bestTitleSegment(ctx.title, source);
  const orig = cleanOriginal(ctx.filename);
  const kw = findKeyword([ctx.linkText, basename(ctx.filename), ctx.title, urlPath(ctx.finalUrl || ctx.url)].join(' '));

  let what;
  if (isPaper && titleSeg) what = titleSeg;
  else if (link && findKeyword(link)) what = link;
  else if (kw) what = kw;
  else if (link) what = link;
  else if (titleSeg) what = titleSeg;
  else if (orig) what = orig;
  else what = mimeGeneric(ctx.mime);
  what = cleanWhat(what, isPaper) || mimeGeneric(ctx.mime);
  if (what === what.toLowerCase()) what = titleCase(what);

  const found = (isPaper && arxivDate(ctx)) ||
    findDate([ctx.linkText, ctx.title, basename(ctx.filename), urlPath(ctx.finalUrl || ctx.url)], now);

  return {
    source: source.name, known: source.known, host: source.host, isPaper,
    what, origClean: orig, date: found || formatDay(now), dateFound: !!found,
  };
}

// ---------- AI prompt ----------
export const SYSTEM_PROMPT = `Name downloaded files so they are easy to find. Reply with JSON only:
{"source":"brand or site name","what":"1-5 words: what the document is","date":"10 Nov 2026 or Oct 2026 if the context shows it, else empty","confident":true or false}
If the input gives a source, use it exactly. For a research paper, "what" is the paper title. No file extensions or words like "download" or "file". Do not invent details.`;

export const INITIAL_PROMPTS = [
  { role: 'system', content: SYSTEM_PROMPT },
  { role: 'user', content: 'Website: netbanking.hdfcbank.com (use source "HDFC")\nPage title: Credit Card Statement for October 2026\nOriginal filename: download (2).pdf' },
  { role: 'assistant', content: '{"source":"HDFC","what":"Credit Card Statement","date":"Oct 2026","confident":true}' },
];

export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    source: { type: 'string' },
    what: { type: 'string' },
    date: { type: 'string' },
    confident: { type: 'boolean' },
  },
  required: ['source', 'what', 'date', 'confident'],
  additionalProperties: false,
};

export function buildUserPrompt(ctx, fb) {
  const now = new Date(ctx.now || Date.now());
  const lines = [];
  lines.push(`Website: ${fb.host || 'unknown'}${fb.known ? ` (use source "${fb.source}")` : ''}`);
  if (ctx.title) lines.push(`Page title: ${String(ctx.title).slice(0, 150)}`);
  if (ctx.linkText) lines.push(`Clicked link/button text: ${String(ctx.linkText).slice(0, 100)}`);
  lines.push(`Original filename: ${basename(ctx.filename)}`);
  if (ctx.mime && !/\.[a-z0-9]{1,6}$/i.test(basename(ctx.filename))) lines.push(`File type: ${ctx.mime}`);
  const p = urlPath(ctx.finalUrl || ctx.url);
  if (p && p !== '/' && !ctx.title && !ctx.linkText) lines.push(`URL path: ${p.slice(0, 100)}`);
  return lines.join('\n');
}

export function parseModelJson(raw) {
  const s = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

// Turns model output into validated parts, or null if unusable.
export function mergeAi(raw, fb, ctx) {
  const j = parseModelJson(raw);
  if (!j || typeof j !== 'object') return null;
  const now = new Date(ctx.now || Date.now());
  let what = cleanWhat(String(j.what || ''), fb.isPaper);
  if (what.toLowerCase().startsWith(fb.source.toLowerCase() + ' ')) what = what.slice(fb.source.length + 1);
  if (GENERIC_WHAT.has(what.toLowerCase())) return null;
  // Model echoed a template/placeholder instead of naming the file
  if (/[\[\]{}<>]|content of|placeholder|example|lorem|unknown/i.test(what)) return null;
  if (what === what.toLowerCase()) what = titleCase(what);
  let aiSource = sanitize(String(j.source || '')).slice(0, 30);
  // Never accept a raw domain ("coffeedaygame.blog") as the source; use the cleaned brand from code
  if (/\.[a-z]{2,}$/i.test(aiSource) || /\s?\.\s?(com|in|net|org|blog|io|gov)\b/i.test(aiSource) || aiSource.toLowerCase() === (fb.host || '').toLowerCase()) aiSource = '';
  if (aiSource && aiSource === aiSource.toLowerCase()) aiSource = titleCase(aiSource);
  const source = fb.known ? fb.source : (aiSource || fb.source); // known sites keep one consistent name
  const date = fb.dateFound ? fb.date : (normalizeDate(j.date, now) || fb.date);
  return { source, what, date, confident: j.confident !== false };
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`AI timeout (${ms} ms)`)), ms))]);
}

/**
 * Main entry. ctx = { url, finalUrl, referrer, mime, filename, title?, linkText?, tabUrl?, tabRelated?, now? }
 * askModel(promptText) -> Promise<string> (raw model output), or null to skip AI.
 * Returns { filename, via: 'ai' | 'fallback' | 'low-confidence', reason?, fallbackFilename }
 */
export async function nameFile(ctx, askModel, timeoutMs = AI_TIMEOUT_MS) {
  const fb = fallbackParts(ctx);
  const ext = getExt(ctx);
  const fallbackFilename = buildFilename(fb, ext);
  if (!askModel) return { filename: fallbackFilename, via: 'fallback', reason: 'AI off or unavailable', fallbackFilename };
  try {
    const raw = await withTimeout(Promise.resolve().then(() => askModel(buildUserPrompt(ctx, fb))), timeoutMs);
    const parts = mergeAi(raw, fb, ctx);
    if (!parts) return { filename: fallbackFilename, via: 'fallback', reason: 'unusable AI output', fallbackFilename };
    if (!parts.confident) {
      const what = fb.origClean || fb.what;
      return { filename: buildFilename({ source: parts.source, what, date: parts.date }, ext), via: 'low-confidence', fallbackFilename };
    }
    return { filename: buildFilename(parts, ext), via: 'ai', fallbackFilename };
  } catch (e) {
    return { filename: fallbackFilename, via: 'fallback', reason: String(e && e.message || e), fallbackFilename };
  }
}

// ---------- Gemini Nano runner (works in any context where LanguageModel exists) ----------
export function createModelRunner() {
  let baseP = null;

  async function status() {
    if (typeof LanguageModel === 'undefined') return 'unsupported';
    try { return await LanguageModel.availability(MODEL_OPTS); }
    catch (e) { return 'error: ' + (e && e.message || e); }
  }

  async function make(onProgress) {
    if (typeof LanguageModel === 'undefined') throw new Error('Prompt API not available here');
    const s = await status();
    // Downloading the model needs a user click, so only allow it when a progress callback (UI) is given.
    if (s !== 'available' && !onProgress) throw new Error('Gemini Nano is ' + s);
    return LanguageModel.create({
      ...MODEL_OPTS,
      initialPrompts: INITIAL_PROMPTS,
      ...(onProgress ? { monitor(m) { m.addEventListener('downloadprogress', e => onProgress(e.loaded)); } } : {}),
    });
  }

  function base(onProgress) {
    if (!baseP) baseP = make(onProgress).catch(e => { baseP = null; throw e; });
    return baseP;
  }

  async function prompt(text) {
    const b = await base();
    const s = typeof b.clone === 'function' ? await b.clone() : b;
    try {
      try {
        return await s.prompt(text, { responseConstraint: RESPONSE_SCHEMA });
      } catch (e) {
        if (e && (e.name === 'NotSupportedError' || e instanceof TypeError)) return await s.prompt(text);
        throw e;
      }
    } finally {
      if (s !== b && typeof s.destroy === 'function') s.destroy();
    }
  }

  return { status, prompt, warmUp: base };
}
