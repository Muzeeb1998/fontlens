const RADIO_NAME = 'defaultFormat';

document.addEventListener('DOMContentLoaded', async () => {
  let stored = 'css';
  try {
    const r = await chrome.storage.local.get([RADIO_NAME]);
    if (r?.[RADIO_NAME] === 'css' || r?.[RADIO_NAME] === 'tailwind' || r?.[RADIO_NAME] === 'token') {
      stored = r[RADIO_NAME];
    }
  } catch {}

  const target = document.querySelector(`input[name="${RADIO_NAME}"][value="${stored}"]`);
  if (target) target.checked = true;

  for (const radio of document.querySelectorAll(`input[name="${RADIO_NAME}"]`)) {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        try { chrome.storage.local.set({ [RADIO_NAME]: radio.value }); } catch {}
      }
    });
  }
});
