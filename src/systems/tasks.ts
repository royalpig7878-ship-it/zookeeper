import type { TaskEventName } from '../data/chores';

export type Priority = 'high' | 'routine' | 'grounds' | 'optional';

export type TaskEvent =
  | 'tools-collected' | 'meal-prepared' | 'feeder-filled' | 'water-filled'
  | 'note-read' | 'animal-inspected' | 'equipment-collected'
  | 'kit-collected' | 'grass-mowed'
  | TaskEventName
  /** per-habitat care for the animals other than Buster, e.g. "fed:zebra" */
  | `fed:${string}` | `watered:${string}` | `enriched:${string}`;

/** Every event name, for validating saved games. */
export const ALL_TASK_EVENTS: readonly TaskEvent[] = [
  'tools-collected', 'meal-prepared', 'feeder-filled', 'water-filled', 'note-read', 'animal-inspected', 'equipment-collected',
  'kit-collected', 'grass-mowed', 'waste-cleared', 'leaves-swept', 'weeds-pulled', 'branches-cleared', 'plants-watered',
  'hedges-trimmed', 'repairs-made', 'litter-collected', 'pondweed-cleared', 'lost-recovered',
];

export interface TaskState {
  id: string;
  title: string;
  priority: Priority;
  event: TaskEvent;
  needed: number;
  progress: number;
  done: boolean;
}

/** What there is to do in the zoo today (beyond the core animal care). All optional so older code and saves still work. */
export interface GroundsContext {
  weeds: number;
  branch: number;
  dry: number;
  hedge: number;
  repair: number;
  litter: number;
  pondweed: number;
  lost: number;
  /** tall lawn tiles the mower can reach */
  lawnTall: number;
  /** true once the keeper has collected the grounds kit */
  kitOwned: boolean;
}

export interface TaskContext {
  day: number;
  toolsOwned: boolean;
  dungCount: number;
  leafCount: number;
  noteRead: boolean;
  /** true once the keeper has collected their locker equipment */
  lockerOpened: boolean;
  grounds?: GroundsContext;
  /** the other inhabited habitats (everyone except Buster's elephants) */
  habitats?: { id: string; group: string }[];
}

const task = (id: string, title: string, priority: Priority, event: TaskEvent, needed = 1): TaskState => ({
  id, title, priority, event, needed, progress: 0, done: false,
});

/** Build the day's care report. Which tasks appear depends on what actually needs doing. */
export function createTasks(c: TaskContext): TaskState[] {
  const t: TaskState[] = [];
  if (!c.lockerOpened) t.push(task('locker', 'Collect your notebook and first-aid kit (staff room locker)', 'routine', 'equipment-collected'));
  if (!c.toolsOwned) t.push(task('tools', 'Collect shovel, broom and hose (maintenance shed)', 'routine', 'tools-collected'));
  const g = c.grounds;
  if (g && !g.kitOwned) t.push(task('kit', 'Collect the grounds kit (maintenance shed)', 'routine', 'kit-collected'));
  t.push(task('water', "Refill Buster's water trough (hose, water hatch)", 'high', 'water-filled'));
  t.push(task('meal', 'Prepare a meal for Buster (food prep area)', 'high', 'meal-prepared'));
  t.push(task('feed', "Fill Buster's feeder (feeding hatch)", 'high', 'feeder-filled'));
  for (const h of c.habitats ?? []) {
    t.push(task(`water-${h.id}`, `Refill the ${h.group}' water trough (hose, water hatch)`, 'routine', `watered:${h.id}`));
    t.push(task(`feed-${h.id}`, `Feed the ${h.group} (meal from the prep counter, feeding hatch)`, 'routine', `fed:${h.id}`));
  }
  for (const h of c.habitats ?? []) {
    t.push(task(`enrich-${h.id}`, `Give the ${h.group} something to play with (enrichment, gate)`, 'optional', `enriched:${h.id}`));
  }
  if (c.dungCount > 0) t.push(task('waste', 'Shovel waste from the elephant habitat', 'routine', 'waste-cleared', c.dungCount));
  if (c.leafCount > 0) t.push(task('leaves', 'Sweep fallen leaves from the paths', 'grounds', 'leaves-swept', c.leafCount));
  if (g) {
    if (g.lawnTall >= 6) t.push(task('mow', 'Mow the overgrown lawn (mower, maintenance shed)', 'grounds', 'grass-mowed', Math.min(24, g.lawnTall)));
    if (g.dry > 0) t.push(task('plants', 'Water the dry flowerbeds (watering can)', 'grounds', 'plants-watered', g.dry));
    if (g.litter > 0) t.push(task('litter', 'Collect floating litter from the pond (boat, dock)', 'grounds', 'litter-collected', g.litter));
    if (g.weeds > 0) t.push(task('weeds', 'Pull weeds in the garden (trowel)', 'optional', 'weeds-pulled', g.weeds));
    if (g.hedge > 0) t.push(task('hedges', 'Trim the overgrown hedges (hedge trimmer)', 'optional', 'hedges-trimmed', g.hedge));
    if (g.branch > 0) t.push(task('branches', 'Clear fallen branches', 'optional', 'branches-cleared', g.branch));
    if (g.repair > 0) t.push(task('repairs', 'Fix the loose bench (toolkit)', 'optional', 'repairs-made', g.repair));
    if (g.pondweed > 0) t.push(task('pondweed', 'Clear pondweed (boat)', 'optional', 'pondweed-cleared', g.pondweed));
    if (g.lost > 0) t.push(task('lost', 'Retrieve the lost object in the pond (boat)', 'optional', 'lost-recovered', g.lost));
  }
  if (!c.noteRead && c.day === 1) t.push(task('note', 'Read the note found near the staff building', 'optional', 'note-read'));
  t.push(task('inspect', 'Inspect an animal and read its care tips (tap one, or press INSPECT)', 'optional', 'animal-inspected'));
  return t;
}

/** Record that something happened. Returns the tasks this finished (for "Task complete!" feedback). */
export function applyTaskEvent(tasks: TaskState[], event: TaskEvent, amount = 1): TaskState[] {
  const finished: TaskState[] = [];
  for (const t of tasks) {
    if (t.done || t.event !== event) continue;
    t.progress = Math.min(t.needed, t.progress + amount);
    if (t.progress >= t.needed) {
      t.done = true;
      finished.push(t);
    }
  }
  return finished;
}

export const SECTION_TITLES: Record<Priority, string> = {
  high: 'HIGH PRIORITY',
  routine: 'ROUTINE CARE',
  grounds: 'GROUNDS',
  optional: 'OPTIONAL',
};
const ORDER: Priority[] = ['high', 'routine', 'grounds', 'optional'];

export function taskLabel(t: TaskState): string {
  const count = t.needed > 1 ? ` (${t.progress}/${t.needed})` : '';
  return `${t.done ? '[x]' : '[ ]'} ${t.title}${count}`;
}

/** The report as lines of text; headings start with "#" so the UI can style them. */
export function reportLines(tasks: readonly TaskState[]): string[] {
  const lines: string[] = [];
  for (const p of ORDER) {
    const group = tasks.filter((t) => t.priority === p);
    if (group.length === 0) continue;
    lines.push(`#${SECTION_TITLES[p]}`);
    for (const t of group) lines.push(taskLabel(t));
  }
  return lines;
}

export function summary(tasks: readonly TaskState[]) {
  const required = tasks.filter((t) => t.priority !== 'optional');
  return {
    done: tasks.filter((t) => t.done).length,
    total: tasks.length,
    requiredDone: required.filter((t) => t.done).length,
    requiredTotal: required.length,
  };
}
