import {
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test';

import { openApp, uploadImages } from '@/test-support/e2e/app';

/** A language of the app and what the page shows in it. */
interface Language {
  /** BCP 47 tag of `<html lang>` and of the manifest file. */
  lang: 'en' | 'es' | 'pt-BR';
  /** Native name, in the picker. */
  name: string;
  /** Short code on the picker button. */
  short: string;
  /** `app.description`, in the meta description and the manifest. */
  description: string;
  /** Title of the empty Upload step. */
  emptyTitle: string;
  /** Labels of the four steps of the top bar. */
  steps: [string, string, string, string];
  /** The "Take photo" button. */
  takePhoto: string;
  /** Title of the Upload step with two documents. */
  twoImages: string;
}

const ENGLISH: Language = {
  lang: 'en',
  name: 'English',
  short: 'EN',
  description:
    'Scan documents, take photos or upload images, crop, adjust, and export to PDF, PNG, or JPG. Everything is processed on your device.',
  emptyTitle: 'Take photos or upload images of your documents',
  steps: ['Upload', 'Crop', 'Adjust', 'Export'],
  takePhoto: 'Take photo',
  twoImages: 'You uploaded 2 images',
};

const SPANISH: Language = {
  lang: 'es',
  name: 'Español',
  short: 'ES',
  description:
    'Escanea documentos, toma fotos o sube imágenes, recorta, ajusta y exporta a PDF, PNG o JPG. Todo se procesa en tu dispositivo.',
  emptyTitle: 'Fotografía o sube imágenes de tus documentos',
  steps: ['Subir', 'Recortar', 'Ajustar', 'Exportar'],
  takePhoto: 'Fotografiar',
  twoImages: 'Subiste 2 imágenes',
};

const PORTUGUESE: Language = {
  lang: 'pt-BR',
  name: 'Português (Brasil)',
  short: 'PT',
  description:
    'Escaneie documentos, fotografe ou envie imagens, recorte, ajuste e exporte em PDF, PNG ou JPG. Tudo é processado no seu dispositivo.',
  emptyTitle: 'Fotografe ou envie imagens dos documentos',
  steps: ['Enviar', 'Recortar', 'Ajustar', 'Exportar'],
  takePhoto: 'Fotografar',
  twoImages: 'Você enviou 2 imagens',
};

/** The languages in the order of the picker. */
const PICKER_ORDER: Language[] = [ENGLISH, SPANISH, PORTUGUESE];

function languageButton(page: Page): Locator {
  return page.getByTestId('language');
}

/** Checks that every text and the page metadata are in a language. */
async function expectLanguage(page: Page, language: Language): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('lang', language.lang);
  await expect(
    page.getByRole('heading', { level: 1, name: language.emptyTitle }),
  ).toBeVisible();
  await expect(page.getByTestId('upload-camera')).toHaveText(
    language.takePhoto,
  );
  for (let i: number = 0; i < language.steps.length; i++) {
    await expect(page.getByTestId(`step-${String(i)}`)).toHaveText(
      `${String(i + 1)}${language.steps[i]}`,
    );
  }
  await expect(languageButton(page)).toHaveText(language.short);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    language.description,
  );
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    `/manifest.${language.lang}.webmanifest`,
  );
}

/**
 * Checks that the open list highlights a language, and only it, and points screen readers to it
 * (`aria-activedescendant`), with focus on the list.
 */
async function expectActiveOption(
  page: Page,
  language: Language,
): Promise<void> {
  const list: Locator = page.getByRole('listbox');
  const option: Locator = page.getByTestId(`language-${language.lang}`);
  await expect(list).toBeFocused();
  await expect(option).toHaveClass(/is-active/);
  await expect(list.locator('.is-active')).toHaveCount(1);
  const id: string | null = await option.getAttribute('id');
  expect(id).toBeTruthy();
  await expect(list).toHaveAttribute('aria-activedescendant', id ?? '');
}

/** Picks a language with the mouse in the top bar picker. */
async function pickLanguage(page: Page, language: Language): Promise<void> {
  await languageButton(page).click();
  await page.getByTestId(`language-${language.lang}`).click();
  await expect(page.getByRole('listbox')).toBeHidden();
}

test.describe('language from the browser', (): void => {
  const CASES: { browser: string; expected: Language }[] = [
    { browser: 'en-US', expected: ENGLISH },
    { browser: 'pt-BR', expected: PORTUGUESE },
    { browser: 'es-MX', expected: SPANISH },
    { browser: 'pt-PT', expected: PORTUGUESE },
    { browser: 'de-DE', expected: ENGLISH },
  ];

  for (const { browser, expected } of CASES) {
    test.describe(`browser in ${browser}`, (): void => {
      test.use({ locale: browser });

      test(`starts in ${expected.name}`, async ({
        page,
      }: {
        page: Page;
      }): Promise<void> => {
        await openApp(page);
        await expectLanguage(page, expected);
        await expect(languageButton(page)).toHaveAccessibleName(
          new RegExp(`: ${expected.name.replace(/[()]/g, '\\$&')}$`),
        );
      });
    });
  }

  /** Gives the browser a list of preferred languages, as set in its settings. */
  async function preferLanguages(page: Page, tags: string[]): Promise<void> {
    await page.addInitScript((languages: string[]): void => {
      Object.defineProperty(Navigator.prototype, 'languages', {
        configurable: true,
        get: (): string[] => languages,
      });
    }, tags);
  }

  const PREFERENCES: { tags: string[]; expected: Language }[] = [
    // The first supported one, after unsupported ones
    { tags: ['de-DE', 'fr-FR', 'es-AR', 'pt-BR'], expected: SPANISH },
    // The order of preference wins over an exact match further down
    { tags: ['es-MX', 'pt-BR'], expected: SPANISH },
    { tags: ['pt-PT', 'en-US'], expected: PORTUGUESE },
    { tags: ['fr-CA', 'en-GB', 'es'], expected: ENGLISH },
  ];

  for (const { tags, expected } of PREFERENCES) {
    test(`with the languages ${tags.join(', ')}, starts in ${expected.name}`, async ({
      page,
    }: {
      page: Page;
    }): Promise<void> => {
      await preferLanguages(page, tags);
      await openApp(page);
      await expectLanguage(page, expected);
    });
  }

  test('ignores a stored language the app does not have', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await page.addInitScript((): void => {
      localStorage.setItem('docscanify.locale', 'fr');
    });
    await preferLanguages(page, ['es-MX']);
    await openApp(page);
    await expectLanguage(page, SPANISH);
  });
});

test.describe('language picker', (): void => {
  test('lists the three languages in order, with the current one selected', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openApp(page);
    const button: Locator = languageButton(page);
    await expect(button).toHaveAccessibleName('Language: English');
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    await button.click();

    await expect(button).toHaveAttribute('aria-expanded', 'true');
    const options: Locator = page
      .getByRole('listbox', { name: 'Language' })
      .getByRole('option');
    await expect(options).toHaveText(
      PICKER_ORDER.map((language: Language): string => language.name),
    );
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'false');
    await expect(options.nth(2)).toHaveAttribute('aria-selected', 'false');
    // Each name is marked with its own language, for screen readers
    for (let i: number = 0; i < PICKER_ORDER.length; i++) {
      await expect(options.nth(i)).toHaveAttribute(
        'lang',
        PICKER_ORDER[i].lang,
      );
    }
  });

  test('switches every text, <html lang>, the description and the manifest', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openApp(page);
    await expectLanguage(page, ENGLISH);

    await pickLanguage(page, SPANISH);
    await expectLanguage(page, SPANISH);
    await expect(languageButton(page)).toHaveAccessibleName('Idioma: Español');

    await pickLanguage(page, PORTUGUESE);
    await expectLanguage(page, PORTUGUESE);
    await expect(languageButton(page)).toHaveAccessibleName(
      'Idioma: Português (Brasil)',
    );

    await pickLanguage(page, ENGLISH);
    await expectLanguage(page, ENGLISH);
  });

  test('the linked manifest is the one of the language on display', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openApp(page);
    await pickLanguage(page, PORTUGUESE);

    const manifest: { lang: string; description: string } = await page.evaluate(
      async (): Promise<{ lang: string; description: string }> => {
        const link: HTMLLinkElement | null =
          document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
        if (!link) throw new Error('No manifest link');
        const response: Response = await fetch(link.href);
        return (await response.json()) as {
          lang: string;
          description: string;
        };
      },
    );
    expect(manifest.lang).toBe('pt-BR');
    expect(manifest.description).toBe(PORTUGUESE.description);
  });

  test('the choice survives a reload', async ({
    page,
    context,
  }: {
    page: Page;
    context: BrowserContext;
  }): Promise<void> => {
    await openApp(page);
    await pickLanguage(page, SPANISH);
    await expectLanguage(page, SPANISH);

    await page.reload();

    await expectLanguage(page, SPANISH);
    await languageButton(page).click();
    await expect(page.getByTestId('language-es')).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // And a later visit, in a new tab
    const later: Page = await context.newPage();
    await openApp(later);
    await expectLanguage(later, SPANISH);
  });

  test.describe('with a supported browser language', (): void => {
    test.use({ locale: 'pt-BR' });

    test('the language picked before wins over the browser language', async ({
      page,
    }: {
      page: Page;
    }): Promise<void> => {
      await openApp(page);
      await expectLanguage(page, PORTUGUESE);

      await pickLanguage(page, ENGLISH);
      await page.reload();

      await expectLanguage(page, ENGLISH);
    });
  });

  test('works with the keyboard: arrows move, Enter picks and Escape closes without a change', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openApp(page);
    const button: Locator = languageButton(page);
    const list: Locator = page.getByRole('listbox');

    // Escape closes without changing the language, and focus goes back to the button
    await button.focus();
    await page.keyboard.press('ArrowDown');
    await expect(list).toBeFocused();
    await page.keyboard.press('End');
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
    await expect(button).toBeFocused();
    await expectLanguage(page, ENGLISH);

    // Down from English is Español
    await page.keyboard.press('ArrowDown');
    await expectActiveOption(page, ENGLISH);
    await page.keyboard.press('ArrowDown');
    await expectActiveOption(page, SPANISH);
    await page.keyboard.press('Enter');
    await expect(list).toBeHidden();
    await expect(button).toBeFocused();
    await expectLanguage(page, SPANISH);

    // The list opens on the current language; the arrows stop at both ends
    await page.keyboard.press('ArrowUp');
    await expectActiveOption(page, SPANISH);
    await page.keyboard.press('ArrowUp');
    await expectActiveOption(page, ENGLISH);
    await page.keyboard.press('ArrowUp');
    await expectActiveOption(page, ENGLISH);
    await page.keyboard.press('End');
    await expectActiveOption(page, PORTUGUESE);
    await page.keyboard.press('ArrowDown');
    await expectActiveOption(page, PORTUGUESE);
    // Moving does not pick: the language stays until Enter or Space
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');

    // Home goes to the first one, and Space picks it
    await page.keyboard.press('Home');
    await expectActiveOption(page, ENGLISH);
    await page.keyboard.press(' ');
    await expect(list).toBeHidden();
    await expect(button).toBeFocused();
    await expectLanguage(page, ENGLISH);
  });

  test('Tab closes the list without changing the language', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openApp(page);
    await languageButton(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expectActiveOption(page, SPANISH);

    await page.keyboard.press('Tab');

    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(languageButton(page)).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expectLanguage(page, ENGLISH);
  });

  test('closes when clicking outside, without changing the language', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openApp(page);
    await languageButton(page).click();
    await expect(page.getByRole('listbox')).toBeVisible();

    await page.getByRole('heading', { level: 1 }).click();

    await expect(page.getByRole('listbox')).toBeHidden();
    await expectLanguage(page, ENGLISH);
  });

  test('switching keeps the documents and translates the texts about them', async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await openApp(page);
    await uploadImages(page, ['invoice.jpg', 'receipt.jpg']);
    await expect(
      page.getByRole('heading', { name: ENGLISH.twoImages }),
    ).toBeVisible();

    await pickLanguage(page, PORTUGUESE);

    await expect(
      page.getByRole('heading', { name: PORTUGUESE.twoImages }),
    ).toBeVisible();
    await expect(page.locator('[data-testid^="doc-"]')).toHaveCount(2);
    await expect(page.getByTestId('upload-continue')).toHaveText('Continuar');
    await expect(page.getByTestId('remove-1')).toHaveAccessibleName(
      'Remover documento 2',
    );
  });
});

test.describe('static HTML, before JavaScript runs', (): void => {
  /** The HTML served at `/`, as crawlers and link previews read it. */
  async function staticHtml(
    request: APIRequestContext,
    acceptLanguage: string,
  ): Promise<string> {
    const response: APIResponse = await request.get('/', {
      headers: { 'Accept-Language': acceptLanguage },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    return response.text();
  }

  for (const acceptLanguage of ['en-US', 'pt-BR', 'es-MX']) {
    test(`is in English, the default language, even for Accept-Language ${acceptLanguage}`, async ({
      request,
    }: {
      request: APIRequestContext;
    }): Promise<void> => {
      const html: string = await staticHtml(request, acceptLanguage);

      expect(html).toMatch(/<html lang="en">/);
      const descriptions: string[] = [
        ...html.matchAll(/<meta name="description" content="([^"]*)"/g),
      ].map((match: RegExpExecArray): string => match[1]);
      expect(descriptions).toEqual([ENGLISH.description]);
      const manifests: string[] = [
        ...html.matchAll(/<link rel="manifest" href="([^"]*)"/g),
      ].map((match: RegExpExecArray): string => match[1]);
      expect(manifests).toEqual(['/manifest.en.webmanifest']);
    });
  }
});
