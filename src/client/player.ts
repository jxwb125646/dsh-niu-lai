/**
 * Web Audio playback. The context is created lazily and unlocked by the
 * first user gesture (pointerdown/keydown) so autoplay policies never block
 * a later trigger. Decoded buffers are cached per source URL; failures are
 * warnings — playback is decorative and must never break the app.
 */
import { clampVolume } from './settings.ts'

/** Testable audio environment: the context constructor and the decoder. */
export interface AudioEnv {
  AudioContextCtor: typeof AudioContext
  decode: (context: AudioContext, data: ArrayBuffer) => Promise<AudioBuffer>
}

/** Browser default: the ambient constructor plus the native decoder. */
export function browserAudioEnv(): AudioEnv {
  return {
    AudioContextCtor: window.AudioContext,
    decode: (context, data) => context.decodeAudioData(data),
  }
}

/** Play a buffered clip through a per-play gain node at the current volume. */
export class SoundPlayer {
  private context: AudioContext | null = null
  private readonly buffers = new Map<string, AudioBuffer>()
  private readonly inflight = new Map<string, Promise<AudioBuffer | null>>()

  constructor(
    private readonly volumeOf: () => number,
    private readonly env: AudioEnv,
  ) {}

  /** Create (or resume) the context — call on any user gesture. */
  unlock(): void {
    const context = this.ensureContext()
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined)
    }
  }

  /**
   * One-time-per-gesture global listeners that unlock the context.
   * @returns the disposer removing both listeners.
   */
  installUnlock(): () => void {
    const onGesture = (): void => {
      this.unlock()
    }
    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }

  /**
   * Play one clip at the current volume. Never throws: playback is
   * decorative, a failed sound must not break the caller.
   * @param src - data:, http(s):, or blob: URL of the clip.
   */
  async play(src: string): Promise<void> {
    try {
      const context = this.ensureContext()
      if (context.state === 'suspended') {
        await context.resume().catch(() => undefined)
      }
      if (context.state !== 'running') return
      const buffer = await this.loadBuffer(src)
      if (buffer === null) return
      const source = context.createBufferSource()
      const gain = context.createGain()
      gain.gain.value = clampVolume(this.volumeOf(), 1)
      source.buffer = buffer
      source.connect(gain)
      gain.connect(context.destination)
      source.start(0)
    } catch (error) {
      console.warn('[ui-niu-lai] playback failed', error)
    }
  }

  private ensureContext(): AudioContext {
    if (this.context === null) this.context = new this.env.AudioContextCtor()
    return this.context
  }

  /** Decode (and cache) one source; concurrent plays share one decode. */
  private async loadBuffer(src: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(src)
    if (cached !== undefined) return cached
    const pending = this.inflight.get(src)
    if (pending !== undefined) return pending
    const task = (async (): Promise<AudioBuffer | null> => {
      try {
        const data = await this.readSource(src)
        if (data === null) return null
        const buffer = await this.env.decode(this.ensureContext(), data)
        this.buffers.set(src, buffer)
        return buffer
      } finally {
        this.inflight.delete(src)
      }
    })()
    this.inflight.set(src, task)
    return task
  }

  private async readSource(src: string): Promise<ArrayBuffer | null> {
    if (src.startsWith('data:')) return this.dataUrlToArrayBuffer(src)
    const response = await fetch(src)
    if (!response.ok) return null
    return response.arrayBuffer()
  }

  private dataUrlToArrayBuffer(src: string): ArrayBuffer | null {
    const comma = src.indexOf(',')
    if (comma < 0) return null
    const bytes = atob(src.slice(comma + 1))
    const out = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i += 1) out[i] = bytes.charCodeAt(i)
    return out.buffer
  }
}
