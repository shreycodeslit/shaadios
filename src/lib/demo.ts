// A fictional sample wedding so a visitor sees a full plan without typing anything.
// Vendors and families are invented; quote images in /public/samples were made from the same data.
import { addDaysIso, buildBudget, buildTasks, defaultEvents } from './planner';
import { uid, type Guest, type Plan, type Quote, type QuoteData } from './types';

const q = (id: string, file: string, data: QuoteData): Quote => ({ id, file, thumb: `/samples/${file}`, data, source: 'sample', addedAt: '2026-11-20T10:00:00Z' });

export const SAMPLE_QUOTES: Quote[] = [
  q('q1', 'annapurna-caterers.png', {
    vendor: 'Annapurna Caterers', category: 'catering', phone: '98XXXXXX01', perPlate: 1450, minGuests: 350,
    lineItems: [{ item: 'Wedding dinner, veg buffet (4 starters, 6 mains, 3 desserts)', qty: 350, unit: 'plate', unitPrice: 1450, amount: 507500 }],
    subtotal: 507500, taxes: [{ name: 'Service charge', rate: 5, amount: null }], taxIncluded: false, total: null,
    extrasMentioned: ['Live chaat counter, ₹45 per plate', 'Waiters beyond 20, ₹900 each'], terms: ['GST extra as applicable', '50% advance to confirm'], validTill: '31 Jan 2027',
  }),
  q('q2', 'swaad-royal.png', {
    vendor: 'Swaad Royal Kitchens', category: 'catering', phone: '98XXXXXX02', perPlate: null, minGuests: null,
    lineItems: [{ item: 'Wedding dinner package for 300 guests, incl. 2 live counters', qty: 1, unit: 'package', unitPrice: 540000, amount: 540000 }],
    subtotal: null, taxes: [{ name: 'GST 18%', rate: 18, amount: null }], taxIncluded: true, total: 540000,
    extrasMentioned: [], terms: ['Price includes GST, crockery and service staff', '50% advance, balance on the day'], validTill: null,
  }),
  q('q3', 'rasoi-ghar.png', {
    vendor: 'Rasoi Ghar Events', category: 'catering', phone: '98XXXXXX03', perPlate: 1250, minGuests: null,
    lineItems: [{ item: 'Veg buffet, per plate', qty: null, unit: 'plate', unitPrice: 1250, amount: null }],
    subtotal: null, taxes: [], taxIncluded: null, total: null,
    extrasMentioned: ['Bone china crockery upgrade, ₹60 per plate', 'Transport outside Gurugram, ₹8,000'], terms: ['30% advance'], validTill: null,
  }),
  q('q4', 'frames-by-arjun.png', {
    vendor: 'Frames by Arjun Studio', category: 'photo', phone: '98XXXXXX04', perPlate: null, minGuests: null,
    lineItems: [{ item: '2 days, 2 photographers, 1 cinematographer, 40-sheet album', qty: 1, unit: 'package', unitPrice: 180000, amount: 180000 }],
    subtotal: 180000, taxes: [], taxIncluded: false, total: null,
    extrasMentioned: ['Drone coverage, ₹15,000'], terms: ['GST 18% extra', 'Edited photos in 6 weeks'], validTill: null,
  }),
  q('q5', 'candid-lane.png', {
    vendor: 'Candid Lane Photography', category: 'photo', phone: '98XXXXXX05', perPlate: null, minGuests: null,
    lineItems: [{ item: 'Full coverage, 3 events, drone and pre-wedding shoot included', qty: 1, unit: 'package', unitPrice: 210000, amount: 210000 }],
    subtotal: null, taxes: [], taxIncluded: true, total: 210000,
    extrasMentioned: [], terms: ['Inclusive of GST', 'Album delivered in 8 weeks'], validTill: null,
  }),
];

const G = (name: string, side: 'bride' | 'groom', count: number, room = false, rsvp: Record<string, 'yes' | 'no' | 'maybe' | ''> = {}): Guest =>
  ({ id: uid(), name, side, count, phone: null, needsRoom: room, rsvp });

export function samplePlan(today = new Date()): Plan {
  // The sample wedding is always about 11 weeks away, so the plan looks mid-way whenever someone opens it
  const date = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) + 80 * 86400000).toISOString().slice(0, 10);
  const tasks = buildTasks(date).map((t) => ({ ...t, done: t.due < today.toISOString().slice(0, 10) && !/save-the-dates|DJ/.test(t.title) }));
  const budget = buildBudget(2500000).map((b) => b.category === 'venue' ? { ...b, booked: 520000, paid: 200000, vendor: 'The Grand Courtyard' }
    : b.category === 'decor' ? { ...b, booked: 230000, paid: 50000, vendor: 'Genda Phool Decor' }
      : b.category === 'outfits' ? { ...b, booked: 185000, paid: 185000, vendor: 'Various' } : b);
  const all = { yes: 'yes', no: 'no', maybe: 'maybe' } as const;
  const guests: Guest[] = [
    G('Sharma ji', 'bride', 4, false, { sangeet: all.yes, wedding: all.yes }), G('Mr & Mrs Gupta', 'bride', 2, false, { wedding: all.yes }),
    G('Bua ji (Jaipur)', 'bride', 3, true, { haldi: all.yes, mehendi: all.yes, sangeet: all.yes, wedding: all.yes }), G('Neha didi', 'bride', 4, false, { mehendi: all.yes, wedding: all.maybe }),
    G('Rohit Malhotra', 'bride', 1, false, { sangeet: all.yes, wedding: all.yes }), G('Nani ji and Mama ji (Lucknow)', 'bride', 5, true, { haldi: all.yes, mehendi: all.yes, sangeet: all.yes, wedding: all.yes }),
    G('Office friends', 'bride', 8, false, { sangeet: all.maybe, wedding: all.yes }), G('Verma uncle', 'groom', 3, false, { wedding: all.yes }),
    G('Kapoor family (Chandigarh)', 'groom', 5, true, { sangeet: all.yes, wedding: all.yes }), G('Chacha ji', 'groom', 4, false, { wedding: all.yes }),
    G('College gang', 'groom', 9, false, { sangeet: all.yes, wedding: all.yes }), G('Masi ji (Pune)', 'groom', 2, true, { wedding: all.maybe }),
    G('Mehta neighbours', 'groom', 3, false, { wedding: all.no }), G('Arora family', 'bride', 4, false, {}), G('Dadi ji', 'groom', 1, false, { haldi: all.yes, wedding: all.yes }),
  ];
  return {
    wedding: { couple: 'Ananya & Kabir', date, city: 'Gurugram', budget: 2500000, guests: 300, events: defaultEvents(date, 300) },
    tasks, budget, quotes: SAMPLE_QUOTES, guests, demo: true,
  };
}

export { addDaysIso };
