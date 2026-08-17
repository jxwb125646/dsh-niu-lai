// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SoundPlayer, type AudioEnv } from '../src/client/player.ts'

interface FakeSource {
  buffer: unknown
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  onended: (() => void) | null
}

interface FakeContext {
  state: 'running' | 'suspended'
  destination: object
  resume: ReturnType<typeof vi.fn>
  createBufferSource: ReturnType<typeof vi.fn>
  createGain: ReturnType<typeof vi.fn>
  decodeAudioData: ReturnType<typeof vi.fn>
  sources: FakeSource[]
}

function makeContext(): { context: FakeContext; gain: { gain: { value: number }; connect: ReturnType<typeof vi.fn> } } {
  const context: FakeContext = {
    state: 'running',
    destination: {},
    resume: vi.fn(async () => { context.state = 'running' }),
    createBufferSource: vi.fn(),
    createGain: vi.fn(),
    decodeAudioData: vi.fn(async () => ({})),
    sources: [],
  }
  const gain = { gain: { value: 0 }, connect: vi.fn() }
  context.createGain.mockReturnValue(gain)
  context.createBufferSource.mockImplementation(() => {
    const source: FakeSource = {
      buffer: null,
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
    }
    context.sources.push(source)
    return source
  })
  return { context, gain }
}

function env(context: FakeContext): AudioEnv {
  // A regular function (not an arrow) so `new` can construct it.
  const ctor = function (): FakeContext { return context }
  return {
    AudioContextCtor: ctor as unknown as typeof AudioContext,
    decode: (ctx, data) => ctx.decodeAudioData(data),
  }
}

/** 'abc' in base64. */
const DATA_URL = 'data:audio/mpeg;base64,YWJj'
/** 'a' in base64 — a different clip source. */
const OTHER_URL = 'data:audio/mpeg;base64,YQ=='

describe('SoundPlayer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('decodes a data url once and reuses the cached buffer', async () => {
    const { context } = makeContext()
    const player = new SoundPlayer(() => 1, env(context))
    await player.play(DATA_URL)
    await player.play(DATA_URL)
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1)
    const arg = context.decodeAudioData.mock.calls[0]![0] as ArrayBuffer
    expect(new Uint8Array(arg)).toEqual(new Uint8Array([97, 98, 99]))
    expect(context.createBufferSource).toHaveBeenCalledTimes(2)
  })

  it('applies the current volume through the gain node', async () => {
    const { context, gain } = makeContext()
    let volume = 0.25
    const player = new SoundPlayer(() => volume, env(context))
    await player.play(DATA_URL)
    expect(gain.gain.value).toBe(0.25)
    volume = 1
    await player.play(DATA_URL)
    expect(gain.gain.value).toBe(1)
  })

  it('resumes a suspended context before playing', async () => {
    const { context } = makeContext()
    context.state = 'suspended'
    const player = new SoundPlayer(() => 1, env(context))
    await player.play(DATA_URL)
    expect(context.resume).toHaveBeenCalled()
    expect(context.createBufferSource).toHaveBeenCalledTimes(1)
  })

  it('gives up silently when the context stays suspended', async () => {
    const { context } = makeContext()
    context.state = 'suspended'
    context.resume.mockImplementation(async () => { /* stays suspended */ })
    const player = new SoundPlayer(() => 1, env(context))
    await player.play(DATA_URL)
    expect(context.createBufferSource).not.toHaveBeenCalled()
  })

  it('warns instead of throwing on decode failure', async () => {
    const { context } = makeContext()
    context.decodeAudioData.mockRejectedValue(new Error('decode boom'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const player = new SoundPlayer(() => 1, env(context))
    await expect(player.play(DATA_URL)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
  })

  it('interrupts the previous clip when a new one starts', async () => {
    const { context } = makeContext()
    const player = new SoundPlayer(() => 1, env(context))
    await player.play(DATA_URL)
    await player.play(OTHER_URL)
    const [first, second] = context.sources
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    // The lingering clip is stopped and disconnected before the new one starts.
    expect(first!.stop).toHaveBeenCalledTimes(1)
    expect(first!.disconnect).toHaveBeenCalledTimes(1)
    expect(second!.start).toHaveBeenCalledTimes(1)
    expect(second!.stop).not.toHaveBeenCalled()
  })

  it('does not silence the current clip when the new clip fails to load', async () => {
    const { context } = makeContext()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const player = new SoundPlayer(() => 1, env(context))
    await player.play(DATA_URL)
    // '@' is not valid base64 — reading this data url throws.
    await player.play('data:audio/mpeg;base64,@@@@')
    expect(warn).toHaveBeenCalled()
    const [first] = context.sources
    expect(first!.stop).not.toHaveBeenCalled()
  })

  it('forgets a finished source so it is not interrupted again', async () => {
    const { context } = makeContext()
    const player = new SoundPlayer(() => 1, env(context))
    await player.play(DATA_URL)
    const [first] = context.sources
    // Simulate natural playback end.
    first!.onended?.()
    await player.play(OTHER_URL)
    expect(first!.stop).not.toHaveBeenCalled()
  })

  it('installs and removes the gesture unlock listeners', () => {
    const { context } = makeContext()
    context.state = 'suspended'
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const player = new SoundPlayer(() => 1, env(context))
    const dispose = player.installUnlock()
    expect(add).toHaveBeenCalledWith('pointerdown', expect.any(Function))
    expect(add).toHaveBeenCalledWith('keydown', expect.any(Function))
    // Simulate a gesture: the captured handler resumes the context.
    const handler = add.mock.calls.find(([type]) => type === 'pointerdown')?.[1] as () => void
    handler()
    expect(context.resume).toHaveBeenCalled()
    dispose()
    expect(remove).toHaveBeenCalledWith('pointerdown', handler)
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
