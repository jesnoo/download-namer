// content.js — remembers the text of the last link/button you clicked, so downloads get a better name.
// Only the visible label (max 120 chars) is sent, and only to this extension's own background script.
(() => {
  document.addEventListener('click', (e) => {
    const el = e.target && e.target.closest && e.target.closest('a, button, [role="button"], [role="link"], input[type="submit"], input[type="button"]');
    if (!el) return;
    const text = (el.innerText || el.value || el.getAttribute('aria-label') || el.title || el.getAttribute('download') || '')
      .replace(/\s+/g, ' ').trim().slice(0, 120);
    try {
      chrome.runtime.sendMessage({ type: 'click', text, title: document.title }).catch(() => {});
    } catch (_) { /* extension was reloaded; ignore */ }
  }, true);
})();
