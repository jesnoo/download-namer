# Smart Download Namer

A Chrome extension that gives every download a **findable name** the moment it starts — using Chrome's built-in, on-device **Gemini Nano**. No server, no sign-in, no data upload.

| Original name | Downloaded from | New name |
|---|---|---|
| `invoice_83920.pdf` | amazon.in order page | `Amazon - Invoice - 10 Nov 2026.pdf` |
| `download (2).pdf` | HDFC netbanking | `HDFC - Credit Card Statement - Oct 2026.pdf` |
| `1731234.pdf` | Swiggy order page | `Swiggy - Order Receipt - 10 Nov 2026.pdf` |
| `2411.01234.pdf` | arxiv.org | `arXiv - <Paper Title> - Nov 2024.pdf` |

## The problem
Browsers save files as `document(3).pdf`, `download.pdf`, `1731234.pdf`. Weeks later you can't find them by searching your Downloads folder, because nothing in the name says what the file is.

## How it works
1. Chrome fires `downloads.onDeterminingFilename` before a file is saved.
2. The extension gathers **context only** — site, page title, the text of the link you clicked, original filename and file type. It never reads file contents.
3. **Gemini Nano** (Chrome's Prompt API, on-device) returns strict JSON `{source, what, date, confident}`. Code validates it and builds the name — the model never writes the filename freely.
4. If the model is unavailable, too slow (>2.5 s) or unsure, a **rule-based namer** produces the name instead (domain → brand map for common Indian sites, document-type keywords, date detection).
5. Pattern is always `Source - What - Date.ext`, ≤ 80 chars, illegal characters removed, duplicates get `(1)` from Chrome.

## Results
<!-- Fill in after running the eval page -->
**Naming accuracy: __X%__ of 150 past downloads** (AI names: __%, fallback names: __%). Raw results: [`results/eval.csv`](results/eval.csv).

"Correct" means: I'd find the file by searching a word I'd naturally think of (brand or document type), and the name describes it accurately.

**Limitation:** Chrome doesn't store page titles or clicked-link text for old downloads, so the eval runs on URL, referrer, filename and MIME type only. Live downloads also get the page title and link text, so real-world accuracy should be at least as good.

## Privacy
- The AI runs **on your device** (Gemini Nano). No file, URL or name leaves your laptop.
- No network requests, no analytics, no accounts. You can verify this in DevTools → Network.
- History of the last 200 renames is kept in `chrome.storage.local` on your machine only.

## Permissions (and why)
| Permission | Why |
|---|---|
| `downloads` | To suggest a name before each download is saved, and to read past downloads for the accuracy test |
| `tabs` | To read the title and URL of the page the download came from |
| `storage` | To keep the on/off setting and the rename history locally |
| `offscreen` | To host the Gemini Nano session if the Prompt API isn't available in the service worker |
| Content script on all sites | Remembers only the visible text of the last link/button you clicked (max 120 chars), sent only to this extension |

## Install (unpacked)
1. Download or clone this repo.
2. Open `chrome://extensions`, turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Click the extension icon → **Open accuracy test** → **Set up Gemini Nano** (first run downloads the model; check progress at `chrome://on-device-internals`).

**Requirements:** Chrome 138+. For Gemini Nano: GPU with >4 GB VRAM, or 16 GB RAM with 4+ CPU cores; 22 GB free disk; Windows 10/11, macOS 13+, Linux or ChromeOS (Chromebook Plus). Without these, the extension still works with rule-based naming.

## Files
```
manifest.json      MV3 manifest
background.js      download hook, context gathering, timeout + fallback, history
namer.js           naming logic: rules, prompt, JSON validation, filename building
offscreen.html/js  Gemini Nano host (used only if the service worker can't run it)
content.js         remembers the last clicked link text
popup.html/js      on/off toggle, model status, last 20 renames
eval.html/js       accuracy test on past downloads, ✅/❌ marking, CSV export
```

## Not in scope (yet)
- Reading the first page of PDFs when context is useless (v2)
- Per-site naming rules (v2)
- Renaming files after they're saved (Chrome's API doesn't allow it)
