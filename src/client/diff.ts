/**
 * Pure snapshot-diff trigger detection: the only file in this package that
 * decides WHEN a sound fires. No DOM, no playback — unit-testable in node.
 *
 * Rules:
 *  - a session must be 'open' (history landed) before anything is judged;
 *  - the first open snapshot only seeds baselines, it never triggers (page
 *    load, session switch, and reconnect replays stay silent);
 *  - only events with a seq above the observed maximum trigger, so history
 *    pagination prepends and resync rebuilds can never replay a sound;
 *  - a turn is announced once, even when its end spans several snapshots.
 */
import type { ConversationNode, ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'

/** Per-session watch state; one entry per watched session. */
export interface TriggerWatchState {
  /** First 'open' snapshot only seeds baselines, it never triggers. */
  seeded: boolean
  /** Highest event seq observed so far. */
  maxSeq: number
  /** Turns already announced as complete (multi-flush turn ends fire once). */
  playedTurns: Set<number>
}

/** Fresh watch state for a newly bound session. */
export function createTriggerState(): TriggerWatchState {
  return { seeded: false, maxSeq: 0, playedTurns: new Set() }
}

/** Which sounds one snapshot transition asks for. */
export interface SoundTriggers {
  /** A user message arrived (user or steering node). */
  mama: boolean
  /** A task finished (turn ended, finalized assistant message, or terminal turn error). */
  niulai: boolean
}

/** No-sound baseline (also returned while a session is not open). */
export const NO_TRIGGERS: SoundTriggers = { mama: false, niulai: false }

/** Turns completed by newly arrived terminal nodes. */
function collectTurnDone(nodes: readonly ConversationNode[]): Set<number> {
  const turns = new Set<number>()
  for (const node of nodes) {
    if (node.kind === 'assistant') {
      // `messageId` exists only on finalized messages; interruption-frozen
      // partials were never finalized and must not announce a completion.
      if (node.messageId !== undefined) turns.add(node.turn)
    } else if (node.kind === 'turn-error' || node.kind === 'turn-max-tokens') {
      turns.add(node.turn)
    }
  }
  return turns
}

/**
 * Judge one snapshot against the session's watch state.
 * @param snapshot - the session's latest conversation snapshot.
 * @param state - per-session state, mutated in place.
 * @returns which sounds to play, if any.
 */
export function diffSnapshot(snapshot: ConversationSnapshot, state: TriggerWatchState): SoundTriggers {
  if (snapshot.openState !== 'open') return NO_TRIGGERS

  const prevMax = state.maxSeq
  const newNodes = snapshot.nodes.filter(node => node.seq > prevMax)
  const newTurnEnds: Array<readonly [number, number]> = []
  for (const [turn, seq] of snapshot.turnEnds) {
    if (seq > prevMax) newTurnEnds.push([turn, seq])
  }

  let nextMax = prevMax
  for (const node of snapshot.nodes) if (node.seq > nextMax) nextMax = node.seq
  for (const [, seq] of snapshot.turnEnds) if (seq > nextMax) nextMax = seq

  if (!state.seeded) {
    // First open snapshot: baseline only. Everything already in the window is
    // history, and every in-window completed turn is already announced.
    state.seeded = true
    state.maxSeq = nextMax
    for (const [turn] of snapshot.turnEnds) state.playedTurns.add(turn)
    return NO_TRIGGERS
  }
  state.maxSeq = nextMax

  const mama = newNodes.some(node => node.kind === 'user' || node.kind === 'steering')

  const turnsDone = new Set<number>()
  for (const [turn] of newTurnEnds) turnsDone.add(turn)
  for (const turn of collectTurnDone(newNodes)) turnsDone.add(turn)
  let niulai = false
  for (const turn of turnsDone) {
    if (!state.playedTurns.has(turn)) {
      niulai = true
      state.playedTurns.add(turn)
    }
  }
  return { mama, niulai }
}
