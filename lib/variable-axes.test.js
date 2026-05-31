import { describe, it, expect, beforeEach } from 'vitest';
import { detectAxes } from './variable-axes.js';

function mockFontFaceSet(faces) {
  return {
    [Symbol.iterator]() {
      let i = 0;
      return { next() { return i < faces.length ? { value: faces[i++], done: false } : { done: true }; } };
    },
  };
}

function injectStyle(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

beforeEach(() => { document.head.innerHTML = ''; });

describe('detectAxes', () => {
  it('returns isVariable=false when no matching face exists', () => {
    const out = detectAxes('Nope', mockFontFaceSet([]), document);
    expect(out.isVariable).toBe(false);
    expect(out.axes).toBe(null);
  });

  it('detects variable from a FontFace with variationSettings', () => {
    const face = { family: 'Inter', variationSettings: '"wght" 450, "opsz" 24' };
    injectStyle(`
      @font-face {
        font-family: "Inter";
        src: url('/x.woff2') format('woff2-variations');
        font-weight: 100 900;
        font-stretch: 75% 125%;
      }
    `);
    const out = detectAxes('Inter', mockFontFaceSet([face]), document, { weight: 450, stretch: '100%', style: 'normal' });
    expect(out.isVariable).toBe(true);
    expect(out.axes.wght).toEqual({ min: 100, max: 900, current: 450 });
    expect(out.axes.wdth).toEqual({ min: 75, max: 125, current: 100 });
    expect(out.axes.opsz.current).toBe(24);
  });

  it('detects variable from font-weight range alone', () => {
    injectStyle(`
      @font-face {
        font-family: "Recursive";
        src: url('/r.woff2') format('woff2');
        font-weight: 300 1000;
      }
    `);
    const out = detectAxes('Recursive', mockFontFaceSet([]), document, { weight: 500 });
    expect(out.isVariable).toBe(true);
    expect(out.axes.wght).toEqual({ min: 300, max: 1000, current: 500 });
  });

  it('detects slnt from font-style oblique range', () => {
    injectStyle(`
      @font-face {
        font-family: "Slanty";
        src: url('/s.woff2') format('woff2');
        font-style: oblique 0deg 14deg;
      }
    `);
    const out = detectAxes('Slanty', mockFontFaceSet([]), document, { style: 'oblique 7deg' });
    expect(out.isVariable).toBe(true);
    expect(out.axes.slnt.min).toBe(0);
    expect(out.axes.slnt.max).toBe(14);
    expect(out.axes.slnt.current).toBe(7);
  });

  it('returns isVariable=false for a non-variable face with single weight', () => {
    injectStyle(`
      @font-face {
        font-family: "Static";
        src: url('/s.woff2') format('woff2');
        font-weight: 400;
      }
    `);
    const out = detectAxes('Static', mockFontFaceSet([]), document, { weight: 400 });
    expect(out.isVariable).toBe(false);
  });

  it('matches family case-insensitively and strips quotes', () => {
    const face = { family: '"Inter"', variationSettings: '"wght" 600' };
    injectStyle(`
      @font-face {
        font-family: "Inter";
        src: url('/x.woff2') format('woff2');
        font-weight: 100 900;
      }
    `);
    const out = detectAxes('inter', mockFontFaceSet([face]), document, { weight: 600 });
    expect(out.isVariable).toBe(true);
  });
});
