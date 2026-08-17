/**
 * Settings model for the sound board. Two layers:
 *  - built-in defaults (the embedded movie clips from assets.ts),
 *  - localStorage overrides written by the settings tab (user-provided clips,
 *    volume, master switch). No Host round-trip, no restart.
 */

/** Built-in clip sources; the overrides layer may replace either one. */
export interface DefaultSounds {
  mamaUrl: string
  niulaiUrl: string
}

/** Fully resolved settings a consumer reads. */
export interface SoundSettings {
  enabled: boolean
  /** Playback gain in [0, 1]. */
  volume: number
  mamaUrl: string
  niulaiUrl: string
  /** Display name of a user-provided clip; null = built-in default. */
  mamaName: string | null
  niulaiName: string | null
}

/** Persisted override layer — every field optional, absent means fall back. */
export interface StoredSoundPatch {
  enabled?: boolean
  volume?: number
  mamaUrl?: string
  mamaName?: string
  niulaiUrl?: string
  niulaiName?: string
}

export const SOUND_SETTINGS_KEY = 'dsh.ui-niu-lai.settings'

/** Minimal Storage face so tests can drive a fake. */
export interface SettingsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Read the override layer; any corrupt document degrades to empty. */
export function readStored(storage: SettingsStorage): StoredSoundPatch {
  try {
    const raw = storage.getItem(SOUND_SETTINGS_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as StoredSoundPatch
  } catch {
    return {}
  }
}

/** Persist the override layer (replaces the whole document). */
export function writeStored(storage: SettingsStorage, patch: StoredSoundPatch): void {
  storage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(patch))
}

/** Clamp a volume value into [0, 1]; non-finite values fall back. */
export function clampVolume(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

/** Merge the override layer over the built-in defaults. */
export function resolveSettings(defaults: DefaultSounds, stored: StoredSoundPatch): SoundSettings {
  return {
    enabled: stored.enabled ?? true,
    volume: clampVolume(stored.volume ?? 1, 1),
    mamaUrl: stored.mamaUrl !== undefined && stored.mamaUrl !== '' ? stored.mamaUrl : defaults.mamaUrl,
    niulaiUrl: stored.niulaiUrl !== undefined && stored.niulaiUrl !== '' ? stored.niulaiUrl : defaults.niulaiUrl,
    mamaName: stored.mamaName ?? null,
    niulaiName: stored.niulaiName ?? null,
  }
}
