import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpdateBanner } from '../components/UpdateBanner';

const baseProps = {
  currentVersionLabel: '1.0.0',
  onUpdate: vi.fn(),
  onDismiss: vi.fn(),
};

describe('UpdateBanner', () => {
  it('non si rende per update di tipo patch', () => {
    const { container } = render(
      <UpdateBanner {...baseProps} updateKind="patch" nextVersionLabel="1.0.1" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('mostra CTA "Più tardi" per update minor', () => {
    render(<UpdateBanner {...baseProps} updateKind="minor" nextVersionLabel="1.1.0" />);

    expect(screen.getByTestId('update-banner').getAttribute('data-update-kind')).toBe('minor');
    expect(screen.getByText(/Nuova versione disponibile/)).toBeTruthy();
    // Il testo del bottone (visivamente) "Aggiorna ora" è distinto dal testo
    // del paragrafo "Aggiorna ora per le ultime funzionalità": usiamo il
    // role per essere precisi.
    expect(screen.getByRole('button', { name: /Aggiorna ora/ })).toBeTruthy();
    expect(screen.getByTestId('update-banner-dismiss')).toBeTruthy();
  });

  it('NON mostra "Più tardi" per update major', () => {
    render(<UpdateBanner {...baseProps} updateKind="major" nextVersionLabel="2.0.0" />);

    expect(screen.getByTestId('update-banner').getAttribute('data-update-kind')).toBe('major');
    expect(screen.getByText(/Aggiornamento importante/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Aggiorna e riavvia/ })).toBeTruthy();
    expect(screen.queryByTestId('update-banner-dismiss')).toBeNull();
  });

  it('invoca onUpdate al click su "Aggiorna ora"', () => {
    const onUpdate = vi.fn();
    render(
      <UpdateBanner
        {...baseProps}
        onUpdate={onUpdate}
        updateKind="minor"
        nextVersionLabel="1.1.0"
      />,
    );

    fireEvent.click(screen.getByTestId('update-banner-update'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('invoca onDismiss al click su "Più tardi" (solo minor)', () => {
    const onDismiss = vi.fn();
    render(
      <UpdateBanner
        {...baseProps}
        onDismiss={onDismiss}
        updateKind="minor"
        nextVersionLabel="1.1.0"
      />,
    );

    fireEvent.click(screen.getByTestId('update-banner-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('espone lo stato update via aria-live polite', () => {
    render(<UpdateBanner {...baseProps} updateKind="minor" nextVersionLabel="1.1.0" />);

    const banner = screen.getByTestId('update-banner');
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.getAttribute('aria-live')).toBe('polite');
  });

  it('major con requiresDbMigration mostra modal bloccante senza "Più tardi"', () => {
    render(
      <UpdateBanner
        {...baseProps}
        updateKind="major"
        nextVersionLabel="2.0.0"
        requiresDbMigration={true}
      />,
    );

    const overlay = screen.getByTestId('update-banner');
    expect(overlay.getAttribute('data-update-kind')).toBe('major');
    expect(overlay.getAttribute('role')).toBe('alertdialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText(/Aggiornamento importante/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Aggiorna e riavvia/ })).toBeTruthy();
    expect(screen.queryByTestId('update-banner-dismiss')).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('major senza requiresDbMigration mostra banner (come minor)', () => {
    render(
      <UpdateBanner
        {...baseProps}
        updateKind="major"
        nextVersionLabel="2.0.0"
        requiresDbMigration={false}
      />,
    );

    const banner = screen.getByTestId('update-banner');
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.getAttribute('data-update-kind')).toBe('major');
    expect(screen.getByRole('button', { name: /Aggiorna e riavvia/ })).toBeTruthy();
    expect(screen.queryByTestId('update-banner-dismiss')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});
