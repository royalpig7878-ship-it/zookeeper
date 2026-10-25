/**
 * The story, as data. A chapter is a list of steps; a step is done when something real has happened
 * (a zoo-history event key, or a story flag). Nothing here knows how the game is drawn, so new
 * chapters can be added by adding to CHAPTERS.
 */
export interface StoryStep {
  id: string;
  /** shown in the tracker: what to do next */
  objective: string;
  /** what Daniel says if you ask him what to do */
  hint: string;
  /** the step is done once the zoo history has an event with this key, or the story has this flag */
  key: string;
}

export interface ChapterDef {
  id: string;
  number: number;
  title: string;
  steps: StoryStep[];
  /** shown once, when the last step is done */
  finale: { heading: string; pages: string[]; note?: string };
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 'chapter-1', number: 1, title: 'The First Shift',
    steps: [
      { id: 'meet', objective: 'Meet Daniel Brooks by the staff building', hint: 'Come and find me by the staff building and I will show you around.', key: 'met-daniel' },
      { id: 'locker', objective: 'Collect your notebook from your locker (staff room)', hint: 'Go into the staff building. There is a locker with your name on it.', key: 'locker-opened' },
      { id: 'tools', objective: 'Take the shovel, broom and hose from the maintenance shed', hint: "Leo keeps the tools in the maintenance shed. Take the basic set.", key: 'tools-collected' },
      { id: 'meal', objective: "Prepare Buster's meal at the prep counter", hint: 'Buster eats hay with a little fruit. Get the bucket at the food preparation door, gather from the stores, then use the prep counter.', key: 'first-meal' },
      { id: 'fed', objective: "Fill Buster's feeder at the feeding hatch", hint: 'Take the meal to the feeding hatch on the elephant fence.', key: 'first-fed' },
      { id: 'water', objective: "Refill Buster's water trough (hose, water hatch)", hint: 'You need the hose for the water hatch, next to the feeding hatch.', key: 'first-water' },
      { id: 'clean', objective: "Clear waste from Buster's habitat (shovel, hatch)", hint: 'Elephants make a lot of mess. Use the shovel on the waste through the hatch.', key: 'first-clean' },
      { id: 'inspect', objective: 'Inspect Buster and read his care tips', hint: 'Tap Buster, or stand close and press INSPECT. His care tips tell you what he needs.', key: 'first-inspect-buster' },
      { id: 'shift', objective: 'Finish your shift (staff room desk, End Shift)', hint: 'When your care is done, go to the desk in the staff room and end your shift.', key: 'shift-complete-1' },
    ],
    finale: {
      heading: 'Chapter 1 complete: The First Shift',
      pages: [
        'Daniel locks up the tool shed and nods at you. "Not bad for a first day. Buster has taken to you."',
        'A folded sheet is tucked under your locker door. It is Margaret Holloway\'s handwriting.',
      ],
      note: 'note-buster',
    },
  },
  {
    id: 'chapter-2', number: 2, title: 'Buster Remembers',
    steps: [
      { id: 'notice', objective: 'Watch Buster: Daniel says he has been off his food', hint: 'Keep an eye on Buster. Inspect him and see how he is doing.', key: 'case1-started' },
      { id: 'record', objective: "Record Buster's symptoms (Inspect, Health)", hint: 'Open Buster\'s Health sheet and record what you see in your notebook.', key: 'case1-recorded' },
      { id: 'report', objective: 'Report the symptoms at the vet clinic', hint: 'Take your notes to Dr. Shah at the vet clinic.', key: 'case1-reported' },
      { id: 'examine', objective: 'Help Dr. Shah examine Buster at the gate', hint: 'When Dr. Shah arrives at the gate, help her.', key: 'case1-examined' },
      { id: 'recover', objective: 'Care for Buster until he has recovered', hint: 'Follow the care plan, give the medicine once a day, then do a recovery check.', key: 'case1-recovered' },
      { id: 'story', objective: 'Talk to Daniel about Buster', hint: 'Come and find me. There is something about Buster you should know.', key: 'buster-story-told' },
    ],
    finale: {
      heading: 'Chapter 2 complete: Buster Remembers',
      pages: [
        'Buster is back to himself. For the first time he waits at the gate, as if to thank you.',
        'You think about what Daniel told you, and about Margaret\'s card in your locker. Some of this story is still waiting to be found.',
      ],
    },
  },
];

/** Daniel's lines. Plain text; the choice of which to show is in `systems/story.ts`. */
export const DANIEL = {
  title: 'Daniel Brooks',
  intro: [
    'Daniel Brooks, the senior keeper, looks up from his clipboard and smiles. "You must be the new keeper. Welcome to Willow Creek. I am Daniel."',
    'Controls: use the joystick (or WASD) to walk. The big button on the right does whatever is nearby: INSPECT, OPEN, FILL FEEDER... The bag and the clipboard in the top corner show what you carry and what is left to do.',
    'Your day: collect your notebook from the staff room locker, take tools from the shed, prepare Buster\'s meal, fill his feeder and water, clear the waste, and look him over. I will be around if you need me.',
  ],
  chapter1Done: [
    'Daniel nods. "That was a proper first shift."',
  ],
  /** told once chapter 2 reaches its last step */
  bustersStory: [
    'Daniel leans on the fence rail. "I should tell you about Buster. Years ago he had a companion, a younger elephant called Matilda. They were inseparable."',
    '"When she was moved to another sanctuary, Buster stopped eating for a week. Margaret sat with him every afternoon until he started again. That is why she wrote him that care card."',
    '"He has been alone for a long time, and he is not young. When he goes off his food, that is his way of telling us something is wrong. You noticed, and that is what makes a good keeper."',
  ],
  afterAll: [
    'Daniel smiles. "More is coming up at Willow Creek, I am sure of it. For now, keep doing what you are doing."',
  ],
};
