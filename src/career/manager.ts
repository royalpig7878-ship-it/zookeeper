import { AwardKind, LEVEL_NAMES, SKILLS } from './definitions';
import {
  AwardResult, ShiftOutcome, award, bagSlots, canPromote, checkAchievements, endShift, evaluate, logEntry, nextRank, promote,
} from './career';
import type { CareerCtx, CareerState, RankDef, ShiftRecord } from './types';

export interface AwardRequest {
  kind: AwardKind;
  key?: string;
  group?: string;
}

const CHORE_EVENTS = [
  'waste-cleared', 'leaves-swept', 'weeds-pulled', 'branches-cleared', 'plants-watered', 'hedges-trimmed', 'repairs-made',
  'litter-collected', 'pondweed-cleared', 'lost-recovered',
];

/** Which career award (if any) a task event from the workday report stands for. */
export function awardForTaskEvent(event: string): AwardRequest | null {
  if (event === 'water-filled') return { kind: 'water', key: 'elephant', group: 'elephant' };
  if (event === 'feeder-filled') return { kind: 'feed', key: 'elephant', group: 'elephant' };
  if (event.startsWith('watered:')) return { kind: 'water', key: event.slice(8), group: event.slice(8) };
  if (event.startsWith('fed:')) return { kind: 'feed', key: event.slice(4), group: event.slice(4) };
  if (event.startsWith('enriched:')) return { kind: 'enrichPlay', key: event.slice(9), group: event.slice(9) };
  if (event.startsWith('monitor:')) return { kind: 'monitor', key: event.slice(8) };
  if (CHORE_EVENTS.includes(event)) return { kind: 'chore', key: event };
  if (event === 'note-read') return { kind: 'note', key: 'note-read' };
  if (['tools-collected', 'kit-collected', 'equipment-collected'].includes(event)) return { kind: 'equip', key: event };
  return null;
}

/** Which career award a milestone in the zoo history stands for. Each history key can only be recorded once. */
export function awardForHistoryKey(key: string): AwardRequest | null {
  if (/^case\d+-recorded$/.test(key)) return { kind: 'observe', key };
  if (/^case\d+-reported$/.test(key)) return { kind: 'report', key };
  if (/^case\d+-recovered$/.test(key)) return { kind: 'recover', key };
  if (/^bond-(friendly|trusting)-/.test(key)) return { kind: 'bond', key };
  if (key.startsWith('learned-')) return { kind: 'noticed', key };
  return null;
}

/**
 * The career for a running game: the saved state plus the messages to show the player. The scene feeds it real
 * events; it pays, reviews and promotes, and never shows anything itself.
 */
export class CareerManager {
  /** short messages waiting to be shown (level-ups, achievements, "promotion available") */
  private pending: string[] = [];

  constructor(readonly state: CareerState, private readonly has: (key: string) => boolean) {}

  get ctx(): CareerCtx {
    return { career: this.state, has: this.has };
  }

  award(kind: AwardKind, day: number, opts: { key?: string; group?: string } = {}): AwardResult {
    const r = award(this.state, kind, day, opts);
    if (r.levelUp) {
      const name = SKILLS.find((s) => s.id === r.levelUp!.skill)!.label;
      this.pending.push(`${name}: ${LEVEL_NAMES[r.levelUp.level - 1]}`);
      logEntry(this.state, day, `${name} reached level ${r.levelUp.level} (${LEVEL_NAMES[r.levelUp.level - 1]}).`);
    }
    if (r.paid) this.achievements(day);
    return r;
  }

  fromTask(event: string, day: number) {
    const a = awardForTaskEvent(event);
    if (a) this.award(a.kind, day, a);
  }

  fromHistory(key: string, day: number) {
    const a = awardForHistoryKey(key);
    if (a) this.award(a.kind, day, a);
  }

  private achievements(day: number) {
    for (const t of checkAchievements(this.state, this.ctx, day)) this.pending.push(`Achievement: ${t}`);
  }

  /** The end of a shift. Returns what the review found (for the end-of-day report). */
  finishShift(record: ShiftRecord): ShiftOutcome {
    const out = endShift(this.state, this.ctx, record);
    for (const l of out.levelUps) this.pending.push(`${SKILLS.find((s) => s.id === l.skill)!.label}: ${LEVEL_NAMES[l.level - 1]}`);
    for (const t of out.newAchievements) this.pending.push(`Achievement: ${t}`);
    if (out.promotionReady) this.pending.push(`Promotion available: talk to Daniel`);
    return out;
  }

  /** Is a promotion waiting? Checked again here, so a stale flag can never promote anyone. */
  get promotionAvailable(): boolean {
    return this.state.promotionReady && canPromote(this.state, this.ctx);
  }

  /** Accept the promotion. Returns the new rank, or null if the player does not qualify (so it can never happen twice). */
  accept(day: number): RankDef | null {
    const r = promote(this.state, this.ctx, day);
    if (r) {
      this.pending.push(`Promoted: ${r.title}`);
      this.achievements(day);
    }
    return r;
  }

  /** Refresh the review (used after the player changes something that the requirements depend on). */
  review(day: number) {
    evaluate(this.state, this.ctx, day);
  }

  /** Messages waiting to be shown, grouped into one short line each time. */
  drain(): string | null {
    if (this.pending.length === 0) return null;
    const msgs = this.pending.splice(0);
    return msgs.length <= 2 ? msgs.join('  |  ') : `${msgs[0]}  |  +${msgs.length - 1} more in your Career Journal`;
  }

  get bagSlots() {
    return bagSlots(this.state);
  }

  get next() {
    return nextRank(this.state);
  }
}
