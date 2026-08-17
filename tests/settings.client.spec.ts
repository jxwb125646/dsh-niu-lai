import { describe, expect, it } from 'vitest'
import {
  clampVolume, readStored, resolveSettings, SOUND_SETTINGS_KEY, writeStored,
  type SettingsStorage,
} from '../src/client/settings.ts'

function fakeStorage(initial: Record<string, string> = {}): SettingsStorage {
  const map = new Map(Object.entries(initial))
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value) },
  }
}

const DEFAULTS = { mamaUrl: 'data:default-mama', niulaiUrl: 'data:default-niulai' }

describe('readStored', () => {
  it('returns empty for a missing document', () => {
    expect(readStored(fakeStorage())).toEqual({})
  })

  it('parses a stored document', () => {
    expect(readStored(fakeStorage({ [SOUND_SETTINGS_KEY]: '{"volume":0.5,"enabled":false}' }))).toEqual({ volume: 0.5, enabled: false })
  })

  it('degrades to empty for corrupt documents', () => {
    expect(readStored(fakeStorage({ [SOUND_SETTINGS_KEY]: 'not-json' }))).toEqual({})
    expect(readStored(fakeStorage({ [SOUND_SETTINGS_KEY]: '"just-a-string"' }))).toEqual({})
  })
})

describe('writeStored', () => {
  it('serializes the patch under the plugin key', () => {
    const storage = fakeStorage()
    writeStored(storage, { volume: 0.25 })
    expect(readStored(storage)).toEqual({ volume: 0.25 })
  })

  it('replaces the whole document', () => {
    const storage = fakeStorage({ [SOUND_SETTINGS_KEY]: '{"volume":0.5,"enabled":false}' })
    writeStored(storage, { mamaUrl: 'data:x' })
    expect(readStored(storage)).toEqual({ mamaUrl: 'data:x' })
  })
})

describe('resolveSettings', () => {
  it('falls back to defaults when nothing is stored', () => {
    expect(resolveSettings(DEFAULTS, {})).toEqual({
      enabled: true,
      volume: 1,
      mamaUrl: 'data:default-mama',
      niulaiUrl: 'data:default-niulai',
      mamaName: null,
      niulaiName: null,
    })
  })

  it('applies stored overrides', () => {
    expect(resolveSettings(DEFAULTS, {
      enabled: false,
      volume: 0.3,
      mamaUrl: 'data:custom',
      mamaName: 'custom.mp3',
    })).toMatchObject({
      enabled: false,
      volume: 0.3,
      mamaUrl: 'data:custom',
      mamaName: 'custom.mp3',
      niulaiUrl: 'data:default-niulai',
    })
  })

  it('treats an empty stored url as absent', () => {
    expect(resolveSettings(DEFAULTS, { mamaUrl: '' }).mamaUrl).toBe('data:default-mama')
  })

  it('clamps the stored volume into [0, 1]', () => {
    expect(resolveSettings(DEFAULTS, { volume: 2 }).volume).toBe(1)
    expect(resolveSettings(DEFAULTS, { volume: -1 }).volume).toBe(0)
  })
})

describe('clampVolume', () => {
  it('clamps and falls back on non-finite values', () => {
    expect(clampVolume(0.5, 1)).toBe(0.5)
    expect(clampVolume(3, 1)).toBe(1)
    expect(clampVolume(-2, 1)).toBe(0)
    expect(clampVolume(Number.NaN, 0.7)).toBe(0.7)
  })
})
