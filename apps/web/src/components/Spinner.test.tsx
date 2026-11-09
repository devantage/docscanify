import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Spinner } from './Spinner';

describe('Spinner', (): void => {
  it('is centered by default and hidden from screen readers', (): void => {
    render(<Spinner data-testid="spinner" />);

    const spinner: HTMLElement = screen.getByTestId('spinner');
    expect(spinner.tagName).toBe('SPAN');
    expect(spinner).toHaveClass('spinner', 'is-centered');
    expect(spinner).not.toHaveClass('is-inline');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });

  it('sits in the flow with the inline placement', (): void => {
    render(<Spinner placement="inline" data-testid="spinner" />);

    const spinner: HTMLElement = screen.getByTestId('spinner');
    expect(spinner).toHaveClass('spinner', 'is-inline');
    expect(spinner).not.toHaveClass('is-centered');
  });

  it('renders without a test id', (): void => {
    const { container } = render(<Spinner />);

    expect(container.querySelector('.spinner')).not.toHaveAttribute(
      'data-testid',
    );
  });
});
