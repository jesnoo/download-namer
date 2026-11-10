// offscreen.js — hosts the Gemini Nano session when the service worker can't use the Prompt API directly.
import { createModelRunner } from './namer.js';

const runner = createModelRunner();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'offscreen') return;
  (async () => {
    if (msg.type === 'status') return { status: await runner.status() };
    if (msg.type === 'warmup') { await runner.warmUp(); return { ok: true }; }
    if (msg.type === 'prompt') return { ok: true, text: await runner.prompt(msg.text) };
    return { ok: false, error: 'unknown message' };
  })()
    .then(sendResponse)
    .catch(e => sendResponse({ ok: false, error: String((e && e.message) || e) }));
  return true;
});
