import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { App } from '../App';

it('monta la shell della app', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: 'Life-Soundtrack' })).toBeTruthy();
  expect(screen.getByTestId('platforms').textContent).toContain('spotify');
});
