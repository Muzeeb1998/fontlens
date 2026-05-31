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

  // ---------- render helpers ----------

  _stripPx(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  _formatMetrics(m) {
    const size = m.size;
    const weight = String(m.weight);
    const sizePx = this._stripPx(m.size);
    const lhPx   = this._stripPx(m.lineHeight);
    const lhPart = (sizePx != null && lhPx != null)
      ? `${Math.round(lhPx)}/${Math.round(sizePx)}`
      : (m.lineHeight === 'normal' ? 'normal' : m.lineHeight);
    return `${size} · ${weight} · ${lhPart}`;
  }

  _renderChip(detail) {
    if (!this._chip) return;
    const chip = this._chip;
    chip.replaceChildren();
    chip.style.display = 'block';

    const line1 = document.createElement('div');
    line1.className = 'line1';
    line1.textContent = detail.rendered || '—';
    chip.appendChild(line1);

    const line2 = document.createElement('div');
    line2.className = 'line2';
    line2.textContent = this._formatMetrics(detail.metrics);
    chip.appendChild(line2);

    if (detail.isFallback) {
      const fb = document.createElement('div');
      fb.className = 'fallback';
      const dot = document.createElement('span');
      dot.className = 'dot';
      fb.appendChild(dot);
      const txt = document.createElement('span');
      txt.textContent = 'fallback';
      fb.appendChild(txt);
      chip.appendChild(fb);

      const requested = detail.requested[0] || '';
      if (requested) {
        const r = document.createElement('div');
        r.className = 'requested';
        r.textContent = `requested: ${requested}`;
        chip.appendChild(r);
      }

      // Onboarding demo listens for this. No-op on every other page.
      try { window.postMessage({ type: 'fontlens:fallback-seen' }, '*'); } catch {}
    }

    if (detail.confidence === 'low') {
      const lc = document.createElement('div');
      lc.className = 'lowconf';
      lc.textContent = "couldn't confirm rendering";
      chip.appendChild(lc);
    }
  }

  // ---------- show / hide / pin ----------

  show(el, cursor) {
    if (!this._host) this.mount();
    if (this._pinned) return;
    const detail = this._detect(el);
    this._lastDetail = { detail, el, cursor };
    this._renderChip(detail);
    this._position(cursor);
  }

  hide() {
    if (this._pinned) return;
    if (!this._chip) return;
    this._chip.style.display = 'none';
  }

  pin() {
    if (!this._lastDetail) return;
    this._pinned = true;
    if (this._host)  this._host.setAttribute('data-pinned', 'true');
    if (this._chip)  this._chip.setAttribute('data-pinned', 'true');
  }

  unpin() {
    this._pinned = false;
    if (this._host)  this._host.removeAttribute('data-pinned');
    if (this._chip)  this._chip.removeAttribute('data-pinned');
  }

  isPinned() { return this._pinned; }

  // ---------- positioning ----------

  _position(cursor) {
    if (!this._chip || !cursor) return;
    const offsetX = 14;
    const offsetY = 18;
    const rect = this._chip.getBoundingClientRect();
    const vw = (typeof window !== 'undefined' && window.innerWidth)  || 1024;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 768;

    let x = cursor.x + offsetX;
    let y = cursor.y + offsetY;

    if (x + rect.width > vw) {
      x = cursor.x - rect.width - offsetX;
    }
    if (y + rect.height > vh) {
      y = cursor.y - rect.height - offsetY;
    }
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    this._chip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }

  move(cursor) {
    if (this._pinned) return;
    if (!this._chip || this._chip.style.display === 'none') return;
    this._position(cursor);
  }

  // ---------- mode ----------

  setMode(mode) {
    if (mode !== 'hover' && mode !== 'inspect') return;
    this._mode = mode;
    if (mode === 'hover' && this._outline) {
      this._outline.style.display = 'none';
    }
  }

  getMode() { return this._mode; }

  // ---------- outline ----------

  highlight(el) {
    if (!this._outline || !el) return;
    const r = el.getBoundingClientRect();
    this._outline.style.display = 'block';
    this._outline.style.width  = `${Math.round(r.width)}px`;
    this._outline.style.height = `${Math.round(r.height)}px`;
    this._outline.style.transform = `translate3d(${Math.round(r.left)}px, ${Math.round(r.top)}px, 0)`;
  }

  // ---------- input ----------

  handleClick(el, ev) {
    if (ev && typeof ev.preventDefault === 'function')  ev.preventDefault();
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();

    if (this._mode === 'inspect') {
      this._onEmit({ kind: 'inspect-click', target: el });
      return;
    }

    const detail = this._lastDetail?.detail || this._detect(el);
    this.pin();
    this._onEmit({ kind: 'hover-click', target: el, detail });
  }

  handleKey(ev) {
    if (!ev) return;
    if (ev.key === 'Escape') {
      if (this._pinned) { this.unpin(); return; }
      if (this._mode === 'inspect') { this.setMode('hover'); return; }
    }
  }
}
