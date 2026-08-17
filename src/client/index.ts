/**
 * niu-lai sound board plugin, browser half.
 *
 * Watches every session's conversation snapshot (the outward SessionFace
 * observable) and plays:
 *  - 妈妈 when a user message arrives (user or steering node),
 *  - 牛来 when a task completes (turn end, finalized assistant message, or
 *    terminal turn error).
 *
 * Playback sources: the embedded movie clips are the defaults; the settings
 * tab (Plugins settings → 牛来音效) replaces either clip, the volume, and the
 * master switch through localStorage — no Host round-trip.
 */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the ui-settings SlotMap merge (the settings.plugins.tab seat).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { MAMA_DEFAULT, NIULAI_DEFAULT } from './assets.ts'
import { createTriggerState, diffSnapshot, type TriggerWatchState } from './diff.ts'
import { readStored, resolveSettings, writeStored, type DefaultSounds, type SoundSettings, type StoredSoundPatch } from './settings.ts'
import { browserAudioEnv, SoundPlayer } from './player.ts'
import { SoundSettingsTab, type SoundSettingsTabInjected } from './SoundSettingsTab.tsx'
import { en, NS, zh, type NiuLaiLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** 《牛来》 sound board copy. */
    'niu-lai': NiuLaiLocaleKey
  }
}

/** Package display name for diagnostics. */
export const name = 'ui-niu-lai'

/** Required services: session snapshots, the settings tab slot, and copy. */
export const inject = ['sessions', 'slots', 'locale']

/** Built-in defaults: the user-provided movie clips, embedded at build time. */
const DEFAULTS: DefaultSounds = { mamaUrl: MAMA_DEFAULT, niulaiUrl: NIULAI_DEFAULT }

/**
 * Client plugin body: watch every session's snapshot and play the meme
 * sounds, and contribute the settings tab.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-niu-lai: dictionaries')

  const storage = window.localStorage
  const current = (): SoundSettings => resolveSettings(DEFAULTS, readStored(storage))
  const player = new SoundPlayer(() => current().volume, browserAudioEnv())
  ctx.effect(() => player.installUnlock(), 'ui-niu-lai: unlock listeners')

  // ── snapshot watcher ──────────────────────────────────────────────────────
  const sessions = ctx.sessions
  const states = new Map<SessionId, TriggerWatchState>()
  const unsubscribes = new Map<SessionId, () => void>()

  const watch = (id: SessionId): void => {
    if (unsubscribes.has(id)) return
    const binding = sessions.binding(id)
    if (binding === undefined) return
    const state = createTriggerState()
    states.set(id, state)
    const off = binding.session.subscribe(() => {
      const settings = current()
      if (!settings.enabled) return
      const triggers = diffSnapshot(binding.session.getSnapshot(), state)
      if (triggers.mama) void player.play(settings.mamaUrl)
      if (triggers.niulai) void player.play(settings.niulaiUrl)
    })
    unsubscribes.set(id, off)
  }

  const reconcile = (): void => {
    const list = sessions.list.getSnapshot()
    for (const id of Object.keys(list.byId) as SessionId[]) watch(id)
    for (const [id, off] of unsubscribes) {
      if (list.byId[id] === undefined) {
        off()
        unsubscribes.delete(id)
        states.delete(id)
      }
    }
  }

  ctx.effect(() => sessions.list.subscribe(reconcile), 'ui-niu-lai: session list watcher')
  reconcile()

  // ── settings tab ──────────────────────────────────────────────────────────
  const t = ctx.locale.bind(NS)
  const tabInjected = (): SoundSettingsTabInjected => ({
    load: current,
    save: (patch: StoredSoundPatch) => {
      writeStored(storage, { ...readStored(storage), ...patch })
    },
    preview: (url: string) => {
      void player.play(url)
    },
  })

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'niu-lai',
    order: 20,
    label: () => t('tab'),
    locale: NS,
    inject: tabInjected,
  }, SoundSettingsTab))
}
