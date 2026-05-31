// Single seam between the panel and Chrome's messaging + storage APIs.
// `panel.js` imports only from this module for chrome.* — `render.js` is
// pure DOM and never touches chrome.* directly.

const THEME_KEY = 'theme';

export async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id ?? null;
}

export async function sendToContent(msg) {
  const tabId = await getActiveTabId();
  if (tabId == null) return;
  try { await chrome.tabs.sendMessage(tabId, msg); } catch { /* tab closed / no listener */ }
}

export function onContentMessage(handler) {
  const wrapped = (msg, sender) => {
    if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('fontlens:')) return;
    handler(msg, sender);
  };
  chrome.runtime.onMessage.addListener(wrapped);
  return () => chrome.runtime.onMessage.removeListener(wrapped);
}

export async function loadTheme() {
  try {
    const got = await chrome.storage.local.get(THEME_KEY);
    const t = got?.[THEME_KEY];
    return (t === 'light' || t === 'dark' || t === 'auto') ? t : 'auto';
  } catch { return 'auto'; }
}

export async function saveTheme(theme) {
  try { await chrome.storage.local.set({ [THEME_KEY]: theme }); } catch {}
}
