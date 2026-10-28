import { blobChunks } from '../jsonStream';
import { iterateJsonlLines } from '../jsonlStream';
import { extractZipEntry, isZip, listZipEntries } from '../zip';
import { AdapterError } from '../errors';
import type { ParseOptions, PlatformAdapter, RawListenEvent, RemoteSource } from '../types';
import { detectListenBrainz } from './detect';
import { mapListenBrainzEvent } from './mapEvent';
import { isListenBrainzListen } from './types';

/**
 * Adapter ListenBrainz — export API (ZIP con `listens/*.jsonl`, o JSONL
 * sciolto) (`03-ADAPTERS/listenbrainz.md`, 05-ARCHITECTURE.md §4).
 *
 * L'adapter è **file-only** nella Story 1.3: nessuna chiamata di rete, nessun
 * token, nessun rate limit. Dalla Story 1.5 implementa anche il percorso
 * **incrementale** (`parseRemote?`, ADR-0010) sul canale
 * `/1/user/{u}/listens` (`20-SCROBBLING-HUB.md` §9).
 */

/** Frequenza del check di cancellazione cooperativa (05§4). */
const SIGNAL_CHECK_EVERY = 100;

/** Path dei file di ascolto dentro l'archivio export. */
const LISTENS_PATH_RE = /^listens\/.+\.jsonl$/i;

/** File presenti nell'archivio ma **fuori scope** (E.LB.16). */
const DEFERRED_FILES = ['feedback.jsonl', 'pinned_recording.jsonl'];

/** Massimo elementi per richiesta (`MAX_ITEMS_PER_GET`, C-SH.4). */
const LISTENS_PAGE_SIZE = 1000;

/** Configurazione dell'adapter ListenBrainz. */
export interface ListenBrainzAdapterConfig {
  /** `fetch` iniettabile (test: nessuna rete reale). */
  fetchImpl?: typeof fetch | undefined;
  /** Orologio iniettabile (test del rate limit). */
  now?: (() => number) | undefined;
  /** Sleep iniettabile (test del rate limit). */
  sleep?: ((ms: number) => Promise<void>) | undefined;
}

/** Forma della risposta di `/1/user/{u}/listens`. */
interface ListenBrainzListensResponse {
  payload?: {
    count?: number;
    latest_listened_at?: number;
    listens?: unknown[];
  };
}

export class ListenBrainzAdapter implements PlatformAdapter {
  readonly platform = 'listenbrainz' as const;
  readonly name = 'ListenBrainz';
  readonly version = '1.0.0';

  /**
   * Ultimo `listened_at` letto dal percorso incrementale (unix s UTC).
   *
   * È il **cursore** della sync continua (C-SH.1): il core lo persiste dopo
   * l'import e lo ripassa come `pagination.to` alla sync successiva, così la
   * sync non re-importa da zero.
   */
  lastRemoteTimestamp: number | null = null;

  private readonly config: ListenBrainzAdapterConfig;

  constructor(config: ListenBrainzAdapterConfig = {}) {
    this.config = config;
  }

  /**
   * Riconoscimento strutturale dell'export (§2.2): ZIP con `listens/*.jsonl`
   * + `user.json`, oppure JSONL sciolto con prima riga valida.
   */
  detect(input: Blob): Promise<boolean> {
    return detectListenBrainz(input);
  }

  /**
   * Parsing streaming dell'export (05§4: mai tutto il file in memoria).
   *
   * - ZIP: si estrae **un file per volta** (`extractZipEntry`) e lo si
   *   consuma prima del successivo → picco di memoria limitato a un mese di
   *   ascolti. L'ordine dei mesi **non** è assunto (E.LB.14): l'ordine
   *   finale degli eventi è determinato dal `listened_at`.
   * - JSONL sciolto: stream identico, dal file estratto a mano.
   */
  async *parse(input: Blob, options: ParseOptions = {}): AsyncGenerator<RawListenEvent> {
    const onWarning = options.onWarning;
    const checkSignal = (): void => {
      if (options.signal?.aborted) {
        throw new DOMException('Import cancellato', 'AbortError');
      }
    };
    /** E.LB.1: righe senza durata catalogo → un solo warning aggregato. */
    const counter = { durationMissing: 0 };

    if (await isZip(input)) {
      const names = await listZipEntries(input);
      const zipBytes = new Uint8Array(await input.arrayBuffer());
      let deferred = false;
      for (const name of names) {
        const lower = name.toLowerCase();
        if (DEFERRED_FILES.some((file) => lower.endsWith(`/${file}`) || lower === file)) {
          // E.LB.16: feedback e pinned non sono modellati (02§3.3).
          deferred = true;
          continue;
        }
        if (!LISTENS_PATH_RE.test(name)) {
          continue;
        }
        const data = await extractZipEntry(zipBytes, name);
        if (!data) {
          continue;
        }
        const file = new Blob([new Uint8Array(data) as unknown as ArrayBuffer]);
        yield* this.streamJsonl(file, onWarning, checkSignal, counter);
      }
      if (deferred) {
        onWarning?.('adapter.listenbrainz.info.libraryDeferred');
      }
    } else {
      yield* this.streamJsonl(input, onWarning, checkSignal, counter);
    }
    if (counter.durationMissing > 0) {
      onWarning?.('adapter.listenbrainz.warn.durationMissing', counter.durationMissing);
    }
  }

  /**
   * Streaming di un file JSONL: ogni riga è un oggetto JSON indipendente.
   * Una riga malformata **non** abortisce lo stream (la riga viene scartata
   * con warning e il parsing continua).
   */
  private async *streamJsonl(
    file: Blob,
    onWarning: ((code: string, count?: number) => void) | undefined,
    checkSignal: () => void,
    counter: { durationMissing: number },
  ): AsyncGenerator<RawListenEvent> {
    let sinceCheck = 0;
    for await (const line of iterateJsonlLines(blobChunks(file))) {
      sinceCheck += 1;
      if (sinceCheck >= SIGNAL_CHECK_EVERY) {
        sinceCheck = 0;
        checkSignal();
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        // Riga malformata: scartata, lo stream continua (§10).
        onWarning?.('adapter.listenbrainz.warn.malformedSkipped');
        continue;
      }
      if (!isListenBrainzListen(parsed)) {
        onWarning?.('adapter.listenbrainz.warn.malformedSkipped');
        continue;
      }
      const result = await mapListenBrainzEvent(parsed);
      if (!result.raw) {
        if (result.discardReason === 'tooOld') {
          onWarning?.('adapter.listenbrainz.warn.tooOldSkipped');
        } else if (result.discardReason === 'noTitle') {
          onWarning?.('adapter.listenbrainz.warn.noTitleSkipped');
        } else {
          onWarning?.('adapter.listenbrainz.warn.malformedSkipped');
        }
        continue;
      }
      if (result.raw.sourceTrackDurationMs === null) {
        counter.durationMissing += 1;
      }
      yield result.raw;
    }
  }

  /**
   * Percorso **incrementale** (`parseRemote?`, ADR-0010) — Story 1.5,
   * `20-SCROBBLING-HUB.md` §9.
   *
   * - `source.endpoint`: base URL dell'utente (`…/1/user/{username}`); la
   *   pagina `/listens` è aggiunta qui;
   * - `source.credentials.sessionKey`: **User Token** (header
   *   `Authorization: Token …`);
   * - `source.headers`: `User-Agent` obbligatorio (C-SH.5);
   * - `source.pagination.to`: il **cursore** (ultimo `listened_at` letto): la
   *   richiesta usa `max_ts = cursore - 1`, così l'evento al confine non viene
   *   riletto (C-SH.2, E.LB.7).
   *
   * Il ciclo è **incrementale**: si ferma a pagina vuota (C-SH.3) e rispetta il
   * rate limit di 1 req/s (C-SH.6).
   */
  async *parseRemote(
    source: RemoteSource,
    options: ParseOptions = {},
  ): AsyncGenerator<RawListenEvent> {
    const endpoint = (source.endpoint ?? '').trim().replace(/\/+$/, '');
    if (endpoint.length === 0) {
      throw new AdapterError(
        'SOURCE_UNREACHABLE',
        "Endpoint ListenBrainz mancante: configura l'account nelle impostazioni",
        { recoverable: true },
      );
    }
    const token = (source.credentials?.sessionKey ?? '').trim();
    if (token.length === 0) {
      throw new AdapterError(
        'INVALID_FORMAT',
        'User Token ListenBrainz mancante: completa la configurazione nelle impostazioni',
      );
    }
    const onWarning = options.onWarning;
    const signal = source.signal ?? options.signal;
    const fetchImpl = this.config.fetchImpl ?? ((input, init) => fetch(input, init));
    const sleep =
      this.config.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

    // Il cursore arriva come limite superiore della finestra; si scende di
    // un secondo per non rileggere l'evento al confine (C-SH.2).
    let maxTs = source.pagination?.to ?? null;
    let sinceCheck = 0;

    for (;;) {
      if (signal?.aborted) {
        throw new DOMException('Import cancellato', 'AbortError');
      }
      const url = new URL(`${endpoint}/listens`);
      url.searchParams.set('count', String(LISTENS_PAGE_SIZE));
      if (maxTs !== null) {
        url.searchParams.set('max_ts', String(maxTs));
      }

      const response = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Token ${token}`,
          ...(source.headers ?? {}),
        },
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) {
        throw new AdapterError(
          response.status === 401 || response.status === 403
            ? 'INVALID_FORMAT'
            : 'SOURCE_UNREACHABLE',
          `ListenBrainz ha risposto ${response.status}`,
          { recoverable: response.status >= 500 || response.status === 429 },
        );
      }
      const parsed = safeJson(await response.text());
      const listens = parsed?.payload?.listens ?? [];
      if (listens.length === 0) {
        // C-SH.3: stop pulito a pagina vuota.
        return;
      }

      let pageMax = maxTs;
      for (const listen of listens) {
        sinceCheck += 1;
        if (sinceCheck >= SIGNAL_CHECK_EVERY) {
          sinceCheck = 0;
          if (signal?.aborted) {
            throw new DOMException('Import cancellato', 'AbortError');
          }
        }
        if (!isListenBrainzListen(listen)) {
          onWarning?.('adapter.listenbrainz.warn.malformedSkipped');
          continue;
        }
        const result = await mapListenBrainzEvent(listen);
        if (!result.raw) {
          if (result.discardReason === 'tooOld') {
            onWarning?.('adapter.listenbrainz.warn.tooOldSkipped');
          } else if (result.discardReason === 'noTitle') {
            onWarning?.('adapter.listenbrainz.warn.noTitleSkipped');
          } else {
            onWarning?.('adapter.listenbrainz.warn.malformedSkipped');
          }
          continue;
        }
        const listenedAt = typeof listen.listened_at === 'number' ? listen.listened_at : null;
        if (listenedAt !== null) {
          this.lastRemoteTimestamp = Math.max(this.lastRemoteTimestamp ?? 0, listenedAt);
          pageMax = pageMax === null ? listenedAt : Math.min(pageMax, listenedAt);
        }
        yield result.raw;
      }

      if (pageMax === null || pageMax === maxTs) {
        // Nessun progresso possibile: stop (evita il loop infinito).
        return;
      }
      maxTs = pageMax - 1;
      // C-SH.6: 1 req/s.
      await sleep(1000);
    }
  }
}

/** Parse JSON tollerante: `null` se il corpo non è JSON. */
function safeJson(text: string): ListenBrainzListensResponse | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed as ListenBrainzListensResponse;
  } catch {
    return null;
  }
}
