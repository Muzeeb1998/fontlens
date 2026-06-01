import { describe, it, expect } from 'vitest';
import { resolveFont } from './resolver.js';

const google = {
  'Inter':       { c: 'sans-serif', w: [100, 400, 700, 900] },
  'Playfair Display': { c: 'serif', w: [400, 700, 900] },
  'JetBrains Mono':   { c: 'monospace', w: [400, 700] },
};

const paid = {
  '_meta': { purpose: 'test' },
  'Söhne':  { foundry: 'Klim Type Foundry', url: 'https://klim.co.nz/retail-fonts/soehne/' },
  'Gotham': { foundry: 'Hoefler&Co',        url: 'https://www.typography.com/fonts/gotham/' },
};

const det = (overrides = {}) => ({
  requested: ['Inter', 'sans-serif'],
  rendered: 'Inter',
  isFallback: false,
  source: { type: 'self-hosted', format: 'woff2', url: 'https://x/y.woff2', os: null },
  isVariable: false, axes: null,
  metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(0,0,0)', hex: '#000000' } },
  confidence: 'high',
  ...overrides,
});

describe('resolveFont — google', () => {
  it('resolves Inter to Google Fonts with specimen URL', () => {
    const r = resolveFont(det(), { google, paid });
    expect(r.kind).toBe('google');
    expect(r.name).toBe('Inter');
    expect(r.category).toBe('sans-serif');
    expect(r.weights).toEqual([100, 400, 700, 900]);
    expect(r.specimenUrl).toBe('https://fonts.google.com/specimen/Inter');
    expect(r.slug).toBe('Inter');
  });

  it('case-insensitive lookup, preserves canonical name', () => {
    const r = resolveFont(det({ rendered: 'inter' }), { google, paid });
    expect(r.kind).toBe('google');
    expect(r.name).toBe('Inter');
  });

  it('encodes multi-word family name to slug with +', () => {
    const r = resolveFont(det({ rendered: 'Playfair Display' }), { google, paid });
    expect(r.kind).toBe('google');
    expect(r.specimenUrl).toBe('https://fonts.google.com/specimen/Playfair+Display');
    expect(r.slug).toBe('Playfair+Display');
  });

  it('strips quotes from rendered name', () => {
    const r = resolveFont(det({ rendered: '"Inter"' }), { google, paid });
    expect(r.kind).toBe('google');
    expect(r.name).toBe('Inter');
  });
});

describe('resolveFont — paid', () => {
  it('resolves Söhne to Klim foundry URL', () => {
    const r = resolveFont(det({ rendered: 'Söhne' }), { google, paid });
    expect(r.kind).toBe('paid');
    expect(r.name).toBe('Söhne');
    expect(r.foundry).toBe('Klim Type Foundry');
    expect(r.url).toBe('https://klim.co.nz/retail-fonts/soehne/');
  });

  it('skips _meta entries — never returns kind:paid for them', () => {
    const r = resolveFont(det({
      rendered: '_meta',
      source: { type: 'unknown', format: null, url: null, os: null },
    }), { google, paid });
    expect(r.kind).not.toBe('paid');
  });

  it('google takes precedence over paid when both list a name', () => {
    const both = {
      paid: { ...paid, 'Inter': { foundry: 'Imposter Inc', url: 'https://x' } },
      google,
    };
    const r = resolveFont(det({ rendered: 'Inter' }), both);
    expect(r.kind).toBe('google');
  });
});

describe('resolveFont — system', () => {
  it('honors source.type === "system"', () => {
    const r = resolveFont(det({
      rendered: 'San Francisco',
      source: { type: 'system', format: null, url: null, os: 'macos' },
    }), { google, paid });
    expect(r.kind).toBe('system');
    expect(r.os).toBe('macos');
  });

  it('falls back to a bare system-font name even when source.type missing', () => {
    const r = resolveFont(det({
      rendered: 'Helvetica',
      source: { type: 'unknown', format: null, url: null, os: null },
    }), { google, paid });
    expect(r.kind).toBe('system');
  });
});

describe('resolveFont — selfhosted', () => {
  it('preserves @font-face url when no other match', () => {
    const r = resolveFont(det({
      rendered: 'Custom Brand Sans',
      source: { type: 'self-hosted', format: 'woff2', url: 'https://cdn.example.com/brand.woff2', os: null },
    }), { google, paid });
    expect(r.kind).toBe('selfhosted');
    expect(r.url).toBe('https://cdn.example.com/brand.woff2');
    expect(r.format).toBe('woff2');
  });
});

describe('resolveFont — unknown', () => {
  it('falls back to unknown when no signal matches', () => {
    const r = resolveFont(det({
      rendered: 'Mystery Face',
      source: { type: 'unknown', format: null, url: null, os: null },
    }), { google, paid });
    expect(r.kind).toBe('unknown');
    expect(r.name).toBe('Mystery Face');
  });

  it('returns unknown for empty rendered', () => {
    const r = resolveFont(det({ rendered: null }), { google, paid });
    expect(r.kind).toBe('unknown');
  });
});
