import { describe, it, expect, beforeEach } from 'vitest';
import { detect, __setRenderDetector, __setPlatform } from './detector.js';

function makeEl(tag, css = {}) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(css)) el.style[k] = v;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  __setRenderDetector(null);
  __setPlatform(null);
});

describe('detect', () => {
  it('returns requested stack, rendered first family, no fallback when face is present', () => {
    __setRenderDetector(() => 'Inter');
    const el = makeEl('p');
    el.style.fontFamily = '"Inter", Arial, sans-serif';
    el.style.fontSize = '16px';

    const out = detect(el);
    expect(out.requested).toEqual(['Inter', 'Arial', 'sans-serif']);
    expect(out.rendered).toBe('Inter');
    expect(out.isFallback).toBe(false);
  });

  it('flags isFallback when the first family does not render and a later one does', () => {
    __setRenderDetector((family) => family === 'Arial');
    const el = makeEl('p');
    el.style.fontFamily = '"Soehne", Arial, sans-serif';

    const out = detect(el);
    expect(out.rendered).toBe('Arial');
    expect(out.isFallback).toBe(true);
  });

  it('does not flag fallback when the first family is a generic keyword', () => {
    __setRenderDetector(() => 'sans-serif');
    const el = makeEl('p');
    el.style.fontFamily = 'sans-serif';

    const out = detect(el);
    expect(out.isFallback).toBe(false);
  });

  it('captures color in both rgb and hex form', () => {
    __setRenderDetector(() => 'Inter');
    const el = makeEl('p');
    el.style.fontFamily = 'Inter';
    el.style.color = 'rgb(34, 34, 34)';

    const out = detect(el);
    expect(out.metrics.color.rgb).toBe('rgb(34, 34, 34)');
    expect(out.metrics.color.hex).toBe('#222222');
  });

  it('marks confidence:low when canvas detector returns null but document.fonts.check would have said yes', () => {
    __setRenderDetector(() => null);
    const el = makeEl('p');
    el.style.fontFamily = 'Inter, sans-serif';

    const out = detect(el);
    expect(out.confidence).toBe('low');
  });

  it('detects a system stack and reports os + friendly name', () => {
    __setRenderDetector(() => null);
    const el = makeEl('p');
    el.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    __setPlatform('macOS');
    const out = detect(el);
    expect(out.source.type).toBe('system');
    expect(out.source.os).toBe('macos');
    expect(out.rendered).toBe('San Francisco');
    expect(out.isFallback).toBe(false);
  });
});
