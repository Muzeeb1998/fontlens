import { describe, it, expect } from 'vitest';
import { styleKey } from './style-key.js';

const m = (over = {}) => ({
  size: '16px', weight: 400, lineHeight: '24px',
  letterSpacing: 'normal', transform: 'none',
  color: { rgb: 'rgb(34,34,34)', hex: '#222222' },
  ...over,
});

describe('styleKey', () => {
  it('joins the canonical fields with pipes', () => {
    expect(styleKey(m(), 'Inter'))
      .toBe('Inter|16px|400|24px|normal|none|#222222');
  });

  it('treats two equal styles as equal keys', () => {
    expect(styleKey(m(), 'Inter')).toBe(styleKey(m(), 'Inter'));
  });

  it('differs when size differs', () => {
    expect(styleKey(m({ size: '14px' }), 'Inter'))
      .not.toBe(styleKey(m({ size: '16px' }), 'Inter'));
  });

  it('differs when family differs', () => {
    expect(styleKey(m(), 'Inter')).not.toBe(styleKey(m(), 'Arial'));
  });

  it('differs when weight differs', () => {
    expect(styleKey(m({ weight: 700 }), 'Inter'))
      .not.toBe(styleKey(m({ weight: 400 }), 'Inter'));
  });

  it('uses "unknown" when rendered is null', () => {
    expect(styleKey(m(), null)).toBe('unknown|16px|400|24px|normal|none|#222222');
  });

  it('uses color.hex regardless of color.rgb formatting', () => {
    const a = styleKey({ ...m(), color: { rgb: 'rgb(34, 34, 34)',  hex: '#222222' } }, 'X');
    const b = styleKey({ ...m(), color: { rgb: 'rgb(34,  34,  34)', hex: '#222222' } }, 'X');
    expect(a).toBe(b);
  });
});
