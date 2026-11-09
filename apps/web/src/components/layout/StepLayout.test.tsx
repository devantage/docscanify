import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StepLayout } from './StepLayout';

describe('StepLayout', (): void => {
  it('puts the content and footer in a labeled stage, and the panel beside it', (): void => {
    const { container } = render(
      <StepLayout
        label="Document preview"
        footer={<nav data-testid="footer">Carousel</nav>}
        panel={<aside data-testid="panel">Options</aside>}
      >
        <img alt="Preview" />
      </StepLayout>,
    );

    const stage: HTMLElement = screen.getByRole('region', {
      name: 'Document preview',
    });
    expect(stage).toHaveClass('stage', 'stage-split');

    const [main, footer] = Array.from(stage.children);
    expect(main).toHaveAttribute('class', 'stage-main');
    expect(main).toContainElement(screen.getByRole('img', { name: 'Preview' }));
    expect(footer).toBe(screen.getByTestId('footer'));

    const panel: HTMLElement = screen.getByTestId('panel');
    expect(stage).not.toContainElement(panel);
    expect(Array.from(container.children)).toEqual([stage, panel]);
  });

  it('adds the extra class to the content area', (): void => {
    render(
      <StepLayout label="Crop" mainClassName="crop-main" panel={null}>
        <span>Editor</span>
      </StepLayout>,
    );

    expect(screen.getByText('Editor').parentElement).toHaveAttribute(
      'class',
      'stage-main crop-main',
    );
  });

  it('renders only the content area in the stage without a footer', (): void => {
    render(
      <StepLayout label="Crop" panel={null}>
        <span>Editor</span>
      </StepLayout>,
    );

    expect(screen.getByRole('region', { name: 'Crop' }).children).toHaveLength(
      1,
    );
  });
});
