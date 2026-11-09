import { type RefObject, useEffect, useRef } from 'react';

/**
 * Calls `handler` on Ctrl + `key` (Cmd + `key` on a Mac) anywhere on the page, without Shift or
 * Alt. The browser default for the shortcut is prevented, and a held key fires only once.
 *
 * @param key Key, such as `z`; case does not matter.
 * @param handler Called on the shortcut. It may change on every render.
 */
export function useCommandShortcut(key: string, handler: () => void): void {
  // Read through a ref so the listener is registered only once per key
  const handlerRef: RefObject<() => void> = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const target: string = key.toLowerCase();
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== target) return;
      e.preventDefault();
      if (!e.repeat) handlerRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return (): void => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [key]);
}
