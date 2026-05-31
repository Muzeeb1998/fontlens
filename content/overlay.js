// content/overlay.js — Shadow-DOM hover chip + inspect outline.
// No chrome.* references — consumers wire messaging.

const STYLE_CSS = `
:host { all: initial; position: fixed; top: 0; left: 0; z-index: 2147483647; pointer-events: none; contain: layout style; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
:host([data-pinned="true"]) { pointer-events: auto; }
.chip { position: absolute; top: 0; left: 0; min-width: 140px; max-width: 280px; padding: 10px 12px; background: #ffffff; color: #0f0f10; border: 1px solid #ececec; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.18); pointer-events: auto; user-select: none; transform: translate3d(0,0,0); transition: transform 80ms cubic-bezier(0.2, 0, 0, 1); will-change: transform; }
.chip[data-pinned="true"] { outline: 2px solid #d4d4d8; outline-offset: 2px; }
@media (prefers-color-scheme: dark) {
  .chip { background:#0e0e10; color:#f5f5f7; border-color:#26262a; box-shadow:0 8px 24px rgba(0,0,0,0.6); }
  .chip[data-pinned="true"] { outline-color:#3a3a3f; }
}
@media (prefers-reduced-motion: reduce) { .chip, .outline { transition: none; } }
.line1 { font-weight: 600; font-size: 13px; line-height: 18px; letter-spacing: -0.005em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.line2 { margin-top: 4px; font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 16px; color: #6b6b6e; font-variant-numeric: tabular-nums; white-space: nowrap; }
@media (prefers-color-scheme: dark) { .line2 { color:#a1a1a6; } }
.fallback { margin-top: 6px; display: flex; align-items: center; gap: 6px; font-size: 11px; line-height: 16px; font-weight: 600; color: #7a4a1d; }
@media (prefers-color-scheme: dark) { .fallback { color:#f5d089; } }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; flex: 0 0 8px; }
@media (prefers-color-scheme: dark) { .dot { background:#f5b840; } }
.requested { margin-top: 2px; font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 16px; color: #6b6b6e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (prefers-color-scheme: dark) { .requested { color:#a1a1a6; } }
.lowconf { margin-top: 2px; font-size: 10px; line-height: 14px; color: #9c9ca0; font-style: italic; }
@media (prefers-color-scheme: dark) { .lowconf { color:#6b6b6e; } }
.outline { position: absolute; top: 0; left: 0; border: 2px solid #0f0f10; border-radius: 4px; pointer-events: none; transition: transform 60ms cubic-bezier(0.2, 0, 0, 1), width 60ms cubic-bezier(0.2, 0, 0, 1), height 60ms cubic-bezier(0.2, 0, 0, 1); }
@media (prefers-color-scheme: dark) { .outline { border-color:#f5f5f7; } }
`;

export class Overlay {
  constructor({ detect, onEmit } = {}) {
    if (typeof detect !== 'function') throw new Error('Overlay: detect fn required');
    this._detect = detect;
    this._onEmit = typeof onEmit === 'function' ? onEmit : () => {};
    this._host = null;
    this._root = null;
    this._chip = null;
    this._outline = null;
    this._pinned = false;
    this._mode = 'hover';
    this._lastDetail = null;
  }

  mount() {
    if (this._host) return;

    const parent = document.body || document.documentElement;
    const host = document.createElement('fontlens-overlay');
    const root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = STYLE_CSS;
    root.appendChild(style);

    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.style.display = 'none';
    root.appendChild(chip);

    const outline = document.createElement('div');
    outline.className = 'outline';
    outline.style.display = 'none';
    root.appendChild(outline);

    parent.appendChild(host);

    this._host = host;
    this._root = root;
    this._chip = chip;
    this._outline = outline;
  }

  unmount() {
    if (!this._host) return;
    this._host.remove();
    this._host = null;
    this._root = null;
    this._chip = null;
    this._outline = null;
    this._pinned = false;
    this._lastDetail = null;
  }
}
