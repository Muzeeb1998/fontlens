import { describe, it, expect } from 'vitest';
import { verdict } from './install.js';

const url = 'chrome-extension://abc/onboarding/demo.html';

describe('install.verdict', () => {
  it('opens the demo on first install', async () => {
    const v = await verdict({ reason: 'install' }, {
      storageGet: async () => undefined,
      demoUrl: url,
    });
    expect(v).toEqual({ action: 'open-demo', url });
  });

  it('does nothing on update', async () => {
    const v = await verdict({ reason: 'update' }, {
      storageGet: async () => undefined,
      demoUrl: url,
    });
    expect(v.action).toBe('noop');
    expect(v.reason).toBe('update');
  });

  it('does nothing on chrome_update', async () => {
    const v = await verdict({ reason: 'chrome_update' }, {
      storageGet: async () => undefined,
      demoUrl: url,
    });
    expect(v.action).toBe('noop');
  });

  it('does nothing when already-installed flag is set', async () => {
    const v = await verdict({ reason: 'install' }, {
      storageGet: async (k) => k === 'fontlens.installed' ? true : undefined,
      demoUrl: url,
    });
    expect(v.action).toBe('noop');
    expect(v.reason).toBe('already-installed');
  });
});
