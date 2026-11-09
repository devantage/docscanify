import './LanguageSelect.css';

import {
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { Flag } from '@/components/Flag';
import { CheckIcon, ChevronDownIcon } from '@/components/icons';
import { LOCALES, useTranslate } from '@/i18n';

type LocaleOption = (typeof LOCALES)[number];

/**
 * Language picker of the top bar: a button with the current flag and short code that opens a
 * list of the languages, each with its flag and its own name. Follows the WAI-ARIA listbox
 * pattern: arrows, Home, and End move, Enter or Space picks, Escape and outside clicks close.
 */
export function LanguageSelect(): JSX.Element {
  const { locale, setLocale, t } = useTranslate();
  const [open, setOpen] = useState(false);
  const selectedIndex: number = LOCALES.findIndex(
    (l: LocaleOption) => l.locale === locale,
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef: RefObject<HTMLDivElement | null> =
    useRef<HTMLDivElement>(null);
  const buttonRef: RefObject<HTMLButtonElement | null> =
    useRef<HTMLButtonElement>(null);
  const listRef: RefObject<HTMLUListElement | null> =
    useRef<HTMLUListElement>(null);
  const id: string = useId();
  const current: LocaleOption = LOCALES[selectedIndex];
  const optionId = (index: number): string => `${id}-option-${index}`;

  const openList = (index: number = selectedIndex): void => {
    setActiveIndex(index);
    setOpen(true);
  };

  const close = (returnFocus: boolean = true): void => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const choose = (index: number): void => {
    setLocale(LOCALES[index].locale);
    close();
  };

  // The list takes focus when it opens, so the keyboard drives it right away
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // A press anywhere outside closes the list, without stealing focus from what was pressed
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return (): void => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const onButtonKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openList();
    }
  };

  const onListKeyDown = (e: KeyboardEvent): void => {
    const last: number = LOCALES.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(activeIndex + 1, last),
      ArrowUp: Math.max(activeIndex - 1, 0),
      Home: 0,
      End: last,
    };
    if (e.key in moves) {
      e.preventDefault();
      setActiveIndex(moves[e.key]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  return (
    <div ref={rootRef} className={`language${open ? ' is-open' : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        className="language-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`${t('app.language')}: ${current.name}`}
        title={t('app.language')}
        onClick={() => {
          open ? close() : openList();
        }}
        onKeyDown={onButtonKeyDown}
        data-testid="language"
      >
        <Flag code={current.flag} />
        <span className="language-code" aria-hidden>
          {current.short}
        </span>
        <ChevronDownIcon className="language-chevron" />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          className="language-list"
          role="listbox"
          tabIndex={-1}
          aria-label={t('app.language')}
          aria-activedescendant={optionId(activeIndex)}
          onKeyDown={onListKeyDown}
          onBlur={(e: FocusEvent<HTMLUListElement>) => {
            if (!rootRef.current?.contains(e.relatedTarget)) close(false);
          }}
        >
          {LOCALES.map((l: LocaleOption, index: number) => (
            <li
              key={l.locale}
              id={optionId(index)}
              className={`language-option${index === activeIndex ? ' is-active' : ''}`}
              role="option"
              aria-selected={index === selectedIndex}
              lang={l.locale}
              onPointerMove={() => {
                setActiveIndex(index);
              }}
              onClick={() => {
                choose(index);
              }}
              data-testid={`language-${l.locale}`}
            >
              <Flag code={l.flag} />
              <span className="language-name">{l.name}</span>
              {index === selectedIndex && (
                <CheckIcon className="language-check" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
