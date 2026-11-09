import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePanelCollapsed } from './usePanelCollapsed';

type Hook = RenderHookResult<ReturnType<typeof usePanelCollapsed>, unknown>;

/** Makes localStorage throw, as in some private browsing modes. */
function breakStorage(): void {
  const fail = (): never => {
    throw new Error('Storage is disabled');
  };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(fail);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(fail);
}

describe('usePanelCollapsed', (): void => {
  it('starts open', (): void => {
    const { result } = renderHook(() => usePanelCollapsed());

    expect(result.current[0]).toBe(false);
  });

  it('stores the choice and starts from it next time', (): void => {
    const first: Hook = renderHook(() => usePanelCollapsed());
    act(() => {
      first.result.current[1](true);
    });
    expect(first.result.current[0]).toBe(true);
    expect(localStorage.getItem('docscanify.panelCollapsed')).toBe('true');

    const next: Hook = renderHook(() => usePanelCollapsed());
    expect(next.result.current[0]).toBe(true);

    act(() => {
      next.result.current[1](false);
    });
    expect(renderHook(() => usePanelCollapsed()).result.current[0]).toBe(false);
  });

  it('works without storage, starting open', (): void => {
    breakStorage();
    const { result } = renderHook(() => usePanelCollapsed());
    expect(result.current[0]).toBe(false);

    act(() => {
      result.current[1](true);
    });
    expect(result.current[0]).toBe(true);
  });
});
