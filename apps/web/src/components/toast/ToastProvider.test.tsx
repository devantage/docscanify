import { act, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { JSX } from 'react';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  type IconProps,
  InfoIcon,
} from '@/components/icons';
import { useToast } from '@/hooks/useToast';
import { TranslateProvider } from '@/i18n';

import type { ToastContextValue } from './ToastContext';
import { ToastProvider } from './ToastProvider';

/** Renders the provider and gives access to its `useToast()` value. */
function renderToasts(): {
  toast(): ToastContextValue;
  unmount(): void;
} {
  const holder: { current: ToastContextValue | null } = { current: null };
  function Capture(): null {
    holder.current = useToast();
    return null;
  }
  const { unmount } = render(
    <TranslateProvider>
      <ToastProvider>
        <Capture />
      </ToastProvider>
    </TranslateProvider>,
  );
  return {
    toast: (): ToastContextValue => {
      if (!holder.current) throw new Error('ToastProvider did not render');
      return holder.current;
    },
    unmount,
  };
}

/** Calls the toast API inside `act`, returning what it returned. */
function run<T>(call: () => T): T {
  let result: T | undefined;
  act(() => {
    result = call();
  });
  return result as T;
}

/** Messages of the toasts on screen, top to bottom. */
const messages = (): string[] =>
  screen
    .queryAllByTestId('toast')
    .map((el: HTMLElement) => el.querySelector('p')?.textContent ?? '');

/** Moves the fake clock by `ms`, so the toasts due to go away by then do. */
const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

afterEach((): void => {
  vi.useRealTimers();
});

describe('ToastProvider', (): void => {
  it('renders the toasts inside a labeled notifications region', (): void => {
    const { toast } = renderToasts();
    run(() => toast().success('Saved'));

    const region: HTMLElement = screen.getByRole('region', {
      name: 'Notifications',
    });
    expect(within(region).getByTestId('toast')).toHaveTextContent('Saved');
  });

  it.each([
    ['success', 'status'],
    ['info', 'status'],
    ['warning', 'status'],
    ['error', 'alert'],
  ] as const)(
    'shows a %s toast with its kind and the %s role',
    (kind: 'success' | 'info' | 'warning' | 'error', role: string): void => {
      const { toast } = renderToasts();
      run(() => toast()[kind](`A ${kind} message`));

      const el: HTMLElement = screen.getByTestId('toast');
      expect(el).toHaveAttribute('data-kind', kind);
      expect(el).toHaveClass('toast', `is-${kind}`);
      expect(el).toHaveAttribute('role', role);
      expect(el).toHaveTextContent(`A ${kind} message`);
      expect(screen.getByRole(role)).toBe(el);
    },
  );

  it.each([
    ['success', CheckCircleIcon],
    ['info', InfoIcon],
    ['warning', AlertTriangleIcon],
    ['error', AlertCircleIcon],
  ] as const)(
    'shows the icon of a %s toast',
    (
      kind: 'success' | 'info' | 'warning' | 'error',
      Icon: (props: IconProps) => JSX.Element,
    ): void => {
      const { toast } = renderToasts();
      run(() => toast()[kind]('Message'));
      const shown: Element | null = screen
        .getByTestId('toast')
        .querySelector('svg.toast-icon');

      const { container } = render(<Icon className="toast-icon" />);
      expect(shown?.outerHTML).toBe(container.innerHTML);
    },
  );

  it('returns a distinct id for each toast, or the id it was given', (): void => {
    const { toast } = renderToasts();
    const first: string = run(() => toast().info('One'));
    const second: string = run(() => toast().info('Two'));
    const given: string = run(() =>
      toast().warning('Three', { id: 'corners' }),
    );

    expect(first).not.toBe(second);
    expect(given).toBe('corners');
    expect(messages()).toEqual(['One', 'Two', 'Three']);
  });

  it('stacks new toasts below the older ones', (): void => {
    const { toast } = renderToasts();
    run(() => toast().success('First'));
    run(() => toast().error('Second'));

    expect(messages()).toEqual(['First', 'Second']);
  });

  describe('stack limit', (): void => {
    it('keeps at most 3 toasts, removing the oldest one', (): void => {
      const { toast } = renderToasts();
      ['A', 'B', 'C', 'D'].forEach((message: string) => {
        run(() => toast().info(message));
      });

      expect(messages()).toEqual(['B', 'C', 'D']);
    });

    it('removes the oldest temporary toast before any toast that stays until closed', (): void => {
      const { toast } = renderToasts();
      run(() => toast().warning('Sticky', { duration: Infinity }));
      run(() => toast().info('Temp 1'));
      run(() => toast().info('Temp 2'));
      run(() => toast().info('Temp 3'));

      expect(messages()).toEqual(['Sticky', 'Temp 2', 'Temp 3']);

      run(() => toast().error('Sticky 2', { duration: Infinity }));
      expect(messages()).toEqual(['Sticky', 'Temp 3', 'Sticky 2']);
    });

    it('removes the oldest toast when every toast stays until closed', (): void => {
      const { toast } = renderToasts();
      ['P1', 'P2', 'P3', 'P4'].forEach((message: string) => {
        run(() => toast().error(message, { duration: Infinity }));
      });

      expect(messages()).toEqual(['P2', 'P3', 'P4']);
    });
  });

  describe('id', (): void => {
    it('replaces the toast with the same id instead of stacking, moving it to the end', (): void => {
      const { toast } = renderToasts();
      run(() => toast().warning('Corners crossed', { id: 'corners' }));
      run(() => toast().info('Other'));
      run(() => toast().error('Corners still crossed', { id: 'corners' }));

      expect(messages()).toEqual(['Other', 'Corners still crossed']);
      const replaced: HTMLElement = screen.getAllByTestId('toast')[1];
      expect(replaced).toHaveAttribute('data-kind', 'error');
      expect(replaced).toHaveAttribute('role', 'alert');
    });

    it('restarts the duration of a replaced toast', (): void => {
      vi.useFakeTimers();
      const { toast } = renderToasts();
      run(() => toast().info('Once', { id: 'x', duration: 1000 }));
      advance(800);
      run(() => toast().info('Again', { id: 'x', duration: 1000 }));
      advance(800);

      expect(messages()).toEqual(['Again']);
      advance(200);
      expect(messages()).toEqual([]);
    });

    it('keeps a replaced toast on screen when the new one stays until closed', (): void => {
      vi.useFakeTimers();
      const { toast } = renderToasts();
      run(() => toast().info('Temporary', { id: 'x', duration: 1000 }));
      run(() => toast().info('Sticky', { id: 'x', duration: Infinity }));
      advance(60_000);

      expect(messages()).toEqual(['Sticky']);
    });
  });

  describe('duration', (): void => {
    it('closes a toast by itself after 6 seconds by default', (): void => {
      vi.useFakeTimers();
      const { toast } = renderToasts();
      run(() => toast().success('Exported'));

      advance(5999);
      expect(messages()).toEqual(['Exported']);
      advance(1);
      expect(messages()).toEqual([]);
    });

    it('closes a toast by itself after the given duration', (): void => {
      vi.useFakeTimers();
      const { toast } = renderToasts();
      run(() => toast().info('Short', { duration: 2000 }));
      run(() => toast().info('Long', { duration: 4000 }));

      advance(1999);
      expect(messages()).toEqual(['Short', 'Long']);
      advance(1);
      expect(messages()).toEqual(['Long']);
      advance(2000);
      expect(messages()).toEqual([]);
    });

    it('keeps a toast with an Infinity duration until it is closed', (): void => {
      vi.useFakeTimers();
      const { toast } = renderToasts();
      run(() => toast().info('New version', { duration: Infinity }));

      advance(60 * 60 * 1000);
      expect(messages()).toEqual(['New version']);
    });

    it('does not call onClose when the toast goes away by itself', (): void => {
      vi.useFakeTimers();
      const onClose: Mock<() => void> = vi.fn();
      const { toast } = renderToasts();
      run(() => toast().info('Bye', { duration: 1000, onClose }));

      advance(1000);
      expect(messages()).toEqual([]);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('clears the pending timers on unmount', (): void => {
      vi.useFakeTimers();
      const { toast, unmount } = renderToasts();
      run(() => toast().info('One'));
      run(() => toast().info('Two', { duration: 3000 }));
      expect(vi.getTimerCount()).toBe(2);

      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('dismiss', (): void => {
    it('removes only the toast with the given id', (): void => {
      const { toast } = renderToasts();
      run(() => toast().info('Keep 1'));
      const id: string = run(() => toast().info('Remove'));
      run(() => toast().info('Keep 2'));

      run(() => {
        toast().dismiss(id);
      });
      expect(messages()).toEqual(['Keep 1', 'Keep 2']);
    });

    it('removes every toast without an id, including those that stay until closed', (): void => {
      const { toast } = renderToasts();
      run(() => toast().info('One'));
      run(() => toast().error('Two', { duration: Infinity }));
      run(() => toast().warning('Three', { id: 'w' }));

      run(() => {
        toast().dismiss();
      });
      expect(messages()).toEqual([]);
    });

    it('does nothing for an unknown id', (): void => {
      const { toast } = renderToasts();
      run(() => toast().info('Stays'));

      run(() => {
        toast().dismiss('nope');
      });
      expect(messages()).toEqual(['Stays']);
    });

    it('cancels the timer of the dismissed toast, so a later toast with its id is not cut short', (): void => {
      vi.useFakeTimers();
      const { toast } = renderToasts();
      run(() => toast().info('Old', { id: 'x', duration: 1000 }));
      run(() => {
        toast().dismiss('x');
      });
      run(() => toast().info('New', { id: 'x', duration: 5000 }));

      advance(1000);
      expect(messages()).toEqual(['New']);
      advance(4000);
      expect(messages()).toEqual([]);
    });

    it('leaves no timer pending for the dismissed toasts', (): void => {
      vi.useFakeTimers();
      const { toast } = renderToasts();
      const id: string = run(() => toast().info('One'));
      run(() => toast().info('Two'));
      run(() => toast().info('Three'));
      expect(vi.getTimerCount()).toBe(3);

      run(() => {
        toast().dismiss(id);
      });
      expect(vi.getTimerCount()).toBe(2);
      run(() => {
        toast().dismiss();
      });
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not call onClose', (): void => {
      const onClose: Mock<() => void> = vi.fn();
      const { toast } = renderToasts();
      run(() => toast().info('Bye', { id: 'x', onClose }));

      run(() => {
        toast().dismiss('x');
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('close button', (): void => {
    it('closes the toast and calls onClose once', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      const onClose: Mock<() => void> = vi.fn();
      const { toast } = renderToasts();
      run(() => toast().warning('Closable', { onClose }));
      run(() => toast().info('Other'));

      const closable: HTMLElement = screen.getAllByTestId('toast')[0];
      await user.click(
        within(closable).getByRole('button', { name: 'Close message' }),
      );

      expect(messages()).toEqual(['Other']);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('action', (): void => {
    it('shows the action button, which closes the toast and calls back once', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      const onClick: Mock<() => void> = vi.fn();
      const onClose: Mock<() => void> = vi.fn();
      const { toast } = renderToasts();
      run(() =>
        toast().info('New version available', {
          duration: Infinity,
          action: { label: 'Update', onClick },
          onClose,
        }),
      );

      const button: HTMLElement = screen.getByTestId('toast-action');
      expect(button).toHaveTextContent('Update');
      expect(button).toBe(screen.getByRole('button', { name: 'Update' }));

      await user.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(messages()).toEqual([]);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('shows no action button without an action', (): void => {
      const { toast } = renderToasts();
      run(() => toast().info('Plain'));

      expect(screen.queryByTestId('toast-action')).not.toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });
  });
});
