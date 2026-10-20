/* Tipi dello stato di onboarding / import (Story 0.4). */
import type { PlatformId, PrivacySettings } from '@core/schema';

export type OnboardingScreen = 'welcome' | 'privacy' | 'import' | 'processing' | 'reveal';

export type PlatformCardStatus = 'empty' | 'validating' | 'parsing' | 'done' | 'error';

export interface ImportPlatformState {
  status: PlatformCardStatus;
  file: File | null;
  error: string | null;
  eventsParsed: number;
  eventsInserted: number;
  uniqueTracks: number;
}

export interface ImportOrchestrator {
  detect: (platform: PlatformId, file: File) => Promise<boolean>;
  import: (
    platform: PlatformId,
    file: File,
    privacy: PrivacySettings,
    onProgress: (eventsParsed: number) => void,
    signal: AbortSignal,
  ) => Promise<{ eventsInserted: number; uniqueTracks: number; error: string | null }>;
}
