import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryCard } from '../MemoryCard';

describe('MemoryCard — artwork (24-ARTWORK-ENRICHMENT.md §D-24.5)', () => {
  const baseProps = {
    title: 'Test Memory',
    subtitle: 'Test Subtitle',
    mood: 'happy' as const,
    moodLabel: 'Felice',
    date: '2024-01-15',
    artworkUrl: 'https://example.com/artwork.jpg',
  };

  it('renderizza l\'artwork con alt e loading="lazy"', () => {
    render(<MemoryCard {...baseProps} />);
    const img = screen.getByAltText('Test Memory');
    expect(img).toHaveAttribute('src', 'https://example.com/artwork.jpg');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('mostra placeholder quando artworkUrl è null', () => {
    render(<MemoryCard {...baseProps} artworkUrl={null} />);
    const placeholder = screen.getByTestId('memory-card-artwork');
    expect(placeholder).toHaveClass('memory-card__artwork--empty');
    expect(placeholder).toHaveAttribute('aria-hidden', 'true');
  });

  it('mostra placeholder quando artworkUrl è undefined', () => {
    render(<MemoryCard {...baseProps} artworkUrl={undefined} />);
    const placeholder = screen.getByTestId('memory-card-artwork');
    expect(placeholder).toHaveClass('memory-card__artwork--empty');
  });

  it("l'alt è il titolo del ricordo (accessibilità)", () => {
    render(
      <MemoryCard
        {...baseProps}
        title="My Special Memory"
        artworkUrl="https://example.com/img.jpg"
      />,
    );
    const img = screen.getByAltText('My Special Memory');
    expect(img).toBeInTheDocument();
  });
});
