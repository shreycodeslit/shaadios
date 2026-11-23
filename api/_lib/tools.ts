// The planner agent's tools. Each one reads the couple's own plan (sent with the question), so answers
// are built from real numbers rather than the model's guesses.
import { headcount } from '../../src/lib/guests';
import { budgetTotals, daysUntil } from '../../src/lib/planner';
import { compare } from '../../src/lib/quotes';
import { CATEGORIES, categoryName, type Plan } from '../../src/lib/types';

type Json = Record<string, unknown>;
export interface ToolDef { name: string; description: string; parameters: { type: 'object'; properties: Record<string, { type: string; description: string; enum?: string[] }>; required?: string[] }; run: (plan: Plan, args: Json) => unknown }

const catIds = CATEGORIES.map((c) => c.id) as string[];
const today = () => new Date().toISOString().slice(0, 10);

export const TOOLS: ToolDef[] = [
  {
    name: 'get_budget',
    description: 'Budget per category: planned, booked (agreed with a vendor) and paid, in rupees, plus totals and what is left.',
    parameters: { type: 'object', properties: {} },
    run: (p) => {
      const t = budgetTotals(p.budget);
      return { total_budget: p.wedding.budget, ...t, unallocated: p.wedding.budget - t.planned, still_to_pay_on_bookings: t.booked - t.paid,
        categories: p.budget.map((b) => ({ category: categoryName(b.category), planned: b.planned, booked: b.booked, paid: b.paid, vendor: b.vendor, left_in_category: b.planned - b.booked })) };
    },
  },
  {
    name: 'can_afford',
    description: 'Checks whether spending an amount in one category fits that category, and how much of the surprise buffer it would use.',
    parameters: { type: 'object', properties: { category: { type: 'string', description: 'Category id', enum: catIds }, amount: { type: 'number', description: 'Total cost in rupees' } }, required: ['category', 'amount'] },
    run: (p, a) => {
      const line = p.budget.find((b) => b.category === a.category);
      const buffer = p.budget.find((b) => b.category === 'misc');
      if (!line) return { error: 'Unknown category' };
      const room = line.planned - line.booked;
      const over = Math.max(0, Number(a.amount) - room);
      return { category: categoryName(line.category), planned: line.planned, already_booked: line.booked, room_left: room, amount: a.amount, fits: over === 0, over_by: over, buffer_left: buffer ? buffer.planned - buffer.booked : 0, buffer_after: buffer ? buffer.planned - buffer.booked - over : -over };
    },
  },
  {
    name: 'list_tasks',
    description: 'To-dos from the wedding timeline. Filter by when they are due, and optionally by category.',
    parameters: { type: 'object', properties: { when: { type: 'string', description: 'Which tasks', enum: ['overdue', 'next_30_days', 'open', 'done', 'all'] }, category: { type: 'string', description: 'Optional category id or "general"', enum: [...catIds, 'general'] } }, required: ['when'] },
    run: (p, a) => {
      const t = today(), in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const list = p.tasks.filter((x) => (!a.category || x.category === a.category) && (
        a.when === 'overdue' ? !x.done && x.due < t : a.when === 'next_30_days' ? !x.done && x.due >= t && x.due <= in30 : a.when === 'open' ? !x.done : a.when === 'done' ? x.done : true));
      return { today: t, wedding_date: p.wedding.date, days_to_wedding: daysUntil(p.wedding.date), count: list.length, tasks: list.slice(0, 25).map((x) => ({ title: x.title, due: x.due, done: x.done, category: x.category })) };
    },
  },
  {
    name: 'compare_quotes',
    description: 'Vendor quotes for a category, brought to the same basis (the expected guest count, GST and service charges included), cheapest first, with hidden costs flagged.',
    parameters: { type: 'object', properties: { category: { type: 'string', description: 'Category id', enum: catIds } }, required: ['category'] },
    run: (p, a) => {
      const qs = p.quotes.filter((q) => q.data.category === a.category);
      if (!qs.length) return { message: `No ${categoryName(String(a.category))} quotes added yet.` };
      return { guests_used: p.wedding.guests, how_to_read: 'total_with_gst_and_charges already includes GST, service charges and minimum-guest guarantees. Do not add GST again. Only items under not_included are extra.', quotes: compare(qs, p.wedding.guests).map((c) => ({ vendor: c.quote.data.vendor, quoted: c.quote.data.total ?? c.quote.data.subtotal ?? (c.quote.data.perPlate != null ? `${c.quote.data.perPlate} per plate` : null), total_with_gst_and_charges: c.effectiveTotal && Math.round(c.effectiveTotal), per_guest: c.perGuest && Math.round(c.perGuest), already_counted: c.flags.filter((f) => !/^Not included/.test(f.text)).map((f) => f.text), not_included: c.quote.data.extrasMentioned })) };
    },
  },
  {
    name: 'guest_counts',
    description: 'Guest numbers: total by side and rooms needed, or RSVPs (yes, maybe, no, pending) for one event.',
    parameters: { type: 'object', properties: { event: { type: 'string', description: 'Optional event id, e.g. sangeet or wedding' } } },
    run: (p, a) => {
      const ev = a.event ? p.wedding.events.find((e) => e.id === a.event || e.name.toLowerCase() === String(a.event).toLowerCase()) : null;
      return ev ? { event: ev.name, date: ev.date, planned_for: ev.expected, ...headcount(p.guests, ev.id) } : { families: p.guests.length, ...headcount(p.guests), planned_guests: p.wedding.guests, events: p.wedding.events.map((e) => ({ id: e.id, name: e.name, date: e.date })) };
    },
  },
];

export function runTool(plan: Plan, name: string, args: Json): unknown {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) return { error: `No tool called ${name}` };
  try { return t.run(plan, args || {}); } catch (e) { return { error: e instanceof Error ? e.message : 'Tool failed' }; }
}
