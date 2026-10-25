import { AnimalState } from '../animals/simulation';
import { familiarityLabel } from '../animals/memory';
import { SPECIES } from '../data/animals';
import { SPOT_LABELS, profileOf } from '../data/animals/profiles';
import { ENRICHMENT_ITEMS, ITEMS, RECIPES, STORES } from '../data/items';
import { MESSAGES } from '../data/messages';
import { NOTES } from '../data/notes';
import { PHOTOS } from '../data/photos';
import { TRAITS } from '../data/traits';
import type { SheetData } from '../ui/sheet';
import { Clock, formatTime } from './clock';
import { History, ZooEvent, forAnimal, hasEvent, newestFirst, unlockedPhotos } from './history';
import { INVENTORY_SLOTS, Slot, countItem, hasItem } from './inventory';
import { TaskState, reportLines } from './tasks';
import { Relative, familyOf, stageWord } from './life';
import type { Settings } from '../core/settings';
import { CONDITIONS } from '../data/conditions';
import {
  MedicalCase, MedicalState, activeCases, caseLines, casesOf, defOf, needsDoseToday, readyForCheck, statusLine,
} from './medical';

/**
 * Builders for the text "sheets" (bag, care report, history...). They only turn game state into
 * display data, so both the zoo and the staff room can show the same sheets.
 */

export const eventLine = (e: ZooEvent) => `Day ${e.day}, ${formatTime(e.minutes)}: ${e.text}`;

export function bagSheet(inv: readonly Slot[]): SheetData {
  return {
    title: 'Bag',
    subtitle: `${inv.length} of ${INVENTORY_SLOTS} slots used. The right tool is used automatically.`,
    slots: inv.map((s) => ({ icon: `item_${s.id}`, label: ITEMS[s.id].name, qty: s.qty, desc: ITEMS[s.id].description })),
    slotCapacity: INVENTORY_SLOTS,
    buttons: [{ id: 'close', label: 'Close' }],
  };
}

/** The maintenance shed: where equipment is kept, and where the mower is stored and charged. */
export function shedSheet(inv: readonly Slot[]): SheetData {
  const have = (...ids: string[]) => ids.every((id) => hasItem(inv, id));
  const basic = have('shovel', 'broom', 'hose');
  const grounds = have('trowel', 'hedge_trimmer', 'watering_can', 'toolkit');
  const lines = [
    '#BASIC TOOLS',
    basic ? 'You have the shovel, broom and hose.' : 'Shovel, broom and hose, for the animal areas and paths.',
    '#GROUNDS KIT',
    grounds ? 'You have the trowel, hedge trimmer, watering can and toolkit.' : 'Trowel, hedge trimmer, watering can and toolkit, for the garden and small repairs.',
    '#MOWER',
    'The ride-on mower lives here on its charger. Take it out for the overgrown lawn.',
    'Mowing runs the battery down. Park it back here to recharge. The wild meadows are left alone on purpose.',
  ];
  const enrich = have(...ENRICHMENT_ITEMS);
  lines.splice(4, 0, '#ENRICHMENT KIT', enrich ? 'You have the floating ball, puzzle feeder and scent kit.' : 'A floating ball, a puzzle feeder and a scent kit, for giving animals something to do.');
  const buttons: SheetData['buttons'] = [];
  if (!basic) buttons.push({ id: 'shed-basic', label: 'Take basic tools' });
  if (!grounds) buttons.push({ id: 'shed-grounds', label: 'Take grounds kit' });
  if (!enrich) buttons.push({ id: 'shed-enrich', label: 'Take enrichment kit' });
  buttons.push({ id: 'shed-mower', label: 'Take out mower', color: 0xd8553f });
  buttons.push({ id: 'close', label: 'Close' });
  return { title: 'Maintenance Shed', subtitle: 'Leo keeps everything neat in here.', lines, buttons };
}

/** A supply store: pick an ingredient to gather. */
export function storeSheet(kind: 'dry' | 'fresh', inv: readonly Slot[]): SheetData {
  const store = STORES[kind];
  const lines = ['#WHAT IS HERE'];
  for (const id of store.items) lines.push(`${ITEMS[id].name}: ${ITEMS[id].description} (carrying ${countItem(inv, id)})`);
  return {
    title: store.title,
    subtitle: 'Gather one at a time. Meals are prepared at the prep counter.',
    lines,
    buttons: [...store.items.map((id) => ({ id: `gather-${id}`, label: ITEMS[id].name })), { id: 'close', label: 'Close' }],
  };
}

/** The prep counter: one recipe per species that lives in this zoo. */
export function recipesSheet(speciesIds: readonly string[], inv: readonly Slot[]): SheetData {
  const recipes = RECIPES.filter((r) => speciesIds.includes(r.species));
  const lines = ['#MEALS'];
  for (const r of recipes) {
    const need = Object.entries(r.inputs).map(([id, n]) => `${n} ${ITEMS[id].name.toLowerCase()} (you have ${countItem(inv, id)})`).join(' + ');
    lines.push(`${ITEMS[r.output].name}: ${need}`);
  }
  lines.push('', hasItem(inv, 'bucket') ? 'You have the feeding bucket.' : 'You need the feeding bucket (on the rack in the food preparation building) to prepare meals.');
  return {
    title: 'Prep Counter',
    subtitle: 'Choose a meal to prepare. Each species eats something different.',
    lines,
    buttons: [...recipes.map((r) => ({ id: `cook-${r.id}`, label: ITEMS[r.output].name.replace(' meal', '') })), { id: 'close', label: 'Close' }],
  };
}

/** Putting enrichment into a habitat. */
export function enrichSheet(habitatId: string, group: string, inv: readonly Slot[], current: string | null): SheetData {
  const have = ENRICHMENT_ITEMS.filter((id) => hasItem(inv, id));
  const lines: string[] = [];
  if (current) lines.push(`#ALREADY THERE`, `The ${group} already have the ${ITEMS[current].name.toLowerCase()}. Wait for them to lose interest, or until tomorrow.`);
  else lines.push('#CHOOSE', `Pick something to pass through the gate for the ${group}. Different animals like different things.`);
  for (const id of ENRICHMENT_ITEMS) lines.push(`${ITEMS[id].name}: ${ITEMS[id].description}`);
  if (have.length === 0) lines.push('', 'You are not carrying any. Collect the enrichment kit from the maintenance shed.');
  return {
    title: 'Enrichment',
    subtitle: `Willow Creek: ${group}`,
    lines,
    buttons: [...(current ? [] : have.map((id) => ({ id: `enrich:${habitatId}:${id}`, label: ITEMS[id].name }))), { id: 'close', label: 'Close' }],
  };
}

export function reportSheet(
  tasks: readonly TaskState[], clock: Clock, title?: string, extra: SheetData['buttons'] = [], vetLines: readonly string[] = [],
  storyLines: readonly string[] = [], weatherNotes: readonly string[] = [],
): SheetData {
  return {
    title: title ?? `Care Report - Day ${clock.day}`,
    subtitle: `Willow Creek Wildlife Park, ${formatTime(clock.minutes)}`,
    lines: [...(weatherNotes.length ? ['#WEATHER', ...weatherNotes] : []), ...(storyLines.length ? ['#STORY', ...storyLines] : []), ...(vetLines.length ? ['#VET CARE', ...vetLines] : []), ...reportLines(tasks)],
    buttons: [...extra, { id: 'close', label: 'Close' }],
  };
}

export function confirmEndSheet(tasks: readonly TaskState[]): SheetData {
  const open = tasks.filter((t) => !t.done && t.priority !== 'optional').map((t) => `[ ] ${t.title}`);
  return {
    title: 'End your shift?',
    subtitle: 'Some required care is still unfinished.',
    lines: ['#STILL TO DO', ...open, '', 'The animals and the habitat will wait for tomorrow. Nothing is lost, but unfinished care can leave them less comfortable.'],
    buttons: [{ id: 'back', label: 'Not yet' }, { id: 'end-confirm', label: 'End Shift', color: 0x97402f }],
  };
}

/** Everything the zoo knows about one animal: who it is, how it behaves, and what has happened to it. */
export function historySheet(
  a: AnimalState, history: History, names: Record<string, string> = {}, cases: readonly MedicalCase[] = [],
  family: { relatives: readonly Relative[]; expecting: boolean } = { relatives: [], expecting: false },
): SheetData {
  const species = SPECIES[a.speciesId];
  const profile = a.profile ?? profileOf(a.id);
  const lines: string[] = [`#ABOUT ${a.name.toUpperCase()}`];
  lines.push(`${a.name} is a ${profile ? `${profile.ageYears}-year-old ` : ''}${species.displayName}.`);
  for (const l of profile?.backstory ?? []) lines.push(l);

  lines.push('#PERSONALITY');
  for (const t of a.traits) lines.push(`${TRAITS[t].label}: ${TRAITS[t].description}`);

  lines.push('#WHAT YOU HAVE NOTICED');
  const noticed: string[] = [];
  for (const spot of a.memory.learned) {
    if (SPOT_LABELS[spot]) noticed.push(`Keeps ${SPOT_LABELS[spot].habit}.`);
    if (spot === 'greets') noticed.push('Comes over to the fence to greet you.');
  }
  for (const l of a.memory.learned) {
    if (l.startsWith('friend:')) noticed.push(`Has become close to ${names[l.slice(7)] ?? 'another animal'}.`);
    if (l.startsWith('avoid:')) noticed.push(`Keeps away from ${names[l.slice(6)] ?? 'another animal'}.`);
  }
  for (const [item, count] of Object.entries(a.memory.plays)) {
    if (count > 0 && ITEMS[item]) noticed.push(`Has played with the ${ITEMS[item].name.toLowerCase()} (${count} time${count === 1 ? '' : 's'}).`);
  }
  lines.push(...(noticed.length ? noticed : [`Still getting to know ${a.name}. Watch where they choose to spend their time.`]));

  lines.push('#FAMILY');
  const kin = familyOf(family.relatives, a.id);
  const young = SPECIES[a.speciesId].life?.young ?? 'young';
  lines.push(`${a.name} is ${a.sex === 'female' ? 'a female' : 'a male'}${a.stage === 'adult' ? '' : ` (${stageWord(a.stage, young)})`}.`);
  if (a.birthDay !== undefined) lines.push(`Born at Willow Creek on day ${a.birthDay}.`);
  if (kin.mother) lines.push(`Mother: ${kin.mother.name}.`);
  if (kin.father) lines.push(`Father: ${kin.father.name}.`);
  if (kin.siblings.length) lines.push(`Brothers and sisters: ${kin.siblings.map((x) => x.name).join(', ')}.`);
  if (kin.children.length) lines.push(`Young: ${kin.children.map((x) => x.name).join(', ')}.`);
  if (family.expecting) lines.push(`${a.name} is expecting a ${young}.`);
  if (!kin.mother && !kin.father && !kin.children.length && !family.expecting) lines.push('No family recorded here yet.');

  const mine = cases.filter((c) => c.animalId === a.id);
  lines.push('#MEDICAL HISTORY');
  if (mine.length === 0) lines.push(`No health problems recorded for ${a.name}.`);
  for (const c of [...mine].reverse()) lines.push(...caseLines(c), '');

  lines.push('#HISTORY');
  const events = newestFirst(forAnimal(history, a.id)).slice(0, 30);
  lines.push(...(events.length ? events.map(eventLine) : ['Nothing recorded yet.']));

  return {
    title: `${a.name}'s Story`,
    subtitle: `${familiarityLabel(a.memory.familiarity)}  (bond ${Math.round(a.memory.familiarity)}/100)`,
    lines,
    buttons: [{ id: 'close', label: 'Close' }],
  };
}

export function noticeboardSheet(history: History, day: number): SheetData {
  const lines: string[] = ['#STAFF MESSAGES'];
  for (const m of MESSAGES.filter((x) => x.minDay <= day && (!x.requiresKey || hasEvent(history, x.requiresKey)))) {
    lines.push(`${m.from}: ${m.text}`);
  }
  const milestones = newestFirst(history.events.filter((e) => e.category === 'milestone')).slice(0, 8);
  lines.push('#MILESTONES');
  lines.push(...(milestones.length ? milestones.map(eventLine) : ['None yet. They are added as things happen at Willow Creek.']));
  const recent = newestFirst(history.events).slice(0, 6);
  lines.push('#RECENTLY');
  lines.push(...(recent.length ? recent.map(eventLine) : ['Nothing yet.']));
  return { title: 'Noticeboard', subtitle: `Willow Creek, Day ${day}`, lines, buttons: [{ id: 'close', label: 'Close' }] };
}

export function photosSheet(history: History): SheetData {
  const have = new Set(unlockedPhotos(history).map((p) => p.id));
  const lines: string[] = [];
  for (const p of PHOTOS) {
    if (have.has(p.id)) lines.push(`#${p.title}`, p.caption);
    else lines.push('#???', 'A frame waiting for a photograph. Something has to happen first.');
  }
  return { title: 'Photo Wall', subtitle: `${have.size} of ${PHOTOS.length} photographs`, lines, buttons: [{ id: 'close', label: 'Close' }] };
}

export function notesSheet(discovered: ReadonlySet<string>): SheetData {
  const lines: string[] = [];
  let count = 0;
  for (const note of Object.values(NOTES)) {
    if (!discovered.has(note.id)) continue;
    count++;
    lines.push(`#${note.title}`, ...note.pages);
  }
  if (count === 0) lines.push('No notes found yet. Keep exploring the park and your locker.');
  return { title: 'Notes', subtitle: `${count} of ${Object.keys(NOTES).length} found`, lines, buttons: [{ id: 'close', label: 'Close' }] };
}

// ---------------------------------------------------------------- veterinary care

/** Dr. Shah's clinic: report recorded symptoms, collect prescribed medicine. */
export function clinicSheet(m: MedicalState, names: Record<string, string>): SheetData {
  const lines: string[] = ['#DR. SHAH'];
  const active = activeCases(m);
  if (active.length === 0) {
    lines.push('Dr. Priya Shah looks up from her notes. "Nothing to report? Good. Come and find me the moment an animal seems off. Early notice makes all the difference."');
  } else {
    lines.push('"Tell me what you have seen and I will take it from there."');
    lines.push('#CURRENT CASES');
    for (const c of active) lines.push(statusLine(c, names[c.animalId] ?? 'An animal'));
  }
  const buttons: SheetData['buttons'] = [];
  for (const c of active) {
    const name = names[c.animalId] ?? 'animal';
    if (c.stage === 'recorded') buttons.push({ id: `vet-report:${c.id}`, label: `Report ${name}`, color: 0x3f8f58 });
    if (c.stage === 'examined') buttons.push({ id: `vet-collect:${c.id}`, label: `Collect ${defOf(c).medicine?.name.toLowerCase() ?? 'medicine'}`, color: 0x3f8f58 });
  }
  buttons.push({ id: 'close', label: 'Close' });
  return { title: 'Veterinary Clinic', subtitle: 'Dr. Priya Shah, visiting vet', lines, buttons };
}

/** One animal's current case from the keeper's side: symptoms, plan, and what can be done right now. */
export function medicalSheet(c: MedicalCase, name: string, day: number, haveNotebook: boolean, haveMedicine: boolean, feederHasFood: boolean): SheetData {
  const d = defOf(c);
  const lines: string[] = [`#${d.name.toUpperCase()}`, statusLine(c, name), '#WHAT YOU CAN SEE', ...d.symptoms.map((x) => `- ${x}`)];
  const buttons: SheetData['buttons'] = [];
  if (c.stage === 'early') {
    lines.push('#NEXT STEP', haveNotebook ? 'Write the symptoms in your notebook. Noticing early means a quicker recovery.' : 'You need your notebook from the staff room locker to record symptoms.');
    if (haveNotebook) buttons.push({ id: 'med-record', label: 'Record symptoms', color: 0x3f8f58 });
  } else if (c.stage === 'recorded') {
    lines.push('#NEXT STEP', 'Take your notes to Dr. Shah at the vet clinic and report them.');
  } else if (c.stage === 'reported') {
    lines.push('#NEXT STEP', 'Dr. Shah is on her way. When she arrives at the habitat gate, help her with the examination.');
  } else if (c.stage === 'examined') {
    lines.push('#NEXT STEP', `Collect the ${d.medicine?.name.toLowerCase()} from the clinic.`);
  } else if (c.stage === 'treating') {
    lines.push('#CARE PLAN', d.care.text);
    if (d.medicine) {
      lines.push(`Medicine: ${d.medicine.name}, dose ${c.dosesGiven} of ${c.dosesNeeded} given. One dose a day, in the feed.`);
      if (needsDoseToday(c, day)) {
        lines.push(feederHasFood ? "Today's dose is due." : "Today's dose is due. Fill the feeder first: the medicine goes in the food.");
        if (haveMedicine && feederHasFood) buttons.push({ id: 'med-dose', label: "Give today's dose", color: 0x3f8f58 });
        else if (!haveMedicine) lines.push('You are not carrying any medicine.');
      } else if (c.dosesGiven < c.dosesNeeded) lines.push("Today's dose is done.");
    }
    if (readyForCheck(c)) {
      lines.push('#RECOVERY CHECK', `${name} looks well again. Check them over to confirm.`);
      buttons.push({ id: 'med-check', label: 'Recovery check', color: 0x3f8f58 });
    }
  }
  buttons.push({ id: 'close', label: 'Close' });
  return { title: `${name}: Health`, subtitle: CONDITIONS[c.condition].name, lines, buttons };
}

export const vetCasesFor = (m: MedicalState, animalId: string) => casesOf(m, animalId);

// ---------------------------------------------------------------- settings

const onOff = (v: boolean) => (v ? 'on' : 'off');
const bar = (step: number) => `${'#'.repeat(step)}${'.'.repeat(10 - step)}  ${step * 10}%`;

/** Sound, controls and accessibility. Each button changes one thing and the sheet is shown again. */
export function settingsSheet(s: Settings): SheetData {
  return {
    title: 'Settings',
    subtitle: 'Saved on this device. They apply to every game.',
    lines: [
      '#SOUND',
      `Music  ${bar(s.music)}`,
      `Sound effects  ${bar(s.sfx)}`,
      `All sound is ${s.muted ? 'muted' : 'on'}. Sound starts after your first tap or key press. Use Test sound to check it, and turn up the device volume too.`,
      '#CONTROLS',
      `Left-handed layout: ${onOff(s.leftHanded)} (joystick on the right, action button on the left)`,
      `Large controls: ${onOff(s.bigControls)}`,
      '#COMFORT',
      `Reduced motion: ${onOff(s.reducedMotion)} (no falling rain, no camera smoothing)`,
      `Numbers on animal bars: ${onOff(s.showNumbers)} (so colour is never the only clue)`,
    ],
    buttons: [
      { id: 'set-music-down', label: 'Music -' },
      { id: 'set-music-up', label: 'Music +' },
      { id: 'set-sfx-down', label: 'Effects -' },
      { id: 'set-sfx-up', label: 'Effects +' },
      { id: 'set-mute', label: s.muted ? 'Unmute' : 'Mute all', color: 0x4a5a8a },
      { id: 'set-hand', label: `Left hand: ${onOff(s.leftHanded)}`, color: 0x4a5a8a },
      { id: 'set-big', label: `Big controls: ${onOff(s.bigControls)}`, color: 0x4a5a8a },
      { id: 'set-motion', label: `Calm motion: ${onOff(s.reducedMotion)}`, color: 0x4a5a8a },
      { id: 'set-numbers', label: `Numbers: ${onOff(s.showNumbers)}`, color: 0x4a5a8a },
      { id: 'set-test', label: 'Test sound', color: 0x3f8f58 },
      { id: 'set-reset', label: 'Reset all', color: 0x97402f },
      { id: 'close', label: 'Close' },
    ],
  };
}
