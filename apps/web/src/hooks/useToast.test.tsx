import { renderHook } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/toast';
import type { ToastContextValue } from '@/components/toast/ToastContext';
import { TranslateProvider } from '@/i18n';

import { useToast } from './useToast';

describe('useToast', (): void => {
  it('throws when used outside ToastProvider', (): void => {
    // React reports the error thrown while rendering; keep the test output clean
    vi.spyOn(console, 'error').mockImplementation((): void => undefined);

    expect(() => renderHook(() => useToast())).toThrow(
      'useToast must be used inside ToastProvider',
    );
  });

  it('returns the toast functions inside ToastProvider', (): void => {
    const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
      <TranslateProvider>
        <ToastProvider>{children}</ToastProvider>
      </TranslateProvider>
    );
    const { result } = renderHook((): ToastContextValue => useToast(), {
      wrapper,
    });

    expect(typeof result.current.success).toBe('function');
    expect(typeof result.current.info).toBe('function');
    expect(typeof result.current.warning).toBe('function');
    expect(typeof result.current.error).toBe('function');
    expect(typeof result.current.dismiss).toBe('function');
  });
});
