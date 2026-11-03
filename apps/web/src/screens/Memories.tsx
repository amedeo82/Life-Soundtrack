/**
 * La schermata dei Ricordi (⑪) — Story 3.2, spec
 * `docs/25-MEMORIES-SHARE-EXPLORE.md` §2-§5 e `docs/06-UX-FLOWS-STATES.md` §2.11.
 *
 * Il feed mostra i ricordi in ordine di rilevanza, a pagine di 10 con
 * infinite scroll. Ogni card espone tre azioni (`07§2.2`): **nascondi**
 * (swipe sinistro, D-25.3: il ricordo resta nel database), **salva**
 * (`confirmed`) e **condividi** (la card PNG, §12).
 *
 * Sotto il feed c'è il **tagging manuale**: il nome e le parole chiave delle
 * ere, che sopravvivono al ricalcolo dell'analisi.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useT, useLanguage } from '../i18n';
import { isAppLanguage } from '../i18n/detector';
import { formatDate } from '../i18n/formatter';
import { useMemories, MEMORIES_PAGE_SIZE, type MemoryCardModel } from '../hooks/useMemories';
import { useEraNotes } from '../hooks/useEraNotes';
import { MemoryCard, type MemoryCardAction } from '../components/MemoryCard';
import { ShareSheet, type SharePlatform } from '../components/ShareSheet';
import { EraNoteField } from '../components/EraNoteField';
import { NoteField } from '../components/NoteField';
import { eraDisplayName } from '../eraNote';
import { renderMemoryCard } from '../share/renderMemoryCard';
import { memoryChapterBlob, type MemoryChapterInput } from '../share/renderMemoryChapter';
import {
  copyFileToClipboard,
  downloadBlob,
  memoryCardFile,
  shareFile,
} from '../share/shareActions';

export interface MemoriesProps {
  /** Il database da leggere (iniettabile solo per i test). */
  readonly dbName?: string | undefined;
}

/** Lo stato del foglio di condivisione. */
interface ShareState {
  readonly state: 'generating' | 'ready' | 'error';
  readonly memory: MemoryCardModel;
  readonly imageUrl?: string | undefined;
  readonly file?: File | undefined;
}

/** L'etichetta del tipo di ricordo (le chiavi esistono già). */
function kindKey(kind: MemoryCardModel['kind']): string {
  switch (kind) {
    case 'on_this_day':
      return 'memories.onThisDay';
    case 'first_time':
      return 'memories.firstTime';
    case 'milestone':
      return 'memories.milestone';
    case 'return':
      return 'memories.return';
    case 'seasonal':
      return 'memories.seasonal';
    default:
      return 'memories.title';
  }
}

export function Memories({ dbName }: MemoriesProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  // La lingua della UI è sempre `it` o `en`: il fallback è `it`, la lingua
  // del progetto.
  const lang = isAppLanguage(language) ? language : 'it';
  const memories = useMemories(MEMORIES_PAGE_SIZE, dbName);
  const eraNotes = useEraNotes(dbName);
  const [share, setShare] = useState<ShareState | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  /** L'era che contiene il ricordo (per il nome sulla card). */
  const eraNameFor = useCallback(
    (memory: MemoryCardModel): string | null => {
      const at = new Date(memory.date).getTime();
      for (const era of eraNotes.eras) {
        if (at >= era.start && at < era.end) {
          return eraDisplayName(era.userNote, era.label);
        }
      }
      return null;
    },
    [eraNotes.eras],
  );

  /** Genera la card e apre il foglio di condivisione. */
  const openShare = useCallback(
    async (memory: MemoryCardModel) => {
      setShare({ state: 'generating', memory });
      try {
        const rendered = await renderMemoryCard({
          title: memory.title,
          periodLabel: formatDate(new Date(memory.date), lang, 'long'),
          eraName: eraNameFor(memory),
          symbolTrack:
            memory.trackName && memory.artistName
              ? {
                  name: memory.trackName,
                  artist: memory.artistName,
                  artworkUrl: memory.artworkUrl,
                }
              : null,
          artworks: [{ url: memory.artworkUrl, mood: null }],
        });
        const file = memoryCardFile(rendered.blob);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const imageUrl = URL.createObjectURL(rendered.blob);
        objectUrlRef.current = imageUrl;
        setShare({ state: 'ready', memory, imageUrl, file });
      } catch {
        setShare({ state: 'error', memory });
      }
    },
    [eraNameFor, lang],
  );

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  /** Infinite scroll: il sentinel che entra nel viewport chiede la pagina dopo. */
  const { hasMore, loadMore } = memories;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMore();
      }
    });
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMore]);

  /** Le destinazioni di condivisione (tutte sul file locale). */
  const platforms = useMemo<readonly SharePlatform[]>(() => {
    if (!share?.file) return [];
    const file = share.file;
    const memory = share.memory;
    const nativeShare = async () => {
      const shared = await shareFile(file);
      if (!shared) downloadBlob(file, 'life-soundtrack.png');
    };
    const chapter: MemoryChapterInput = {
      title: memory.title,
      periodLabel: formatDate(new Date(memory.date), lang, 'long'),
      eraName: eraNameFor(memory),
      symbolTrack:
        memory.trackName && memory.artistName
          ? { name: memory.trackName, artist: memory.artistName, artworkUrl: memory.artworkUrl }
          : null,
      artworks: [{ url: memory.artworkUrl, mood: null }],
    };
    return [
      {
        id: 'instagram',
        icon: '📷',
        label: t('share.instagram'),
        onClick: () => void nativeShare(),
      },
      { id: 'whatsapp', icon: '💬', label: t('share.whatsapp'), onClick: () => void nativeShare() },
      { id: 'twitter', icon: '✖️', label: t('share.twitter'), onClick: () => void nativeShare() },
      {
        id: 'copy',
        icon: '📋',
        label: t('share.copy'),
        onClick: () => {
          void (async () => {
            const copied = await copyFileToClipboard(file);
            if (!copied) downloadBlob(file, 'life-soundtrack.png');
          })();
        },
      },
      {
        id: 'download',
        icon: '⬇️',
        label: t('share.download'),
        onClick: () => {
          downloadBlob(file, 'life-soundtrack.png');
        },
      },
      {
        id: 'html',
        icon: '🧾',
        label: t('share.html'),
        onClick: () => {
          downloadBlob(memoryChapterBlob(chapter), 'life-soundtrack.html');
        },
      },
    ];
  }, [eraNameFor, lang, share, t]);

  const actionsFor = useCallback(
    (memory: MemoryCardModel): readonly MemoryCardAction[] => [
      { icon: '🙈', label: t('memories.hide'), onClick: () => memories.dismiss(memory.id) },
      { icon: '⭐', label: t('memories.save'), onClick: () => memories.save(memory.id) },
      { icon: '📤', label: t('memories.share'), onClick: () => void openShare(memory) },
    ],
    [memories, openShare, t],
  );

  return (
    <section className="memories" data-testid="memories-screen">
      <h2 className="memories__title">{t('memories.title')}</h2>

      {memories.state === 'loading' && (
        <p className="memories__status" role="status" data-testid="memories-loading">
          {t('memories.loading')}
        </p>
      )}

      {memories.state === 'empty' && (
        <p className="memories__status" data-testid="memories-empty">
          {t('empty.description.memories')}
        </p>
      )}

      {memories.state === 'error' && (
        <p className="memories__status" role="alert" data-testid="memories-error">
          {t('memories.error')}
        </p>
      )}

      <ul className="memories__list">
        {memories.items.map((memory) => (
          <li key={memory.id}>
            <MemoryCard
              title={memory.title}
              subtitle={t(kindKey(memory.kind))}
              date={formatDate(new Date(memory.date), lang, 'long')}
              artworkUrl={memory.artworkUrl}
              actions={actionsFor(memory)}
            />
            <NoteField
              fieldId={`memory-note-${memory.id}`}
              label={t('memories.noteLabel')}
              value={memory.userNote}
              ariaLabel={t('memories.noteAriaLabel')}
              onSave={(note) => {
                memories.tag(memory.id, note);
              }}
            />
          </li>
        ))}
      </ul>

      {memories.hasMore && (
        <div className="memories__more" ref={sentinelRef}>
          <button
            type="button"
            className="memories__load-more"
            data-testid="memories-load-more"
            onClick={memories.loadMore}
          >
            {t('memories.loadMore')}
          </button>
        </div>
      )}

      {eraNotes.eras.length > 0 && (
        <section className="memories__eras" data-testid="memories-eras">
          <h3 className="memories__eras-title">{t('memories.eras')}</h3>
          <p className="memories__eras-hint">{t('memories.erasHint')}</p>
          {eraNotes.eras.map((era) => (
            <EraNoteField
              key={era.id}
              eraId={era.id}
              label={era.label}
              userNote={era.userNote}
              ariaLabel={t('memories.eraAriaLabel')}
              onSave={eraNotes.rename}
            />
          ))}
        </section>
      )}

      {share && (
        <ShareSheet
          state={share.state}
          imageUrl={share.imageUrl}
          platforms={platforms}
          title={t('share.title')}
          generatingLabel={t('share.generating')}
          errorLabel={t('share.error')}
          retryLabel={t('share.retry')}
          closeLabel={t('share.close')}
          onClose={() => {
            setShare(null);
          }}
          onRetry={() => {
            void openShare(share.memory);
          }}
        />
      )}
    </section>
  );
}
