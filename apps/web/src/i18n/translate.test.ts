import { describe, expect, it } from 'vitest';

import { MESSAGES, type Messages } from './config';
import {
  createTranslate,
  type TranslateFunction,
  type TranslationKey,
} from './translate';

/** A copy of a language's messages that a test can change without touching the real ones. */
const copyOf = (messages: Messages): Messages => structuredClone(messages);

/** Removes a message from a copy of the messages, as if the language did not translate it yet. */
const withoutKey = (messages: Messages, key: string): Messages => {
  const copy: Messages = copyOf(messages);
  const parts: string[] = key.split('.');
  const last: string | undefined = parts.pop();
  let node: Record<string, unknown> = copy;
  for (const part of parts) node = node[part] as Record<string, unknown>;
  if (last !== undefined) node[last] = undefined;
  return copy;
};

describe('createTranslate', (): void => {
  describe('lookup', (): void => {
    it('returns the message of a nested key in the given language', (): void => {
      const t: TranslateFunction = createTranslate(
        'es',
        MESSAGES.es,
        MESSAGES.en,
      );

      expect(t('app.step.crop')).toBe('Recortar');
      expect(t('common.back')).toBe('Volver');
    });

    it('returns a message without placeholders as it is', (): void => {
      const t: TranslateFunction = createTranslate(
        'en',
        MESSAGES.en,
        MESSAGES.en,
      );

      expect(t('upload.emptyTitle')).toBe(
        'Take photos or upload images of your documents',
      );
    });

    it('uses the fallback messages for a key the language does not have', (): void => {
      const t: TranslateFunction = createTranslate(
        'es',
        withoutKey(MESSAGES.es, 'common.back'),
        MESSAGES['pt-BR'],
      );

      expect(t('common.back')).toBe('Voltar');
      // The other keys still come from the language itself
      expect(t('common.continue')).toBe(MESSAGES.es.common.continue);
    });

    it('uses the fallback plural forms, with the plural rules of the current language', (): void => {
      const t: TranslateFunction = createTranslate(
        'en',
        withoutKey(MESSAGES.en, 'upload.filledTitle'),
        MESSAGES['pt-BR'],
      );

      // English: 0 is "other"; Portuguese would pick "one" for 0
      expect(t('upload.filledTitle', { count: 0 })).toBe(
        'Você enviou 0 imagens',
      );
      expect(t('upload.filledTitle', { count: 1 })).toBe(
        'Você enviou 1 imagem',
      );
    });

    it('returns the key itself when neither the language nor the fallback has it', (): void => {
      const t: TranslateFunction = createTranslate(
        'en',
        MESSAGES.en,
        MESSAGES['pt-BR'],
      );

      expect(t('does.not.exist' as TranslationKey)).toBe('does.not.exist');
      expect(t('app.nothing' as TranslationKey, { count: 2 })).toBe(
        'app.nothing',
      );
    });
  });

  describe('interpolation', (): void => {
    const t: TranslateFunction = createTranslate(
      'en',
      MESSAGES.en,
      MESSAGES.en,
    );

    it('replaces a {name} placeholder with its param', (): void => {
      expect(t('carousel.document', { number: 3 })).toBe('Document 3');
    });

    it('replaces several placeholders, each with its own param', (): void => {
      expect(
        t('result.position', { current: 2, total: 5, detail: 'Crop' }),
      ).toBe('Document 2 of 5 · Crop');
    });

    it('replaces every occurrence of the same placeholder', (): void => {
      const messages: Messages = copyOf(MESSAGES.en);
      messages.carousel.document = '{number} / {number}';
      const repeated: TranslateFunction = createTranslate(
        'en',
        messages,
        MESSAGES.en,
      );

      expect(repeated('carousel.document', { number: 7 })).toBe('7 / 7');
    });

    it('keeps a placeholder that has no param, so it is easy to spot', (): void => {
      expect(t('carousel.document')).toBe('Document {number}');
      expect(t('result.position', { current: 1 })).toBe(
        'Document 1 of {total} · {detail}',
      );
    });

    it('ignores params that the message does not use', (): void => {
      expect(t('carousel.document', { number: 1, unused: 'x' })).toBe(
        'Document 1',
      );
    });

    it('inserts params literally, even with replacement patterns such as $&', (): void => {
      expect(t('export.saved', { file: "a$&b$1$'.pdf" })).toBe(
        "File downloaded: a$&b$1$'.pdf",
      );
    });

    it('converts numbers to text without formatting them', (): void => {
      expect(t('carousel.document', { number: 1000 })).toBe('Document 1000');
      expect(t('carousel.document', { number: 0 })).toBe('Document 0');
    });

    it('interpolates a translated text into another message', (): void => {
      const photos: string = t('camera.photos', { count: 2 });

      expect(t('camera.doneWith', { photos })).toBe('Done with 2 photos');
    });
  });

  describe('plurals', (): void => {
    it('picks the "one" and "other" forms by count in English', (): void => {
      const t: TranslateFunction = createTranslate(
        'en',
        MESSAGES.en,
        MESSAGES.en,
      );

      expect(t('upload.filledTitle', { count: 1 })).toBe(
        'You uploaded 1 image',
      );
      expect(t('upload.filledTitle', { count: 2 })).toBe(
        'You uploaded 2 images',
      );
      expect(t('upload.filledTitle', { count: 0 })).toBe(
        'You uploaded 0 images',
      );
    });

    it('follows the plural rules of the language: 0 is singular in Brazilian Portuguese', (): void => {
      const t: TranslateFunction = createTranslate(
        'pt-BR',
        MESSAGES['pt-BR'],
        MESSAGES['pt-BR'],
      );

      expect(t('upload.filledTitle', { count: 0 })).toBe(
        'Você enviou 0 imagem',
      );
      expect(t('upload.filledTitle', { count: 1 })).toBe(
        'Você enviou 1 imagem',
      );
      expect(t('upload.filledTitle', { count: 2 })).toBe(
        'Você enviou 2 imagens',
      );
    });

    it('uses the "other" form when the language has no message for the plural category', (): void => {
      const t: TranslateFunction = createTranslate(
        'es',
        MESSAGES.es,
        MESSAGES.es,
      );

      // Spanish puts one million in the "many" category, which the messages do not define
      expect(new Intl.PluralRules('es').select(1000000)).toBe('many');
      expect(t('upload.filledTitle', { count: 1000000 })).toBe(
        'Subiste 1000000 imágenes',
      );
    });

    it('reads a count given as text', (): void => {
      const t: TranslateFunction = createTranslate(
        'en',
        MESSAGES.en,
        MESSAGES.en,
      );

      expect(t('camera.photos', { count: '1' })).toBe('1 photo');
      expect(t('camera.photos', { count: '3' })).toBe('3 photos');
    });

    it('treats a plural message without a count as a count of 0', (): void => {
      const en: TranslateFunction = createTranslate(
        'en',
        MESSAGES.en,
        MESSAGES.en,
      );
      const ptBR: TranslateFunction = createTranslate(
        'pt-BR',
        MESSAGES['pt-BR'],
        MESSAGES['pt-BR'],
      );

      expect(en('camera.photos')).toBe('{count} photos');
      expect(ptBR('camera.photos')).toBe('{count} foto');
    });

    it('fills the other placeholders of a plural message too', (): void => {
      const messages: Messages = copyOf(MESSAGES.en);
      messages.camera.photos = {
        one: '{count} photo of {name}',
        other: '{count} photos of {name}',
      };
      const t: TranslateFunction = createTranslate('en', messages, MESSAGES.en);

      expect(t('camera.photos', { count: 4, name: 'Ana' })).toBe(
        '4 photos of Ana',
      );
    });
  });
});
