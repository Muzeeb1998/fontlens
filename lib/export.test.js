import { describe, it, expect } from 'vitest';
import { toCSS, toTailwind, toTailwindStructured, toToken } from './export.js';

const baseDetail = {
  requested: ['Söhne', 'Arial', 'sans-serif'],
  rendered: 'Söhne',
  isFallback: false,
  source: { type: 'self-hosted', format: 'woff2', url: 'https://x/y.woff2', os: null },
  isVariable: false,
  axes: null,
  metrics: {
    size: '16px',
    weight: 400,
    lineHeight: '24px',
    letterSpacing: 'normal',
    transform: 'none',
    color: { rgb: 'rgb(34, 34, 34)', hex: '#222222' },
  },
  confidence: 'high',
};

describe('toCSS', () => {
  it('emits a clean CSS block with quoted family', () => {
    const css = toCSS(baseDetail);
    expect(css).toMatch(/font-family:\s*"Söhne", Arial, sans-serif;/);
    expect(css).toMatch(/font-weight:\s*400;/);
    expect(css).toMatch(/font-size:\s*16px;/);
    expect(css).toMatch(/line-height:\s*24px;/);
    expect(css).toMatch(/letter-spacing:\s*normal;/);
    expect(css).toMatch(/color:\s*#222222;/);
  });

  it('omits text-transform when value is none', () => {
    expect(toCSS(baseDetail)).not.toMatch(/text-transform/);
  });

  it('emits text-transform when non-default', () => {
    const d = { ...baseDetail, metrics: { ...baseDetail.metrics, transform: 'uppercase' } };
    expect(toCSS(d)).toMatch(/text-transform:\s*uppercase;/);
  });

  it('adds a fallback comment when isFallback is true', () => {
    const d = { ...baseDetail, isFallback: true, rendered: 'Arial' };
    expect(toCSS(d)).toMatch(/\/\* fallback: Arial \*\//);
  });

  it('does not quote families that are bare ASCII single words', () => {
    const d = { ...baseDetail, requested: ['Arial', 'sans-serif'] };
    expect(toCSS(d)).toMatch(/font-family:\s*Arial, sans-serif;/);
  });
});

describe('toTailwind', () => {
  it('maps default-scale values to utilities, no approximate flag', () => {
    const out = toTailwindStructured(baseDetail);
    expect(out.classes).toContain('font-sans');
    expect(out.classes).toContain('font-normal');
    expect(out.classes).toContain('text-base');
    expect(out.classes).toContain('leading-6');
    expect(out.classes).toContain('tracking-normal');
    expect(out.classes).toContain('text-[#222222]');
    expect(out.approximate).toBe(false);
  });

  it('falls back to arbitrary-value form and flags approximate', () => {
    const d = {
      ...baseDetail,
      metrics: { ...baseDetail.metrics, size: '17px', weight: 450, lineHeight: '26px' },
    };
    const out = toTailwindStructured(d);
    expect(out.classes).toContain('text-[17px]');
    expect(out.classes).toContain('font-[450]');
    expect(out.classes).toContain('leading-[26px]');
    expect(out.approximate).toBe(true);
  });

  it('chooses font-mono when stack contains a mono family', () => {
    const d = { ...baseDetail, requested: ['SF Mono', 'Menlo', 'monospace'] };
    expect(toTailwindStructured(d).classes).toContain('font-mono');
  });

  it('chooses font-serif when stack contains a serif family', () => {
    const d = { ...baseDetail, requested: ['Iowan Old Style', 'Georgia', 'serif'] };
    expect(toTailwindStructured(d).classes).toContain('font-serif');
  });

  it('flattens to a string in toTailwind()', () => {
    expect(typeof toTailwind(baseDetail)).toBe('string');
    expect(toTailwind(baseDetail)).toMatch(/\bfont-sans\b/);
    expect(toTailwind(baseDetail)).toMatch(/\btext-base\b/);
  });

  it('tolerates 0.5px slop on line-height before going arbitrary', () => {
    const d = { ...baseDetail, metrics: { ...baseDetail.metrics, lineHeight: '23.99px' } };
    expect(toTailwindStructured(d).classes).toContain('leading-6');
  });
});

describe('toToken', () => {
  it('returns a plain object (not a string)', () => {
    const t = toToken(baseDetail);
    expect(typeof t).toBe('object');
    expect(t.fontFamily).toBe('Söhne');
    expect(t.fontWeight).toBe(400);
    expect(t.fontSize).toBe('16px');
    expect(t.lineHeight).toBe('24px');
    expect(t.letterSpacing).toBe('0');
    expect(t.color).toBe('#222222');
  });

  it('normalises letter-spacing "normal" to "0"', () => {
    expect(toToken(baseDetail).letterSpacing).toBe('0');
  });

  it('uses the first non-generic family, not a generic keyword', () => {
    const d = { ...baseDetail, requested: ['sans-serif'] };
    expect(toToken(d).fontFamily).toBe('sans-serif');
  });

  it('includes axes when variable, current values only (no ranges)', () => {
    const d = {
      ...baseDetail,
      isVariable: true,
      axes: { wght: { min: 100, max: 900, current: 450 }, opsz: { min: 6, max: 144, current: 24 } },
    };
    const t = toToken(d);
    expect(t.axes).toEqual({ wght: 450, opsz: 24 });
  });
});
