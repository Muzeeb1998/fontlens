// service-worker.js — MV3 background router. Holds zero important state.

import { verdict } from './lib/install.js';

chrome.runtime.onInstalled.addListener(async (details) => {
  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  // First-install onboarding: open the demo tab + side panel exactly once.
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

// Toolbar click: Chrome opens the side panel via setPanelBehavior. Inject the
// content script (so it boots on the active tab) and ask it to enter Hover mode.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: false },
      files: ['content/loader.js'],
    });
    await chrome.tabs.sendMessage(tab.id, { type: 'fontlens:set-mode', mode: 'hover' });
  } catch {
    // chrome:// or store pages — silently ignored; panel opens but stays empty.
  }
});

// Keyboard command: same as action click but starts in Inspect mode.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-inspect') return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/loader.js'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'fontlens:set-mode', mode: 'inspect' });
  } catch {}
});
