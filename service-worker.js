// service-worker.js — MV3 background router. Holds zero important state.

import { verdict } from './lib/install.js';

// Open the side panel ourselves on action click so action.onClicked still
// fires (setPanelBehavior(openPanelOnActionClick:true) suppresses the event
// and breaks our content-script injection path).
chrome.runtime.onInstalled.addListener(async (details) => {
  if (chrome.sidePanel?.setPanelBehavior) {
    try { await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }); } catch {}
  }

  const demoUrl = chrome.runtime.getURL('onboarding/demo.html');
  const storageGet = async (k) => {
    const r = await chrome.storage.local.get(k);
    return r[k];
  };
  const v = await verdict(details, { storageGet, demoUrl });
  if (v.action !== 'open-demo') return;

  await chrome.storage.local.set({ 'fontlens.installed': true });
  const tab = await chrome.tabs.create({ url: v.url, active: true });
  if (chrome.sidePanel?.open && tab?.id != null) {
    try { await chrome.sidePanel.open({ tabId: tab.id }); } catch {}
  }
});

async function injectAndKick(tabId, mode) {
  // 1) Open the side panel for this tab (requires the user gesture we have
  //    inside action.onClicked / commands.onCommand).
  if (chrome.sidePanel?.open) {
    try { await chrome.sidePanel.open({ tabId }); } catch {}
  }
  // 2) Inject the content loader. activeTab grants permission inside the
  //    same user gesture frame.
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ['content/loader.js'],
    });
  } catch (e) {
    // chrome:// / Web Store / file:// without permission — silently abort.
    return;
  }
  // 3) The loader does a dynamic import to bring up content.js. Give it a
  //    short window to subscribe to runtime messages before we kick off
  //    the first extract + mode set.
  const tryKick = async (attemptsLeft) => {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'fontlens:set-mode', mode });
      await chrome.tabs.sendMessage(tabId, { type: 'fontlens:request-extract' });
    } catch {
      if (attemptsLeft > 0) setTimeout(() => tryKick(attemptsLeft - 1), 200);
    }
  };
  setTimeout(() => tryKick(5), 150);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  await injectAndKick(tab.id, 'hover');
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-inspect') return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;
  await injectAndKick(tab.id, 'inspect');
});

// The side panel sometimes opens before the content script has finished
// its dynamic-import boot. The panel calls this on init so we can re-trigger
// an extract on the active tab.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'fontlens:ensure-content') return;
  (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id) { sendResponse({ ok: false }); return; }
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false },
        files: ['content/loader.js'],
      }).catch(() => {});
      setTimeout(async () => {
        try { await chrome.tabs.sendMessage(tab.id, { type: 'fontlens:request-extract' }); } catch {}
      }, 200);
      sendResponse({ ok: true, tabId: tab.id });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();
  return true; // async
});
