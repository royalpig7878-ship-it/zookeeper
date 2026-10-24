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
    id: 'priya-notes', from: 'Dr. Shah', minDay: 3,
    text: "Buster's check-up is coming up. Keep an eye on how he eats and where he rests.",
  },
];
