globalThis.__FONTLENS_TEST__ = true;

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Overlay } from './overlay.js';

const fakeDetect = vi.fn(() => ({
  requested: ['Inter', 'sans-serif'],
  rendered: 'Inter',
  isFallback: false,
  source: { type: 'self-hosted', format: 'woff2', url: '/x.woff2', os: null },
  isVariable: false,
  axes: null,
  metrics: {
    size: '16px', weight: 400, lineHeight: '24px',
    letterSpacing: 'normal', transform: 'none',
    color: { rgb: 'rgb(34,34,34)', hex: '#222222' },
  },
  confidence: 'high',
}));

let overlay;

beforeEach(() => {
  document.body.innerHTML = '';
  fakeDetect.mockClear();
});

afterEach(() => {
  if (overlay) { overlay.unmount(); overlay = null; }
});

describe('Overlay — mount/unmount', () => {
  it('attaches a single shadow host to document.body', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    const hosts = document.body.querySelectorAll('fontlens-overlay');
    expect(hosts.length).toBe(1);
    expect(hosts[0].shadowRoot).toBeTruthy();
  });

  it('attaches to documentElement when body is missing', () => {
    const body = document.body;
    body.remove();
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    const hosts = document.documentElement.querySelectorAll('fontlens-overlay');
    expect(hosts.length).toBe(1);
    document.documentElement.appendChild(body);
  });

  it('mount() is idempotent — calling twice keeps one host', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.mount();
    expect(document.body.querySelectorAll('fontlens-overlay').length).toBe(1);
  });

  it('unmount() removes the host', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.unmount();
    expect(document.body.querySelectorAll('fontlens-overlay').length).toBe(0);
  });

  it('unmount() is safe to call twice', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.unmount();
    expect(() => overlay.unmount()).not.toThrow();
  });

  it('injects a <style> child into the shadow root', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    const host = document.body.querySelector('fontlens-overlay');
    const styles = host.shadowRoot.querySelectorAll('style');
    expect(styles.length).toBeGreaterThanOrEqual(1);
    expect(styles[0].textContent).toContain('.chip');
  });

  it('renders the chip element hidden by default', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    const host = document.body.querySelector('fontlens-overlay');
    const chip = host.shadowRoot.querySelector('.chip');
    expect(chip).toBeTruthy();
    expect(chip.style.display).toBe('none');
  });
});

describe('Overlay — chip render', () => {
  function mountWith(detectResult) {
    const det = vi.fn(() => detectResult);
    overlay = new Overlay({ detect: det, onEmit: () => {} });
    overlay.mount();
    overlay.show(document.createElement('p'), { x: 100, y: 100 });
    return overlay._chip;
  }

  const baseDetail = (overrides = {}) => ({
    requested: ['Inter', 'sans-serif'],
    rendered: 'Inter',
    isFallback: false,
    source: { type: 'self-hosted', format: 'woff2', url: null, os: null },
    isVariable: false, axes: null,
    metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(0,0,0)', hex: '#000000' } },
    confidence: 'high',
    ...overrides,
  });

  it('renders rendered face on line 1 (bold)', () => {
    const chip = mountWith(baseDetail());
    expect(chip.style.display).not.toBe('none');
    expect(chip.querySelector('.line1').textContent).toBe('Inter');
  });

  it('renders metrics line 2 as size · weight · lh/size', () => {
    const chip = mountWith(baseDetail());
    expect(chip.querySelector('.line2').textContent).toBe('16px · 400 · 24/16');
  });

  it('shows amber dot + fallback + requested rows when isFallback', () => {
    const chip = mountWith(baseDetail({
      requested: ['Söhne', 'Arial', 'sans-serif'],
      rendered: 'Arial', isFallback: true,
      source: { type: 'system', format: null, url: null, os: null },
    }));
    expect(chip.querySelector('.dot')).toBeTruthy();
    expect(chip.querySelector('.fallback').textContent).toContain('fallback');
    expect(chip.querySelector('.requested').textContent).toBe('requested: Söhne');
  });

  it('hides fallback rows when isFallback is false', () => {
    const chip = mountWith(baseDetail());
    expect(chip.querySelector('.fallback')).toBeNull();
    expect(chip.querySelector('.requested')).toBeNull();
  });

  it('shows low-confidence row when confidence === "low"', () => {
    const chip = mountWith(baseDetail({ confidence: 'low' }));
    expect(chip.querySelector('.lowconf').textContent).toContain("couldn't confirm");
  });

  it('renders an em dash when rendered is null', () => {
    const chip = mountWith(baseDetail({
      requested: ['Mystery'], rendered: null,
      source: { type: 'system', format: null, url: null, os: 'unknown' },
      confidence: 'low',
    }));
    expect(chip.querySelector('.line1').textContent).toBe('—');
  });

  it('hide() hides the floating chip', () => {
    const chip = mountWith(baseDetail());
    overlay.hide();
    expect(chip.style.display).toBe('none');
  });

  it('hideIfFloating() hides the chip but leaves pinned cards alone', () => {
    const chip = mountWith(baseDetail());
    overlay.pinCard(baseDetail(), { x: 10, y: 10 });
    overlay.hideIfFloating();
    expect(chip.style.display).toBe('none');
    expect(overlay.pinCount()).toBe(1);
  });
});

describe('Overlay — positioning', () => {
  function makeReady(rect) {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.show(document.createElement('p'), { x: 0, y: 0 });
    overlay._chip.getBoundingClientRect = () => ({ width: rect.w, height: rect.h, top: 0, left: 0, right: rect.w, bottom: rect.h });
    return overlay._chip;
  }

  it('places chip below-right of cursor by default', () => {
    const chip = makeReady({ w: 180, h: 60 });
    Object.defineProperty(window, 'innerWidth',  { value: 1200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value:  800, configurable: true });

    overlay.move({ x: 100, y: 100 });
    expect(chip.style.transform).toBe('translate3d(114px, 118px, 0)');
  });

  it('flips left when cursor is near the right edge', () => {
    const chip = makeReady({ w: 200, h: 60 });
    Object.defineProperty(window, 'innerWidth',  { value: 1200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value:  800, configurable: true });

    overlay.move({ x: 1190, y: 100 });
    expect(chip.style.transform).toBe('translate3d(976px, 118px, 0)');
  });

  it('flips up when cursor is near the bottom edge', () => {
    const chip = makeReady({ w: 180, h: 80 });
    Object.defineProperty(window, 'innerWidth',  { value: 1200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value:  800, configurable: true });

    overlay.move({ x: 100, y: 790 });
    expect(chip.style.transform).toBe('translate3d(114px, 692px, 0)');
  });

  it('chip follows the cursor on the same element (no freeze/lag)', () => {
    const chip = makeReady({ w: 180, h: 60 });
    overlay.move({ x: 100, y: 100 });
    const before = chip.style.transform;
    overlay.move({ x: 500, y: 500 });
    expect(chip.style.transform).not.toBe(before);
  });
});

describe('Overlay — modes + emission', () => {
  it('setMode("inspect") shows the outline and tracks element bounds', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.setMode('inspect');

    const target = document.createElement('p');
    target.getBoundingClientRect = () => ({ x: 50, y: 60, width: 200, height: 40, top: 60, left: 50, right: 250, bottom: 100 });
    document.body.appendChild(target);

    overlay.highlight(target);

    const outline = overlay._outline;
    expect(outline.style.display).not.toBe('none');
    expect(outline.style.transform).toBe('translate3d(50px, 60px, 0)');
    expect(outline.style.width).toBe('200px');
    expect(outline.style.height).toBe('40px');
  });

  it('setMode("hover") hides the outline', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.setMode('inspect');
    overlay.highlight(document.createElement('p'));
    overlay.setMode('hover');
    expect(overlay._outline.style.display).toBe('none');
  });

  it('hover-mode click stamps an expanded card AND emits hover-click', () => {
    const onEmit = vi.fn();
    overlay = new Overlay({ detect: fakeDetect, onEmit });
    overlay.mount();
    overlay.setMode('hover');
    const el = document.createElement('p');
    overlay.show(el, { x: 100, y: 100 });

    let prevented = false;
    const ev = {
      clientX: 100, clientY: 100,
      preventDefault: () => { prevented = true; },
      stopPropagation: () => {},
    };
    overlay.handleClick(el, ev);

    expect(overlay.pinCount()).toBe(1);
    const card = overlay._pins[0];
    expect(card.querySelector('.exp-head')).toBeTruthy();
    expect(card.querySelector('.exp-specimen')).toBeTruthy();
    expect(onEmit).toHaveBeenCalledTimes(1);
    expect(onEmit.mock.calls[0][0]).toMatchObject({ kind: 'hover-click' });
    expect(onEmit.mock.calls[0][0].detail.rendered).toBe('Inter');
    expect(prevented).toBe(true);
  });

  it('ten clicks leave ten cards on screen (WhatFont parity)', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.setMode('hover');
    const el = document.createElement('p');
    for (let i = 0; i < 10; i++) {
      overlay.handleClick(el, { clientX: 10 * i, clientY: 20, preventDefault() {}, stopPropagation() {} });
    }
    expect(overlay.pinCount()).toBe(10);
    expect(overlay._root.querySelectorAll('.card').length).toBe(10);
  });

  it("each card's × close removes only that card", () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.setMode('hover');
    const el = document.createElement('p');
    overlay.handleClick(el, { clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {} });
    overlay.handleClick(el, { clientX: 50, clientY: 50, preventDefault() {}, stopPropagation() {} });
    expect(overlay.pinCount()).toBe(2);

    overlay._pins[0].querySelector('.exp-close').click();
    expect(overlay.pinCount()).toBe(1);
    expect(overlay._root.querySelectorAll('.card').length).toBe(1);
  });

  it('handleClick in inspect mode emits inspect-click, prevents nav, stamps nothing', () => {
    const onEmit = vi.fn();
    overlay = new Overlay({ detect: fakeDetect, onEmit });
    overlay.mount();
    overlay.setMode('inspect');
    const el = document.createElement('a');

    let prevented = false, stopped = false;
    const ev = { preventDefault: () => { prevented = true; }, stopPropagation: () => { stopped = true; } };
    overlay.handleClick(el, ev);

    expect(onEmit).toHaveBeenCalledTimes(1);
    expect(onEmit.mock.calls[0][0]).toMatchObject({ kind: 'inspect-click' });
    expect(overlay.pinCount()).toBe(0);
    expect(prevented).toBe(true);
    expect(stopped).toBe(true);
  });

  it('Esc clears all pinned cards', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.setMode('hover');
    const el = document.createElement('p');
    overlay.handleClick(el, { clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {} });
    overlay.handleClick(el, { clientX: 9, clientY: 9, preventDefault() {}, stopPropagation() {} });
    expect(overlay.pinCount()).toBe(2);

    overlay.handleKey({ key: 'Escape' });
    expect(overlay.pinCount()).toBe(0);
  });

  it('Esc exits inspect mode back to hover (when no pins)', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.setMode('inspect');
    overlay.handleKey({ key: 'Escape' });
    expect(overlay.getMode()).toBe('hover');
  });
});

describe('Overlay — pinned card content', () => {
  function baseDetail(overrides = {}) {
    return {
      requested: ['Inter', 'sans-serif'],
      rendered: 'Inter',
      isFallback: false,
      source: { type: 'self-hosted', format: 'woff2', url: null, os: null },
      isVariable: false, axes: null,
      metrics: {
        size: '16px', weight: 400, lineHeight: '24px',
        letterSpacing: 'normal', transform: 'none',
        color: { rgb: 'rgb(34,34,34)', hex: '#222222' },
      },
      confidence: 'high',
      ...overrides,
    };
  }

  it('compact chip exposes a "View more" button', () => {
    overlay = new Overlay({ detect: () => baseDetail(), onEmit: () => {} });
    overlay.mount();
    overlay.show(document.createElement('p'), { x: 50, y: 50 });
    const more = overlay._chip.querySelector('.viewmore');
    expect(more).toBeTruthy();
    expect(more.textContent).toMatch(/View more/);
  });

  it('clicking "View more" stamps a pinned card', () => {
    overlay = new Overlay({ detect: () => baseDetail(), onEmit: () => {} });
    overlay.mount();
    overlay.show(document.createElement('p'), { x: 50, y: 50 });
    overlay._chip.querySelector('.viewmore').click();
    expect(overlay.pinCount()).toBe(1);
    expect(overlay._pins[0].querySelector('.exp-head')).toBeTruthy();
    expect(overlay._pins[0].querySelector('.exp-color-swatch')).toBeTruthy();
  });

  it('pinned card shows Family/Style/Weight/Color/Size/Line Height labels', () => {
    overlay = new Overlay({ detect: () => baseDetail(), onEmit: () => {} });
    overlay.mount();
    const card = overlay.pinCard(baseDetail(), { x: 50, y: 50 });
    const labels = [...card.querySelectorAll('.exp-label')].map(n => n.textContent.trim());
    expect(labels).toEqual(['Family', 'Style', 'Weight', 'Color', 'Size', 'Line Height']);
  });

  it('value cells carry a title tooltip with the full string (long-family-name fix, TC-B7.2)', () => {
    overlay = new Overlay({ detect: () => baseDetail(), onEmit: () => {} });
    overlay.mount();
    const card = overlay.pinCard(baseDetail({ rendered: 'AVeryLongUnbreakableFontFamilyName' }), { x: 5, y: 5 });
    const familyVal = card.querySelector('.exp-value');
    expect(familyVal.title).toBe('AVeryLongUnbreakableFontFamilyName');
    expect(familyVal.textContent).toContain('AVeryLongUnbreakableFontFamilyName');
  });

  it('color swatch background matches detected hex', () => {
    overlay = new Overlay({ detect: () => baseDetail(), onEmit: () => {} });
    overlay.mount();
    const card = overlay.pinCard(baseDetail(), { x: 5, y: 5 });
    const sw = card.querySelector('.exp-color-swatch');
    expect(sw.style.background || sw.style.backgroundColor).toMatch(/#222222|rgb\(34,\s*34,\s*34\)/i);
  });

  it('same-element re-show does NOT re-run detect (cheap follow)', () => {
    const detect = vi.fn(() => baseDetail());
    overlay = new Overlay({ detect, onEmit: () => {} });
    overlay.mount();
    const el = document.createElement('p');
    overlay.show(el, { x: 100, y: 100 });
    const callsAfterFirst = detect.mock.calls.length;
    overlay.show(el, { x: 300, y: 300 });
    expect(detect.mock.calls.length).toBe(callsAfterFirst);
  });
});
