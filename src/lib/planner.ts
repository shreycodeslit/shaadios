// Turns four inputs (date, city, budget, guests) into a month-by-month plan and a budget split.
// This part is plain rules, so it is instant, free and predictable; the AI handles quotes and questions.
import { CATEGORIES, uid, type BudgetLine, type CategoryId, type Plan, type Task, type Wedding, type WeddingEvent } from './types';

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDaysIso = (date: string, n: number) => iso(new Date(new Date(date + 'T00:00:00Z').getTime() + n * DAY));
export const daysUntil = (date: string, today = new Date()) => Math.ceil((new Date(date + 'T00:00:00Z').getTime() - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / DAY);

// [days before the wedding, task, category]
const TIMELINE: [number, string, CategoryId | 'general'][] = [
  [270, 'Fix the budget and who pays for what', 'general'],
  [260, 'Shortlist and visit 3 venues', 'venue'],
  [240, 'Book the venue and pay the advance', 'venue'],
  [230, 'Collect quotes from 3 caterers and do tastings', 'catering'],
  [220, 'Book the photographer and videographer', 'photo'],
  [200, 'Book the caterer', 'catering'],
  [190, 'Draft the guest list with both families', 'general'],
  [180, 'Book the decorator and agree the themes per event', 'decor'],
  [175, 'Book makeup artist and mehendi artist', 'beauty'],
  [170, 'Send save-the-dates', 'invites'],
  [150, 'Shop for the bride’s and groom’s outfits', 'outfits'],
  [140, 'Book the DJ, band or dhol', 'music'],
  [120, 'Block hotel rooms for outstation guests', 'stay'],
  [110, 'Order invitation cards and shagun envelopes', 'invites'],
  [100, 'Plan sangeet performances and start practice', 'music'],
  [90, 'Book transport for baraat and guests', 'stay'],
  [75, 'Buy jewellery and accessories', 'outfits'],
  [60, 'Send invitations', 'invites'],
  [45, 'Final menu and tasting with the caterer', 'catering'],
  [40, 'Outfit fittings', 'outfits'],
  [30, 'Confirm RSVPs and the final headcount per event', 'general'],
  [25, 'Allocate hotel rooms to guests', 'stay'],
  [21, 'Make a payment schedule for all vendors', 'general'],
  [14, 'Share the event schedule with every vendor', 'general'],
  [10, 'Pack return gifts and shagun envelopes', 'invites'],
  [7, 'Confirm timings with every vendor by phone', 'general'],
  [3, 'Hand over the emergency kit and contact sheet', 'general'],
  [-3, 'Pay remaining balances and collect bills', 'general'],
  [-14, 'Collect photos and video; send thank-you messages', 'photo'],
];

export function buildTasks(date: string): Task[] {
  return TIMELINE.map(([before, title, category]) => ({ id: uid(), title, due: addDaysIso(date, -before), category, done: false }));
}

export function buildBudget(total: number): BudgetLine[] {
  return CATEGORIES.map((c) => ({ category: c.id, planned: Math.round((total * c.share) / 1000) * 1000, booked: 0, paid: 0, vendor: null }));
}

export function defaultEvents(date: string, guests: number): WeddingEvent[] {
  return [
    { id: 'haldi', name: 'Haldi', date: addDaysIso(date, -2), expected: Math.round(guests * 0.35) },
    { id: 'mehendi', name: 'Mehendi', date: addDaysIso(date, -2), expected: Math.round(guests * 0.45) },
    { id: 'sangeet', name: 'Sangeet', date: addDaysIso(date, -1), expected: Math.round(guests * 0.7) },
    { id: 'wedding', name: 'Wedding', date, expected: guests },
  ];
}

export function newPlan(w: Omit<Wedding, 'events'>): Plan {
  const wedding: Wedding = { ...w, events: defaultEvents(w.date, w.guests) };
  return { wedding, tasks: buildTasks(w.date), budget: buildBudget(w.budget), quotes: [], guests: [], demo: false };
}

export function budgetTotals(b: BudgetLine[]) {
  return b.reduce((a, l) => ({ planned: a.planned + l.planned, booked: a.booked + l.booked, paid: a.paid + l.paid }), { planned: 0, booked: 0, paid: 0 });
}
