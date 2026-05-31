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

  it('hide() hides the chip and clears state', () => {
    const chip = mountWith(baseDetail());
    overlay.hide();
    expect(chip.style.display).toBe('none');
  });

  it('does not hide the chip when pinned', () => {
    const chip = mountWith(baseDetail());
    overlay.pin();
    overlay.hide();
    expect(chip.style.display).not.toBe('none');
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
    // y = 790 - 80 (h) - 18 (offsetY) = 692
    expect(chip.style.transform).toBe('translate3d(114px, 692px, 0)');
  });

  it('move() is a no-op when pinned', () => {
    const chip = makeReady({ w: 180, h: 60 });
    overlay.move({ x: 100, y: 100 });
    const before = chip.style.transform;
    overlay.pin();
    overlay.move({ x: 500, y: 500 });
    expect(chip.style.transform).toBe(before);
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

  it('handleClick in hover mode emits hover-click but does NOT pin (keeps cursor-follow alive)', () => {
    const onEmit = vi.fn();
    overlay = new Overlay({ detect: fakeDetect, onEmit });
    overlay.mount();
    overlay.setMode('hover');
    const el = document.createElement('p');
    overlay.show(el, { x: 100, y: 100 });

    let prevented = false;
    const ev = {
      preventDefault: () => { prevented = true; },
      stopPropagation: () => {},
    };

    overlay.handleClick(el, ev);

    expect(overlay.isPinned()).toBe(false);  // chip keeps following cursor
    expect(onEmit).toHaveBeenCalledTimes(1);
    expect(onEmit.mock.calls[0][0]).toMatchObject({ kind: 'hover-click' });
    expect(onEmit.mock.calls[0][0].detail.rendered).toBe('Inter');
    expect(prevented).toBe(true);
  });

  it('Shift+click in hover mode pins the chip (explicit pin gesture)', () => {
    const onEmit = vi.fn();
    overlay = new Overlay({ detect: fakeDetect, onEmit });
    overlay.mount();
    overlay.setMode('hover');
    const el = document.createElement('p');
    overlay.show(el, { x: 100, y: 100 });

    const ev = { shiftKey: true, preventDefault: () => {}, stopPropagation: () => {} };
    overlay.handleClick(el, ev);

    expect(overlay.isPinned()).toBe(true);
    expect(onEmit).toHaveBeenCalledTimes(1);
  });

  it('handleClick in inspect mode emits inspect-click and prevents host navigation', () => {
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
    expect(prevented).toBe(true);
    expect(stopped).toBe(true);
  });

  it('Esc unpins the chip via handleKey', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.setMode('hover');
    overlay.show(document.createElement('p'), { x: 100, y: 100 });
    overlay.pin();
    expect(overlay.isPinned()).toBe(true);

    overlay.handleKey({ key: 'Escape' });
    expect(overlay.isPinned()).toBe(false);
  });

  it('Esc also exits inspect mode back to hover', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.setMode('inspect');
    overlay.handleKey({ key: 'Escape' });
    expect(overlay.getMode()).toBe('hover');
  });
});
