import { describe, it, expect } from 'vitest';
import { toTokenDoc, toTailwindConfig, tokenFilename } from './tokens-export.js';

const payload = {
  hostname: 'stripe.com',
  totalNodes: 200,
  truncated: false,
  groups: [
    {
      family: 'Söhne',
      source: { type: 'self-hosted', format: 'woff2' },
      isFallback: false,
      isVariable: false,
      axes: null,
      rows: [
        {
          key: 'Söhne|16px|400|24px|normal|none|#222222',
          role: 'Body',
          count: 142,
          nodeIds: [1, 2],
          detail: {
            requested: ['Söhne', 'Arial'],
            rendered: 'Söhne',
            isFallback: false,
            source: { type: 'self-hosted', format: 'woff2', url: null, os: null },
            isVariable: false, axes: null,
            metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(34,34,34)', hex: '#222222' } },
            confidence: 'high',
          },
        },
        {
          key: 'Söhne|28px|600|32px|normal|none|#0f0f10',
          role: 'Headline',
          count: 12,
          nodeIds: [3],
          detail: {
            requested: ['Söhne'],
            rendered: 'Söhne',
            isFallback: false,
            source: { type: 'self-hosted', format: 'woff2', url: null, os: null },
            isVariable: false, axes: null,
            metrics: { size: '28px', weight: 600, lineHeight: '32px', letterSpacing: '-0.02em', transform: 'uppercase', color: { rgb: 'rgb(15,15,16)', hex: '#0f0f10' } },
            confidence: 'high',
          },
        },
      ],
    },
  ],
};

describe('toTokenDoc', () => {
  it('emits the FontLens v1 schema with site + counts', () => {
    const doc = toTokenDoc(payload, { generatedAt: '2026-06-02T00:00:00Z' });
    expect(doc.$schema).toBe('fontlens/v1');
    expect(doc.site).toBe('stripe.com');
    expect(doc.generatedAt).toBe('2026-06-02T00:00:00Z');
    expect(doc.fontCount).toBe(1);
    expect(doc.styleCount).toBe(2);
  });

  it('maps each row to a style with normalized fields', () => {
    const doc = toTokenDoc(payload);
    const body = doc.fonts[0].styles[0];
    expect(body.role).toBe('Body');
    expect(body.fontFamily).toBe('Söhne');
    expect(body.fontSize).toBe('16px');
    expect(body.fontWeight).toBe(400);
    expect(body.lineHeight).toBe('24px');
    expect(body.letterSpacing).toBe('0'); // 'normal' normalized
    expect(body.color).toBe('#222222');
    expect(body.usageCount).toBe(142);
    expect(body.textTransform).toBeUndefined(); // 'none' stripped
  });

  it('keeps non-default textTransform', () => {
    const doc = toTokenDoc(payload);
    const head = doc.fonts[0].styles[1];
    expect(head.textTransform).toBe('uppercase');
    expect(head.letterSpacing).toBe('-0.02em');
  });

  it('handles empty payload', () => {
    const doc = toTokenDoc({ hostname: 'x', groups: [] });
    expect(doc.fontCount).toBe(0);
    expect(doc.styleCount).toBe(0);
    expect(doc.fonts).toEqual([]);
  });
});

describe('toTailwindConfig', () => {
  it('produces theme.extend.fontFamily + fontSize', () => {
    const cfg = toTailwindConfig(payload);
    const famKeys = Object.keys(cfg.theme.extend.fontFamily);
    expect(famKeys.length).toBe(1);                       // one family (Söhne → slug)
    expect(cfg.theme.extend.fontFamily[famKeys[0]][0]).toBe('Söhne'); // first entry keeps real name
    const sizeKeys = Object.keys(cfg.theme.extend.fontSize);
    expect(sizeKeys.length).toBe(2); // body + headline
    // each value is [size, opts]
    const first = cfg.theme.extend.fontSize[sizeKeys[0]];
    expect(Array.isArray(first)).toBe(true);
    expect(typeof first[0]).toBe('string');
    expect(typeof first[1]).toBe('object');
  });
});

describe('tokenFilename', () => {
  it('builds a safe json filename from hostname', () => {
    expect(tokenFilename(payload, 'json')).toBe('fontlens-stripe.com-tokens.json');
  });
  it('builds a tailwind filename', () => {
    expect(tokenFilename(payload, 'tailwind')).toBe('fontlens-stripe.com-tailwind.json');
  });
  it('falls back to "page" when hostname missing', () => {
    expect(tokenFilename({}, 'json')).toBe('fontlens-page-tokens.json');
  });
});
