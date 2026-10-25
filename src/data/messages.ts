export interface StaffMessage {
  id: string;
  from: string;
  /** first day this message appears on the noticeboard */
  minDay: number;
  text: string;
  /** if set, the message only appears once this zoo-history event has happened */
  requiresKey?: string;
}

export const MESSAGES: StaffMessage[] = [
  {
    id: 'daniel-welcome', from: 'Daniel', minDay: 1,
    text: "Welcome aboard! Start with Buster's breakfast and water. He's a gentle giant, but give him space.",
  },
  {
    id: 'maya-leaves', from: 'Maya', minDay: 1,
    text: 'The wind has been busy. If you see leaves on the paths, the broom lives in the maintenance shed.',
  },
  {
    id: 'leo-hatches', from: 'Leo', minDay: 2,
    text: 'Feeding hatches are oiled and working. Tell me if one sticks.',
  },
  {
    id: 'maya-meadow', from: 'Maya', minDay: 2,
    text: 'Mow the lawn, but please leave the wild meadows alone. The insects and the birds rely on them.',
  },
  {
    id: 'leo-mower', from: 'Leo', minDay: 2,
    text: 'The mower runs flat after a good long mow. Park it on the charger and it will be ready for you tomorrow.',
  },
  {
    id: 'leo-spanner', from: 'Leo', minDay: 2, requiresKey: 'recovered-spanner',
    text: 'You found my spanner! I thought it had gone to the bottom of the pond for good. Tea is on me.',
  },
  {
    id: 'daniel-first-shift', from: 'Daniel', minDay: 2, requiresKey: 'shift-complete-1',
    text: "Good first day. If you find anything of Margaret's lying around, keep it safe for me. She left in a hurry.",
  },
  {
    id: 'daniel-buster-off', from: 'Daniel', minDay: 2, requiresKey: 'case1-started',
    text: 'Buster has been off his food this morning. Have a look at him when you can, and write down what you see.',
  },
  {
    id: 'priya-visit', from: 'Dr. Shah', minDay: 2, requiresKey: 'case1-reported',
    text: 'Thank you for the clear notes on Buster. Clear notes make my job much quicker. I will see him at the gate.',
  },
  {
    id: 'priya-recovered', from: 'Dr. Shah', minDay: 2, requiresKey: 'case1-recovered',
    text: "Buster's record is closed: recovered. Elephants hide how they feel, so keeping a close eye was the right call.",
  },
  {
    id: 'daniel-story', from: 'Daniel', minDay: 2, requiresKey: 'buster-story-told',
    text: 'Thanks for listening earlier. Not many people have heard that about Buster and Matilda.',
  },
  {
    id: 'priya-notes', from: 'Dr. Shah', minDay: 3,
    text: "Buster's check-up is coming up. Keep an eye on how he eats and where he rests.",
  },
];
