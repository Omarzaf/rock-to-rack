import { describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './registerServiceWorker';

describe('registerServiceWorker', () => {
  it('does not register outside production mode', () => {
    const register = vi.fn();
    registerServiceWorker(false, { serviceWorker: { register } } as unknown as Navigator);

    expect(register).not.toHaveBeenCalled();
  });

  it('registers sw.js in production when available', () => {
    const register = vi.fn();
    registerServiceWorker(true, { serviceWorker: { register } } as unknown as Navigator);

    expect(register).toHaveBeenCalledWith('/sw.js');
  });
});
