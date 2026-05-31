import { describe, it, expect } from 'vitest';
import { parseStack, isGeneric } from './parse-stack.js';

describe('parseStack', () => {
  it('splits a quoted multi-family stack', () => {
    expect(parseStack('"Söhne", Arial, sans-serif'))
      .toEqual(['Söhne', 'Arial', 'sans-serif']);
  });

  it('handles single-quoted names', () => {
    expect(parseStack("'Iowan Old Style', Georgia, serif"))
      .toEqual(['Iowan Old Style', 'Georgia', 'serif']);
  });

  it('trims whitespace', () => {
    expect(parseStack('   Helvetica   ,   Arial   '))
      .toEqual(['Helvetica', 'Arial']);
  });

  it('keeps an unquoted multi-word family that has no commas around it intact', () => {
    expect(parseStack('Times New Roman, serif'))
      .toEqual(['Times New Roman', 'serif']);
  });

  it('handles a system stack', () => {
    expect(parseStack('-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto'))
      .toEqual(['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto']);
  });

  it('returns a single-element array for one family', () => {
    expect(parseStack('Arial')).toEqual(['Arial']);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseStack('')).toEqual([]);
  });
});

describe('isGeneric', () => {
  it.each([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
    'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace',
    'ui-rounded', 'math', 'emoji', 'fangsong',
  ])('flags %s as generic', (name) => {
    expect(isGeneric(name)).toBe(true);
  });

  it('does not flag a real family as generic', () => {
    expect(isGeneric('Helvetica')).toBe(false);
    expect(isGeneric('Söhne')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isGeneric('SERIF')).toBe(true);
    expect(isGeneric('Sans-Serif')).toBe(true);
  });
});
