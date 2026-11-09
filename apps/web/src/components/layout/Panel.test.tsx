import { render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { JSX } from 'react';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { TranslateProvider } from '@/i18n';

import { Panel, PanelActions, PanelBody, PanelHeader, StepNav } from './Panel';

const inLocale = (ui: JSX.Element): JSX.Element => (
  <TranslateProvider>{ui}</TranslateProvider>
);

describe('Panel', (): void => {
  it('is a complementary landmark holding its body and actions', (): void => {
    render(
      <Panel>
        <PanelBody>
          <span>Options</span>
        </PanelBody>
        <PanelActions>
          <button type="button">Go</button>
        </PanelActions>
      </Panel>,
    );

    const panel: HTMLElement = screen.getByRole('complementary');
    expect(panel).toHaveClass('panel');
    const [body, actions] = Array.from(panel.children);
    expect(body).toHaveClass('panel-body');
    expect(body).toHaveTextContent('Options');
    expect(actions).toHaveClass('panel-actions');
    expect(
      within(actions as HTMLElement).getByRole('button'),
    ).toHaveTextContent('Go');
  });
});

describe('PanelHeader', (): void => {
  it('shows the title as a level 2 heading and the text under it', (): void => {
    render(
      <PanelHeader title="Crop" text="Move the corners" data-testid="hint" />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Crop' })).toHaveClass(
      'panel-title',
    );
    const text: HTMLElement = screen.getByTestId('hint');
    expect(text.tagName).toBe('P');
    expect(text).toHaveClass('panel-text');
    expect(text).toHaveTextContent('Move the corners');
    expect(text).not.toHaveAttribute('role');
  });

  it('shows only the title without a text', (): void => {
    const { container } = render(<PanelHeader title="Export" />);

    expect(screen.getByRole('heading', { name: 'Export' })).toBeInTheDocument();
    expect(container.querySelector('p')).toBeNull();
  });

  it('gives the text the requested role, so changes are announced', (): void => {
    render(<PanelHeader title="Crop" text="2 documents" textRole="status" />);

    expect(screen.getByRole('status')).toHaveTextContent('2 documents');
  });

  it('shows a text of 0, which is not missing', (): void => {
    const { container } = render(<PanelHeader title="Count" text={0} />);

    expect(container.querySelector('p.panel-text')).toHaveTextContent('0');
  });
});

describe('PanelActions', (): void => {
  it('uses the plain actions layout by default', (): void => {
    const { container } = render(
      <PanelActions>
        <button type="button">A</button>
      </PanelActions>,
    );

    expect(container.firstElementChild).toHaveAttribute(
      'class',
      'panel-actions',
    );
  });

  it('adds the navigation layout with nav', (): void => {
    const { container } = render(
      <PanelActions nav>
        <button type="button">A</button>
      </PanelActions>,
    );

    expect(container.firstElementChild).toHaveAttribute(
      'class',
      'panel-actions panel-nav',
    );
  });
});

describe('StepNav', (): void => {
  it('shows continue then back, in the navigation layout', (): void => {
    const { container } = render(
      inLocale(<StepNav onContinue={vi.fn()} onBack={vi.fn()} />),
    );

    const buttons: HTMLElement[] = screen.getAllByRole('button');
    expect(buttons.map((b: HTMLElement) => b.textContent)).toEqual([
      'Continue',
      'Back',
    ]);
    expect(buttons[0]).toHaveClass('btn', 'btn-primary');
    expect(buttons[1]).toHaveClass('btn', 'btn-ghost');
    expect(container.firstElementChild).toHaveClass(
      'panel-actions',
      'panel-nav',
    );
  });

  it('calls onContinue and onBack from their buttons', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onContinue: Mock<() => void> = vi.fn();
    const onBack: Mock<() => void> = vi.fn();
    render(
      inLocale(
        <StepNav
          onContinue={onContinue}
          onBack={onBack}
          continueTestId="next"
        />,
      ),
    );

    await user.click(screen.getByTestId('next'));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('disables only the continue button with continueDisabled', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onContinue: Mock<() => void> = vi.fn();
    const onBack: Mock<() => void> = vi.fn();
    render(
      inLocale(
        <StepNav onContinue={onContinue} onBack={onBack} continueDisabled />,
      ),
    );

    const next: HTMLElement = screen.getByRole('button', { name: 'Continue' });
    expect(next).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled();

    await user.click(next);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('follows the current language', (): void => {
    localStorage.setItem('docscanify.locale', 'es');
    render(inLocale(<StepNav onContinue={vi.fn()} onBack={vi.fn()} />));

    expect(
      screen.getAllByRole('button').map((b: HTMLElement) => b.textContent),
    ).toEqual(['Continuar', 'Volver']);
  });
});
