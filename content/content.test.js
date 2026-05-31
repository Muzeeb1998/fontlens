globalThis.__FONTLENS_TEST__ = true;

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContentScript } from './content.js';

const fakeDetect = vi.fn((el) => ({
  requested: ['Inter', 'sans-serif'],
  rendered: 'Inter',
  isFallback: false,
  source: { type: 'self-hosted', format: 'woff2', url: null, os: null },
  isVariable: false, axes: null,
  metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(0,0,0)', hex: '#000' } },
  confidence: 'high',
}));

function fakeMessaging() {
  const handlers = [];
  return {
    onMessage(fn) { handlers.push(fn); },
    sendMessage: vi.fn(),
    _emit(msg) { handlers.forEach(h => h(msg)); },
  };
}

let cs;

beforeEach(() => {
  document.body.innerHTML = '';
  fakeDetect.mockClear();
});

afterEach(() => {
  if (cs) { cs.disable(); cs = null; }
});

describe('ContentScript — wiring', () => {
  it('enables hover mode by default and mounts the overlay', () => {
    const msg = fakeMessaging();
    cs = new ContentScript({ detect: fakeDetect, messaging: msg, raf: (fn) => fn(0) });
    cs.enable();
    expect(document.body.querySelector('fontlens-overlay')).toBeTruthy();
    expect(cs.overlay.getMode()).toBe('hover');
  });

  it('disable() unmounts the overlay and removes listeners', () => {
    const msg = fakeMessaging();
    cs = new ContentScript({ detect: fakeDetect, messaging: msg, raf: (fn) => fn(0) });
    cs.enable();
    cs.disable();
    expect(document.body.querySelector('fontlens-overlay')).toBeNull();
  });

  it('switches mode in response to runtime messages', () => {
    const msg = fakeMessaging();
    cs = new ContentScript({ detect: fakeDetect, messaging: msg, raf: (fn) => fn(0) });
    cs.enable();
    msg._emit({ type: 'fontlens.mode', mode: 'inspect' });
    expect(cs.overlay.getMode()).toBe('inspect');
  });

  it('throttles mousemove to one render per animation frame', () => {
    const msg = fakeMessaging();
    const rafCalls = [];
    const raf = (fn) => { rafCalls.push(fn); return rafCalls.length; };
    cs = new ContentScript({ detect: fakeDetect, messaging: msg, raf });
    cs.enable();

    const p = document.createElement('p');
    p.textContent = 'hello';
    document.body.appendChild(p);
    document.elementFromPoint = () => p;

    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10 + i, clientY: 20 }));
    }
    expect(rafCalls.length).toBe(1);

    rafCalls[0](0);
    expect(fakeDetect).toHaveBeenCalledTimes(1);
  });

  it('click on a text element in hover mode emits via messaging', () => {
    const msg = fakeMessaging();
    cs = new ContentScript({ detect: fakeDetect, messaging: msg, raf: (fn) => fn(0) });
    cs.enable();

    const p = document.createElement('p');
    p.textContent = 'hello';
    document.body.appendChild(p);
    document.elementFromPoint = () => p;

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 20 }));

    const click = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 });
    window.dispatchEvent(click);

    expect(msg.sendMessage).toHaveBeenCalled();
    const [arg] = msg.sendMessage.mock.calls[0];
    expect(arg.type).toBe('fontlens.row');
    expect(arg.kind).toBe('hover-click');
    expect(arg.detail.rendered).toBe('Inter');
  });

  it('click in inspect mode does not navigate the page (preventDefault)', () => {
    const msg = fakeMessaging();
    cs = new ContentScript({ detect: fakeDetect, messaging: msg, raf: (fn) => fn(0) });
    cs.enable();
    msg._emit({ type: 'fontlens.mode', mode: 'inspect' });

    const a = document.createElement('a');
    a.href = 'https://example.com/';
    a.textContent = 'link';
    document.body.appendChild(a);
    document.elementFromPoint = () => a;

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    window.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
  });

  it('Esc keydown unpins the chip', () => {
    const msg = fakeMessaging();
    cs = new ContentScript({ detect: fakeDetect, messaging: msg, raf: (fn) => fn(0) });
    cs.enable();

    const p = document.createElement('p');
    p.textContent = 'hi';
    document.body.appendChild(p);
    cs.overlay.show(p, { x: 0, y: 0 });
    cs.overlay.pin();
    expect(cs.overlay.isPinned()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cs.overlay.isPinned()).toBe(false);
  });
});
