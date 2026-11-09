import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, type Mock, type MockInstance, vi } from 'vitest';

import { useCommandShortcut } from './useCommandShortcut';

/** Presses a key on the page; returns false when the default was prevented. */
const press = (init: KeyboardEventInit): boolean =>
  fireEvent.keyDown(window, init);

describe('useCommandShortcut', (): void => {
  it('calls the handler on Ctrl + key and prevents the browser default', (): void => {
    const handler: Mock<() => void> = vi.fn();
    renderHook(() => {
      useCommandShortcut('z', handler);
    });

    expect(press({ key: 'z', ctrlKey: true })).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('calls the handler on Cmd + key, as on a Mac', (): void => {
    const handler: Mock<() => void> = vi.fn();
    renderHook(() => {
      useCommandShortcut('z', handler);
    });

    expect(press({ key: 'z', metaKey: true })).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores the case of the key and of the pressed key', (): void => {
    const handler: Mock<() => void> = vi.fn();
    renderHook(() => {
      useCommandShortcut('Z', handler);
    });

    press({ key: 'z', ctrlKey: true });
    press({ key: 'Z', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['without a modifier', { key: 'z' }],
    ['with Shift', { key: 'z', ctrlKey: true, shiftKey: true }],
    ['with Alt', { key: 'z', metaKey: true, altKey: true }],
    ['on another key', { key: 'y', ctrlKey: true }],
  ])(
    'does nothing %s, leaving the browser default alone',
    (_case: string, init: KeyboardEventInit): void => {
      const handler: Mock<() => void> = vi.fn();
      renderHook(() => {
        useCommandShortcut('z', handler);
      });

      expect(press(init)).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it('fires once while the key is held, still preventing the default of repeats', (): void => {
    const handler: Mock<() => void> = vi.fn();
    renderHook(() => {
      useCommandShortcut('z', handler);
    });

    press({ key: 'z', ctrlKey: true });
    expect(press({ key: 'z', ctrlKey: true, repeat: true })).toBe(false);
    expect(press({ key: 'z', ctrlKey: true, repeat: true })).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('responds to the shortcut from a focused element', (): void => {
    const handler: Mock<() => void> = vi.fn();
    renderHook(() => {
      useCommandShortcut('z', handler);
    });
    const button: HTMLButtonElement = document.createElement('button');
    document.body.append(button);
    button.focus();

    fireEvent.keyDown(button, { key: 'z', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    button.remove();
  });

  it('calls the latest handler without registering the listener again', (): void => {
    const addListener: MockInstance<typeof window.addEventListener> = vi.spyOn(
      window,
      'addEventListener',
    );
    const first: Mock<() => void> = vi.fn();
    const second: Mock<() => void> = vi.fn();
    const { rerender } = renderHook(
      ({ handler }: { handler(): void }) => {
        useCommandShortcut('z', handler);
      },
      { initialProps: { handler: first } },
    );
    const registrations = (): number =>
      addListener.mock.calls.filter(
        (call: Parameters<typeof window.addEventListener>) =>
          call[0] === 'keydown',
      ).length;
    const before: number = registrations();

    rerender({ handler: second });
    press({ key: 'z', ctrlKey: true });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(registrations()).toBe(before);
  });

  it('listens to the new key when the key changes', (): void => {
    const handler: Mock<() => void> = vi.fn();
    const { rerender } = renderHook(
      ({ key }: { key: string }) => {
        useCommandShortcut(key, handler);
      },
      { initialProps: { key: 'z' } },
    );

    rerender({ key: 's' });
    expect(press({ key: 'z', ctrlKey: true })).toBe(true);
    expect(handler).not.toHaveBeenCalled();
    press({ key: 's', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stops listening on unmount', (): void => {
    const handler: Mock<() => void> = vi.fn();
    const { unmount } = renderHook(() => {
      useCommandShortcut('z', handler);
    });

    unmount();
    expect(press({ key: 'z', ctrlKey: true })).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });
});
