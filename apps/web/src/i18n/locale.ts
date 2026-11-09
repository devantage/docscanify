/** Supported languages, as BCP 47 tags. */
export type Locale = 'pt-BR' | 'en' | 'es';

/**
 * Language used when none of the browser languages is supported. Change it here to configure
 * the app; `TranslateProvider` also accepts a `defaultLocale` prop.
 *
 * This module imports nothing, so `plugins/webManifest.ts` can read it while Vite loads its config.
 */
export const DEFAULT_LOCALE: Locale = 'en';
