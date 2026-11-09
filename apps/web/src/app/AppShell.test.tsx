import { render, screen, within } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CameraProvider } from '@/features/camera/CameraProvider';
import type { ImportProgress } from '@/features/documents/useImportFiles';
import type { ScanContextValue } from '@/features/scan/ScanContext';
import { useScan } from '@/features/scan/useScan';
import { StepsProvider } from '@/features/steps';
import { TranslateProvider } from '@/i18n';
import { DEFAULT_EXPORT_SETTINGS } from '@/lib/export';

import { AppShell } from './AppShell';

// UpdatePrompt and CurrentStep are covered by their own tests. Both are stand-ins here so the
// layout can be checked: the real UpdatePrompt renders nothing until a new version is found.
vi.mock('@/features/pwa/UpdatePrompt', () => ({
  UpdatePrompt: (): JSX.Element => <div data-testid="update-prompt" />,
}));
vi.mock('./CurrentStep', () => ({
  CurrentStep: (): JSX.Element => <div data-testid="current-step" />,
}));
vi.mock('@/features/scan/useScan', () => ({
  useScan: vi.fn(),
  useActiveDocument: vi.fn(),
}));

/** Makes {@link useScan} return a session with no documents and this import progress. */
function mockScan(importProgress: ImportProgress | null): void {
  const value: ScanContextValue = {
    documents: [],
    active: null,
    invalidCount: 0,
    previews: {},
    importProgress,
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    addFiles: vi.fn(),
    removeDocument: vi.fn(),
    reorder: vi.fn(),
    select: vi.fn(),
    setCorners: vi.fn(),
    redetect: vi.fn(),
    setOptions: vi.fn(),
    applyOptionsToAll: vi.fn(),
    setExportSettings: vi.fn(),
    restart: vi.fn(),
    dismissImportProgress: vi.fn(),
    setMainRender: vi.fn(),
    setDraggingCorner: vi.fn(),
  };
  vi.mocked(useScan).mockReturnValue(value);
}

/** Renders the shell inside the language, steps and camera providers it needs. */
function renderShell(): { container: HTMLElement } {
  return render(
    <TranslateProvider>
      <StepsProvider>
        <CameraProvider>
          <AppShell />
        </CameraProvider>
      </StepsProvider>
    </TranslateProvider>,
  );
}

describe('AppShell', (): void => {
  it('lays out the top bar, then the workspace with the current step', (): void => {
    mockScan(null);
    const { container } = renderShell();

    const app: Element | null = container.querySelector('.app');
    expect(app).not.toBeNull();
    const banner: HTMLElement = screen.getByRole('banner');
    const main: HTMLElement = screen.getByRole('main');
    expect(banner.parentElement).toBe(app);
    expect(main.parentElement).toBe(app);
    expect(
      banner.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(main).toHaveClass('workspace');
    expect(
      within(banner).getByRole('list', { name: 'Steps' }),
    ).toBeInTheDocument();
    expect(within(main).getByTestId('current-step')).toBeInTheDocument();
  });

  it('offers new versions of the app, outside the workspace', (): void => {
    mockScan(null);
    renderShell();

    const updatePrompt: HTMLElement = screen.getByTestId('update-prompt');
    expect(screen.getByRole('main')).not.toContainElement(updatePrompt);
  });

  it('shows no import progress while nothing is imported', (): void => {
    mockScan(null);
    renderShell();

    expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('covers the workspace with the import progress while images are imported', (): void => {
    mockScan({ phase: 'opening', current: 2, total: 3, value: 0.4 });
    renderShell();

    const overlay: HTMLElement = screen.getByTestId('loading-overlay');
    expect(screen.getByRole('main')).toContainElement(overlay);
    expect(within(overlay).getByRole('progressbar')).toHaveAccessibleName(
      'Uploading image 2 of 3…',
    );
    expect(within(overlay).getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    // The current step stays under the overlay
    expect(screen.getByTestId('current-step')).toBeInTheDocument();
  });
});
