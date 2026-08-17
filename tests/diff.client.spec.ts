import { describe, expect, it } from 'vitest'
import type { ConversationNode, ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { MessageId } from '@deepseek-ai/dsh-api-remotes/client'
import { createTriggerState, diffSnapshot, NO_TRIGGERS, type TriggerWatchState } from '../src/client/diff.ts'

const EMPTY_CHAT = {
  order: [],
  nodes: { get: () => undefined, values: () => [] },
  locations: { getTurn: () => [], getStep: () => [] },
  timeline: { turnOrder: [], turns: new Map() },
  legacy: {
    nodes: [],
    turnTimings: new Map(),
    turnEnds: new Map(),
    partial: null,
    runningCalls: [],
  },
}
const EMPTY_VIEWS = { get: () => undefined }

interface SnapshotInput {
  nodes?: readonly ConversationNode[]
  turnEnds?: ReadonlyMap<number, number>
  openState?: ConversationSnapshot['openState']
}

function snapshot(input: SnapshotInput = {}): ConversationSnapshot {
  const nodes = input.nodes ?? []
  const turnEnds = input.turnEnds ?? new Map()
  return {
    sessionId: 'test-session',
    views: EMPTY_VIEWS,
    chat: EMPTY_CHAT,
    nodes,
    turnTimings: new Map(),
    turnEnds,
    partial: null,
    runningCalls: [],
    pending: [],
    queue: [],
    running: false,
    subagent: null,
    composerPhase: 'active',
    removed: false,
    openState: input.openState ?? 'open',
    openError: null,
    hasMore: false,
    loadingOlder: false,
    promptError: null,
    blank: false,
    lastAgentError: null,
  } as unknown as ConversationSnapshot
}

function user(seq: number): ConversationNode {
  return { kind: 'user', seq, time: seq, content: [], source: null }
}

function steering(seq: number): ConversationNode {
  return {
    kind: 'steering',
    messageId: `steer-${seq}` as MessageId,
    seq,
    time: seq,
    content: [],
    source: null,
  }
}

function assistant(seq: number, turn: number, messageId?: string): ConversationNode {
  return {
    kind: 'assistant',
    seq,
    time: seq,
    turn,
    step: 1,
    blocks: [],
    ...(messageId === undefined ? {} : { messageId: messageId as MessageId }),
  }
}

function turnError(seq: number, turn: number): ConversationNode {
  return { kind: 'turn-error', seq, time: seq, turn, step: 1, message: 'boom' }
}

function turnMaxTokens(seq: number, turn: number): ConversationNode {
  return { kind: 'turn-max-tokens', seq, time: seq, turn, step: 1 }
}

describe('diffSnapshot', () => {
  it('ignores snapshots while the session is not open', () => {
    const state = createTriggerState()
    expect(diffSnapshot(snapshot({ openState: 'loading', nodes: [user(1)] }), state)).toEqual(NO_TRIGGERS)
    expect(state.seeded).toBe(false)
  })

  it('seeds baselines on the first open snapshot without triggering', () => {
    const state = createTriggerState()
    const result = diffSnapshot(snapshot({
      nodes: [user(1), assistant(3, 1, 'm1')],
      turnEnds: new Map([[1, 4]]),
    }), state)
    expect(result).toEqual(NO_TRIGGERS)
    expect(state.seeded).toBe(true)
    expect(state.maxSeq).toBe(4)
    expect(state.playedTurns.has(1)).toBe(true)
  })

  it('fires mama for a new user message', () => {
    const state = createTriggerState()
    diffSnapshot(snapshot({ nodes: [user(1)] }), state)
    expect(diffSnapshot(snapshot({ nodes: [user(1), user(2)] }), state)).toEqual({ mama: true, niulai: false })
  })

  it('fires mama for a new steering message', () => {
    const state = createTriggerState()
    diffSnapshot(snapshot({ nodes: [user(1)] }), state)
    expect(diffSnapshot(snapshot({ nodes: [user(1), steering(2)] }), state)).toEqual({ mama: true, niulai: false })
  })

  it('fires niulai once when a turn ends', () => {
    const state = createTriggerState()
    diffSnapshot(snapshot({ nodes: [user(1)] }), state)
    expect(diffSnapshot(snapshot({ nodes: [user(1)], turnEnds: new Map([[1, 5]]) }), state)).toEqual({ mama: false, niulai: true })
    // Same turn end again (later snapshot) — no replay.
    expect(diffSnapshot(snapshot({ nodes: [user(1)], turnEnds: new Map([[1, 5]]) }), state)).toEqual(NO_TRIGGERS)
  })

  it('fires niulai for a finalized assistant message without a turn/end record', () => {
    const state = createTriggerState()
    diffSnapshot(snapshot({ nodes: [user(1)] }), state)
    expect(diffSnapshot(snapshot({ nodes: [user(1), assistant(2, 1, 'm1')] }), state)).toEqual({ mama: false, niulai: true })
  })

  it('does not fire for an interruption-frozen assistant partial', () => {
    const state = createTriggerState()
    diffSnapshot(snapshot({ nodes: [user(1)] }), state)
    expect(diffSnapshot(snapshot({ nodes: [user(1), assistant(2, 1)] }), state)).toEqual(NO_TRIGGERS)
  })

  it('fires niulai for terminal turn errors', () => {
    const state = createTriggerState()
    diffSnapshot(snapshot({ nodes: [user(1)] }), state)
    expect(diffSnapshot(snapshot({ nodes: [user(1), turnError(2, 1)] }), state)).toEqual({ mama: false, niulai: true })
    const state2 = createTriggerState()
    diffSnapshot(snapshot({ nodes: [user(1)] }), state2)
    expect(diffSnapshot(snapshot({ nodes: [user(1), turnMaxTokens(2, 1)] }), state2)).toEqual({ mama: false, niulai: true })
  })

  it('announces a turn once even when its end spans two snapshots', () => {
    const state = createTriggerState()
    diffSnapshot(snapshot({ nodes: [user(1)] }), state)
    expect(diffSnapshot(snapshot({ nodes: [user(1)], turnEnds: new Map([[2, 6]]) }), state)).toEqual({ mama: false, niulai: true })
    // The finalized assistant message for the same turn lands later.
    expect(diffSnapshot(snapshot({ nodes: [user(1), assistant(7, 2, 'm2')], turnEnds: new Map([[2, 6]]) }), state)).toEqual(NO_TRIGGERS)
  })

  it('ignores history prepends (lower seqs)', () => {
    const state = createTriggerState()
    diffSnapshot(snapshot({ nodes: [user(10)] }), state)
    expect(diffSnapshot(snapshot({ nodes: [user(5), user(10)] }), state)).toEqual(NO_TRIGGERS)
  })

  it('returns both triggers in one snapshot when both happen', () => {
    const state = createTriggerState()
    diffSnapshot(snapshot({ nodes: [user(1)] }), state)
    expect(diffSnapshot(snapshot({
      nodes: [user(1), user(2), assistant(3, 1, 'm1')],
      turnEnds: new Map([[1, 4]]),
    }), state)).toEqual({ mama: true, niulai: true })
  })

  it('tracks maxSeq across the whole window', () => {
    const state = createTriggerState()
    diffSnapshot(snapshot({ nodes: [user(1), assistant(2, 1, 'm1')], turnEnds: new Map([[1, 3]]) }), state)
    // seq 3 was the turn end; a replay at seq 2 must not trigger.
    expect(diffSnapshot(snapshot({ nodes: [user(1), assistant(2, 1, 'm1')], turnEnds: new Map([[1, 3]]) }), state)).toEqual(NO_TRIGGERS)
  })

  it('survives reconnect rebuilds (same seqs, no replay)', () => {
    const state = createTriggerState()
    diffSnapshot(snapshot({ nodes: [user(1)], turnEnds: new Map([[1, 2]]) }), state)
    diffSnapshot(snapshot({ openState: 'cold' }), state)
    expect(diffSnapshot(snapshot({ nodes: [user(1)], turnEnds: new Map([[1, 2]]) }), state)).toEqual(NO_TRIGGERS)
    // A genuinely new event after reconnect still triggers.
    expect(diffSnapshot(snapshot({ nodes: [user(1), user(9)], turnEnds: new Map([[1, 2]]) }), state)).toEqual({ mama: true, niulai: false })
  })

  it('is fresh per state instance', () => {
    const a: TriggerWatchState = createTriggerState()
    const b: TriggerWatchState = createTriggerState()
    diffSnapshot(snapshot({ nodes: [user(1)] }), a)
    diffSnapshot(snapshot({ nodes: [user(1)] }), b)
    expect(a.maxSeq).toBe(1)
    expect(b.maxSeq).toBe(1)
    expect(a.playedTurns).not.toBe(b.playedTurns)
  })
})
