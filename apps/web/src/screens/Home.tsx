/**
 * Home (⑥) — Story 3.1, spec `docs/06-UX-FLOWS-STATES.md` §2.6.
 *
 * La prima schermata dell'app: quattro StatCard, il ricordo del giorno, la
 * bar week e il mood della settimana.
 *
 * La schermata è **presentazionale**: i dati arrivano per props e le azioni
 * escono per callback. Gli stati (`empty` / `partial` / `ready` / `loading`)
 * sono dichiarati dalla spec e resi qui, in modo che lo scheletro non possa
 * dimenticare un caso.
 */

import { useT } from '../i18n';
import { BarWeek, type BarWeekPoint } from '../components/BarWeek';
import { MemoryCard } from '../components/MemoryCard';
import { StatCard } from '../components/StatCard';
import type { HomeStats } from './homeTimelineModel';

/** Stati della Home (`06§2.6` + Story 2.5 `no-features`). */
export type HomeState = 'empty' | 'no-features' | 'partial' | 'ready' | 'loading';

/** Il ricordo mostrato nella MemoryCard (testo già reso). */
export interface HomeMemory {
  title: string;
  subtitle?: string;
  mood?: string | null;
  moodLabel?: string | null;
  date?: string;
  artworkUrl?: string | null;
}

export interface HomeProps {
  state: HomeState;
  /** I quattro numeri. */
  stats: HomeStats;
  /** I sette giorni della settimana. */
  barWeek: readonly BarWeekPoint[];
  /** Il ricordo del giorno (null se non c'è). */
  memory: HomeMemory | null;
  /** Mood della settimana, già reso. */
  weekMoodLabel: string | null;
  /** Callback su una StatCard (tap → schermata dedicata). */
  onStatCardClick?: (stat: 'tracks' | 'hours' | 'artists' | 'eras') => void;
  /** Callback del CTA «importa». */
  onImportCta?: () => void;
}

export function Home({
  state,
  stats,
  barWeek,
  memory,
  weekMoodLabel,
  onStatCardClick,
  onImportCta,
}: HomeProps) {
  const t = useT();

  if (state === 'loading') {
    return (
      <main className="screen screen--home" aria-busy="true" aria-label={t('home.weekTitle')}>
        <div className="stat-grid" data-testid="home-skeleton">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="stat-card stat-card--skeleton" />
          ))}
        </div>
      </main>
    );
  }

  if (state === 'empty') {
    return (
      <main className="screen screen--home" data-testid="home-empty">
        <h1>{t('empty.title')}</h1>
        <p>{t('empty.description.home')}</p>
        <button type="button" className="btn btn-primary" onClick={onImportCta}>
          {t('empty.cta.import')}
        </button>
      </main>
    );
  }

  if (state === 'no-features') {
    return (
      <main className="screen screen--home" data-testid="home-no-features">
        <h1>{t('empty.title')}</h1>
        <p>{t('home.noFeatures.description')}</p>
        <button type="button" className="btn btn-primary" onClick={onImportCta}>
          {t('home.noFeatures.cta')}
        </button>
      </main>
    );
  }

  const dayLabels = [
    t('home.days.mon'),
    t('home.days.tue'),
    t('home.days.wed'),
    t('home.days.thu'),
    t('home.days.fri'),
    t('home.days.sat'),
    t('home.days.sun'),
  ];

  return (
    <main className="screen screen--home" aria-label={t('home.weekTitle')}>
      <div className="stat-grid">
        <StatCard
          value={stats.tracks}
          label={t('home.stats.tracks')}
          icon="♪"
          onClick={onStatCardClick ? () => onStatCardClick('tracks') : undefined}
        />
        <StatCard
          value={stats.hours}
          label={t('home.stats.hours')}
          unit={t('home.stats.hours')}
          icon="⏱"
          onClick={onStatCardClick ? () => onStatCardClick('hours') : undefined}
        />
        <StatCard
          value={stats.artists}
          label={t('home.stats.artists')}
          icon="◎"
          onClick={onStatCardClick ? () => onStatCardClick('artists') : undefined}
        />
        <StatCard
          value={stats.eras}
          label={t('home.stats.eras')}
          icon="❖"
          onClick={onStatCardClick ? () => onStatCardClick('eras') : undefined}
        />
      </div>

      {state === 'partial' && (
        <p className="small" data-testid="home-partial">
          {t('home.partial')}
        </p>
      )}

      {memory && (
        <section aria-label={t('home.todayInHistory')}>
          <h2>{t('home.todayInHistory')}</h2>
          <MemoryCard
            title={memory.title}
            subtitle={memory.subtitle}
            mood={memory.mood as never}
            moodLabel={memory.moodLabel}
            date={memory.date}
            artworkUrl={memory.artworkUrl}
          />
        </section>
      )}

      <section aria-label={t('home.weekTitle')}>
        <h2>{t('home.weekTitle')}</h2>
        <BarWeek
          points={barWeek}
          dayLabels={dayLabels}
          title={t('home.weekTitle')}
          description={t('home.weekTitle')}
        />
      </section>

      {weekMoodLabel && (
        <section aria-label={t('home.moodWeek')} data-testid="home-mood-week">
          <h2>{t('home.moodWeek')}</h2>
          <p>{weekMoodLabel}</p>
        </section>
      )}
    </main>
  );
}
