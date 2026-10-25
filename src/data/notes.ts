export interface NoteDef {
  id: string;
  title: string;
  pages: string[];
}

/** Notes the player can find. The staff room keeps every note you have discovered. */
export const NOTES: Record<string, NoteDef> = {
  'note-margaret': {
    id: 'note-margaret',
    title: 'A folded note',
    pages: [
      'The paper is soft from being handled. Neat handwriting, signed M.H.:',
      '"Whoever finds this: the animals will tell you what they need, if you are patient enough to listen."',
    ],
  },
  'note-routine': {
    id: 'note-routine',
    title: "Margaret's care card",
    pages: [
      "A card taped inside the locker door, in Margaret's handwriting:",
      '"Buster: breakfast first, then a long drink. In the warm part of the day he likes to dust himself on the bare patch by the old rock. Do not rush him. He remembers who is patient."',
    ],
  },
  'note-buster': {
    id: 'note-buster',
    title: "Margaret's letter",
    pages: [
      "A sheet folded in three, under your locker door. Margaret's handwriting again:",
      '"If you are reading this, you have finished a first shift, and you are still here. Good."',
      '"Buster is the oldest of our animals, and there is a story about him that nobody at Willow Creek likes to tell. He will not tell it either. Watch him closely. When he goes quiet, there is a reason."',
      '"Ask Daniel when the time is right. M.H."',
    ],
  },
};

/** The staff-room discoveries that should also be told in the zoo history. */
export const NOTE_EVENT_TEXT: Record<string, string> = {
  'note-margaret': "You found Margaret Holloway's folded note on the path near the main gate.",
  'note-routine': "You found Margaret's care card for Buster taped inside your locker.",
  'note-buster': "After your first shift you found a letter from Margaret under your locker door. It says there is a story about Buster that nobody tells.",
};
