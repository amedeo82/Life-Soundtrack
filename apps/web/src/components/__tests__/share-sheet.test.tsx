import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ShareSheet } from '../ShareSheet';

/**
 * Test del foglio di condivisione — Story 3.2,
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §4 (T25.5).
 *
 * Copre: gli stati `generating`/`ready`/`error`, il ruolo di dialog
 * accessibile, la chiusura con `Esc` e le destinazioni.
 */

const props = {
  title: 'Condividi',
  generatingLabel: 'Generazione card...',
  errorLabel: 'Generazione non riuscita.',
  retryLabel: 'Riprova',
  closeLabel: 'Chiudi',
};

describe('ShareSheet (Story 3.2)', () => {
  it('è un dialog accessibile', () => {
    render(
      <ShareSheet
        {...props}
        state="ready"
        platforms={[{ id: 'download', icon: '⬇️', label: 'Scarica', onClick: () => {} }]}
        onClose={() => {}}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'share-sheet-title');
  });

  it('mostra lo stato generating', () => {
    render(<ShareSheet {...props} state="generating" platforms={[]} onClose={() => {}} />);
    expect(screen.getByTestId('share-sheet-generating')).toBeInTheDocument();
  });

  it('mostra lo stato error con il ritentativo', () => {
    const onRetry = vi.fn();
    render(
      <ShareSheet {...props} state="error" platforms={[]} onClose={() => {}} onRetry={onRetry} />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('share-sheet-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('chiude con Esc', () => {
    const onClose = vi.fn();
    render(<ShareSheet {...props} state="ready" platforms={[]} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('chiude con il click sul backdrop', () => {
    const onClose = vi.fn();
    render(<ShareSheet {...props} state="ready" platforms={[]} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('share-sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invoca la destinazione scelta', () => {
    const onClick = vi.fn();
    render(
      <ShareSheet
        {...props}
        state="ready"
        platforms={[{ id: 'download', icon: '⬇️', label: 'Scarica', onClick }]}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId('share-platform-download'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("mostra l'anteprima della card nello stato ready", () => {
    render(
      <ShareSheet
        {...props}
        state="ready"
        imageUrl="blob:card"
        platforms={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId('share-sheet-preview')).toHaveAttribute('src', 'blob:card');
  });
});
