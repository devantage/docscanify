import type { Locale, Messages } from './config';

/** Plural forms of a message, by `Intl.PluralRules` category. `other` is always required. */
type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string;
};

/** Dot-separated paths to every message (a string or a set of plural forms). */
type Paths<T> = {
  [K in keyof T & string]: T[K] extends string | PluralForms
    ? K
    : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

/** Key of a message, such as `"upload.emptyTitle"`. Checked against the pt-BR messages. */
export type TranslationKey = Paths<Messages>;

/** Values interpolated into `{name}` placeholders. `count` also picks the plural form. */
export type TranslationParams = Record<string, string | number>;

/** Translates a key in the current language. */
export type TranslateFunction = (
  key: TranslationKey,
  params?: TranslationParams,
) => string;

const lookup = (messages: Messages, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node: unknown, part: string) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      messages,
    );

/**
 * Builds the translate function of a language.
 *
 * @param locale Language, used for plural rules.
 * @param messages Messages of the language.
 * @param fallback Messages used for keys missing in `messages`.
 */
export function createTranslate(
  locale: Locale,
  messages: Messages,
  fallback: Messages,
): TranslateFunction {
  const plurals: Intl.PluralRules = new Intl.PluralRules(locale);
  return (key: TranslationKey, params: TranslationParams = {}) => {
    const entry: unknown = lookup(messages, key) ?? lookup(fallback, key);
    let template: string;
    if (typeof entry === 'string') template = entry;
    else if (entry && typeof entry === 'object') {
      const forms: PluralForms = entry as PluralForms;
      // Typed as possibly missing: a message may be used without a count
      const optionalParams: Partial<TranslationParams> = params;
      template =
        forms[plurals.select(Number(optionalParams.count ?? 0))] ?? forms.other;
    } else {
      // A missing key shows up as itself, so it is easy to spot
      return key;
    }
    return template.replace(/\{(\w+)\}/g, (match: string, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
}
