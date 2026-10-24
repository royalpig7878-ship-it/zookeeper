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
];
