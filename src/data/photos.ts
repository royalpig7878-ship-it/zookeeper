export interface PhotoDef {
  id: string;
  title: string;
  caption: string;
  /** The zoo-history event key that unlocks this photograph. */
  unlockKey: string;
}

/** Photographs appear on the staff room wall only after the matching thing has really happened. */
export const PHOTOS: PhotoDef[] = [
  {
    id: 'old-pond', title: 'Margaret & Buster',
    caption: "A faded print found by the pond. On the back: \"Margaret & Buster, his first week. He wouldn't leave my side.\"",
    unlockKey: 'discovered-photo-old',
  },
  {
    id: 'first-shift', title: 'The First Shift',
    caption: 'Daniel took this at the end of your first day. Buster is in the background, looking unimpressed.',
    unlockKey: 'shift-complete-1',
  },
  {
    id: 'dust-bath', title: 'Dust Bath Day',
    caption: 'Buster at his favourite patch, covered head to toe. He seemed very pleased with himself.',
    unlockKey: 'learned-dust',
  },
  {
    id: 'greeting', title: 'Hello, Buster',
    caption: 'Buster waiting at the fence to greet you. Maya says he has never done that for a new keeper before.',
    unlockKey: 'greets',
  },
  {
    id: 'orientation', title: 'Orientation Day',
    caption: 'Daniel posing by the gate with his clipboard, the day you arrived. He insists he was not smiling.',
    unlockKey: 'met-daniel',
  },
  {
    id: 'vet-visit', title: "Dr. Shah's House Call",
    caption: 'Dr. Shah at the elephant gate, stethoscope out, Buster politely holding still. You are just out of frame, helping.',
    unlockKey: 'case1-examined',
  },
  {
    id: 'new-arrival', title: 'A New Arrival',
    caption: 'The first young animal born at Willow Creek in your time here, tucked up close to its mother.',
    unlockKey: 'first-birth',
  },
  {
    id: 'recovered', title: 'Back to Normal',
    caption: 'Buster at the feeder, eating like himself again. Daniel took this and stuck it on the wall without asking.',
    unlockKey: 'case1-recovered',
  },
];
