// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SoundSettingsTab, type SoundSettingsTabProps } from '../src/client/SoundSettingsTab.tsx'
import type { NiuLaiLocaleKey } from '../src/client/locales.ts'
import { zh } from '../src/client/locales.ts'
import { resolveSettings, type StoredSoundPatch } from '../src/client/settings.ts'

const DEFAULTS = { mamaUrl: 'data:default-mama', niulaiUrl: 'data:default-niulai' }

afterEach(cleanup)

interface Harness {
  stored: StoredSoundPatch
  save: ReturnType<typeof vi.fn>
  preview: ReturnType<typeof vi.fn>
}

function renderTab(stored: StoredSoundPatch = {}): Harness {
  const harness: Harness = {
    stored: { ...stored },
    save: vi.fn((patch: StoredSoundPatch) => {
      harness.stored = { ...harness.stored, ...patch }
    }),
    preview: vi.fn(),
  }
  const props = {
    load: () => resolveSettings(DEFAULTS, harness.stored),
    save: harness.save,
    preview: harness.preview,
    t: (key: NiuLaiLocaleKey) => zh[key],
  } as unknown as SoundSettingsTabProps
  render(<SoundSettingsTab {...props} />)
  return harness
}

describe('SoundSettingsTab', () => {
  it('renders the title, master controls, and built-in clip rows', () => {
    renderTab()
    expect(screen.getByText('牛来音效')).toBeTruthy()
    expect(screen.getAllByText('内置默认')).toHaveLength(2)
    expect(screen.getByRole('checkbox')).toBeTruthy()
    expect(screen.getByRole('slider')).toBeTruthy()
  })

  it('previews the current clip source', () => {
    const harness = renderTab()
    const previews = screen.getAllByRole('button', { name: '试听' })
    fireEvent.click(previews[0]!)
    expect(harness.preview).toHaveBeenCalledWith('data:default-mama')
    fireEvent.click(previews[1]!)
    expect(harness.preview).toHaveBeenCalledWith('data:default-niulai')
  })

  it('toggles the master switch and writes the volume', () => {
    const harness = renderTab()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(harness.save).toHaveBeenCalledWith({ enabled: false })
    fireEvent.change(screen.getByRole('slider'), { target: { value: '50' } })
    expect(harness.save).toHaveBeenCalledWith({ volume: 0.5 })
  })

  it('resets a replaced clip back to the built-in default', () => {
    const harness = renderTab({ mamaUrl: 'data:custom', mamaName: 'custom.mp3' })
    expect(screen.getByText('custom.mp3')).toBeTruthy()
    const resets = screen.getAllByRole('button', { name: '恢复默认' })
    expect((resets[0]! as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(resets[0]!)
    expect(harness.save).toHaveBeenCalledWith({ mamaUrl: undefined, mamaName: undefined })
  })

  it('keeps the reset button disabled for built-in clips', () => {
    renderTab()
    const resets = screen.getAllByRole('button', { name: '恢复默认' })
    for (const button of resets) expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('stores a picked audio file as a data url', async () => {
    const harness = renderTab()
    const file = new File(['clip-bytes'], 'mama.mp3', { type: 'audio/mpeg' })
    const picker = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(picker, { target: { files: [file] } })
    await waitFor(() => expect(harness.save).toHaveBeenCalled())
    const patch = harness.save.mock.calls[0]![0] as StoredSoundPatch
    expect(patch.mamaName).toBe('mama.mp3')
    expect(patch.mamaUrl).toMatch(/^data:audio\/mpeg;base64,/)
  })

  it('rejects oversized files with an alert', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    renderTab()
    const file = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'big.mp3', { type: 'audio/mpeg' })
    const picker = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(picker, { target: { files: [file] } })
    expect(alert).toHaveBeenCalledWith(zh.fileTooLarge)
  })
})
