import { useId, useState, type ChangeEvent, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { NiuLaiLocaleKey } from './locales.ts'
import type { SoundSettings, StoredSoundPatch } from './settings.ts'
import css from './SoundSettingsTab.module.css'

/** Registration-side face the apply closure supplies. */
export interface SoundSettingsTabInjected {
  /** Read the current resolved settings (defaults + stored overrides). */
  load: () => SoundSettings
  /** Persist an override patch (merged over the existing document). */
  save: (patch: StoredSoundPatch) => void
  /** Play one clip at the current volume (the tab's 试听 button). */
  preview: (url: string) => void
}

/** Full component props assembled by the Settings slot renderer. */
export type SoundSettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'niu-lai'>
  & InjectFace<SoundSettingsTabInjected>

/** localStorage ceiling guard: the 5 MB quota minus the built-in user data. */
const MAX_FILE_BYTES = 4 * 1024 * 1024

type ClipField = 'mamaUrl' | 'niulaiUrl'
type NameField = 'mamaName' | 'niulaiName'

/**
 * Settings tab for the sound board: master switch, volume, and one row per
 * clip (replace, preview, reset). Edits persist immediately to localStorage —
 * the plugin reads the stored layer on every trigger, so no save ceremony.
 */
export function SoundSettingsTab({ load, save, preview, t }: SoundSettingsTabProps): ReactNode {
  const inputId = useId()
  const [settings, setSettings] = useState<SoundSettings>(() => load())

  const update = (patch: StoredSoundPatch): void => {
    save(patch)
    setSettings(load())
  }

  const onPick = (field: ClipField, nameField: NameField) => (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (file === undefined) return
    if (file.size > MAX_FILE_BYTES) {
      window.alert(t('fileTooLarge'))
      input.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') update({ [field]: reader.result, [nameField]: file.name })
    }
    reader.onerror = () => {
      input.value = ''
    }
    reader.readAsDataURL(file)
    // Clear now so picking the same file again still fires change.
    input.value = ''
  }

  const row = (field: ClipField, nameField: NameField, label: string, url: string, name: string | null): ReactNode => {
    const fileInputId = `${inputId}-${field}`
    const shownName = name ?? t('builtin')
    return (
      <div className={css.row}>
        <div className={css.rowHeader}>
          <span className={css.rowLabel}>{label}</span>
          <span className={css.rowName} data-kind={name === null ? 'builtin' : 'custom'}>
            {shownName}
          </span>
        </div>
        <div className={css.rowControls}>
          <label className={css.fileButton} htmlFor={fileInputId}>{t('choose')}</label>
          <input
            id={fileInputId}
            className={css.fileInput}
            type="file"
            accept="audio/*"
            onChange={onPick(field, nameField)}
          />
          <button type="button" className={css.button} onClick={() => preview(url)}>{t('preview')}</button>
          <button
            type="button"
            className={css.button}
            disabled={name === null}
            onClick={() => update({ [field]: undefined, [nameField]: undefined })}
          >
            {t('reset')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={css.section}>
      <h3 className={css.title}>{t('title')}</h3>
      <p className={css.description}>{t('description')}</p>
      <div className={css.master}>
        <label className={css.checkbox}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => { update({ enabled: event.currentTarget.checked }) }}
          />
          {t('enabled')}
        </label>
        <label className={css.volume}>
          <span>{t('volume')}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.volume * 100)}
            onChange={(event) => { update({ volume: Number(event.currentTarget.value) / 100 }) }}
          />
          <span className={css.volumeValue}>{Math.round(settings.volume * 100)}%</span>
        </label>
      </div>
      {row('mamaUrl', 'mamaName', t('mamaLabel'), settings.mamaUrl, settings.mamaName)}
      {row('niulaiUrl', 'niulaiName', t('niulaiLabel'), settings.niulaiUrl, settings.niulaiName)}
    </div>
  )
}

/** Referenced so the locale key union is not unused in the module graph. */
export type { NiuLaiLocaleKey }
