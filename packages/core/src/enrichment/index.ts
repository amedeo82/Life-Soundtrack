/**
 * Barrel pubblico della pipeline delle audio features —
 * `21-AUDIO-FEATURES.md` v1.0 🟢 §4.3 (T4.1.7).
 *
 * Esposto come subpath `@ls/core/enrichment`: il core resta **senza React**
 * (D-AF.5) e questo modulo non contiene stringhe UI né accesso diretto
 * alla rete (il client HTTP è iniettato).
 */

export {
  type AudioFeatureProvider,
  type Clock,
  type EnrichmentOutcome,
  type EnrichmentPolicy,
  type EnrichmentStatus,
  type EnrichmentTrigger,
  type FeatureContext,
  type FeatureField,
  type FeatureOrigin,
  type FeatureSource,
  type FeatureStore,
  type HttpClient,
  type HttpRequestInit,
  type HttpResponse,
  type RateLimiter,
  type Sleep,
} from './types';

export {
  ACOUSTICBRAINZ_TTL_MS,
  CURRENT_FEATURE_SCHEMA_VERSION,
  FEATURE_ORIGINS,
  type AcousticBrainzMood,
  type ClampReporter,
  type RawFeature,
  UNIT_FIELDS,
  clamp01,
  deriveEnergyFromMood,
  deriveValenceFromMood,
  featureOrigin,
  normalizeDeamScore,
  normalizeFeature,
  round4,
} from './mapping';

export {
  ITUNES_MIN_INTERVAL_MS,
  MUSICBRAINZ_MIN_INTERVAL_MS,
  RATE_LIMIT_HEADERS,
  type FixedIntervalLimiterOptions,
  type HeaderRateLimiterOptions,
  createAcousticBrainzLimiter,
  createFixedIntervalLimiter,
  createHeaderRateLimiter,
  createItunesLimiter,
  createMusicBrainzLimiter,
  parseRetryAfterMs,
} from './rateLimiter';

export {
  ITUNES_RATE_LIMIT_PER_MINUTE,
  ITUNES_SEARCH_ENDPOINT,
  type ItunesPreview,
  type ItunesPreviewResolver,
  type ItunesPreviewResolverOptions,
  type ItunesSearchResponse,
  type ItunesSearchResult,
  buildItunesSearchUrl,
  createItunesPreviewResolver,
  isExactMatch,
  normalizeMatchText,
} from './itunes';

export {
  type EssentiaAnalysis,
  type EssentiaEngine,
  type EssentiaEngineFactory,
  type EssentiaLoaderOptions,
  type EssentiaModule,
  type EssentiaModuleOptions,
  type EssentiaProviderOptions,
  createEssentiaEngineFactory,
  createEssentiaProvider,
} from './essentia';

export {
  ACOUSTICBRAINZ_API_BASE,
  type AcousticBrainzHighLevel,
  type AcousticBrainzProviderOptions,
  createAcousticBrainzProvider,
  extractMood,
  isAcousticBrainzExpired,
  readNumericField,
} from './acousticbrainz';

export {
  GENRE_ACOUSTICNESS,
  GENRE_DANCEABILITY,
  GENRE_TEMPO,
  type HeuristicProviderOptions,
  createHeuristicProvider,
  estimateFromGenres,
  normalizeGenre,
} from './heuristic';

export {
  type EnrichmentCascade,
  type EnrichmentCascadeOptions,
  type EnrichmentProviders,
  type EnrichmentRequest,
  createEnrichmentCascade,
  isEmptyFeature,
  sameValues,
} from './cascade';

export {
  type MemoryFeatureStore,
  createDexieFeatureStore,
  createMemoryFeatureStore,
  evictOverflowingFeatures,
  isFeatureExpired,
} from './storage';

export {
  DEFAULT_DAILY_BUDGET_MS,
  type EnrichmentQueue,
  type EnrichmentQueueOptions,
  type EnrichmentRunReport,
  type EnrichmentStopReason,
  budgetDayKey,
  createEnrichmentQueue,
} from './queue';

export {
  ARTWORK_CURSOR_KEY,
  type ArtworkCursor,
  type ArtworkDeps,
  type ArtworkOutcome,
  type ArtworkRequest,
  type ArtworkSource,
  COVER_ART_ENDPOINT,
  EMPTY_ARTWORK_CURSOR,
  ITUNES_ALBUM_ENDPOINT,
  buildItunesArtworkUrl,
  fetchArtworkUrl,
  fetchCoverArtArchive,
  fetchItunesArtwork,
  generatePlaceholderGradient,
  isExactArtworkMatch,
  isTrackAttempted,
  persistArtwork,
  upgradeArtworkUrl,
} from './artwork';
