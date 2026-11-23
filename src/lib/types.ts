export const CATEGORIES = [
  { id: 'venue', name: 'Venue', share: 0.2 },
  { id: 'catering', name: 'Catering', share: 0.3 },
  { id: 'decor', name: 'Decor and flowers', share: 0.1 },
  { id: 'photo', name: 'Photo and video', share: 0.08 },
  { id: 'outfits', name: 'Outfits and jewellery', share: 0.12 },
  { id: 'beauty', name: 'Makeup and mehendi', share: 0.03 },
  { id: 'music', name: 'Music, DJ and sangeet', share: 0.04 },
  { id: 'invites', name: 'Invitations and gifts', share: 0.04 },
  { id: 'stay', name: 'Rooms and transport', share: 0.06 },
  { id: 'misc', name: 'Buffer for surprises', share: 0.03 },
] as const;
export type CategoryId = typeof CATEGORIES[number]['id'];
export const categoryName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;

export const EVENT_TYPES = ['Roka', 'Haldi', 'Mehendi', 'Sangeet', 'Wedding', 'Reception'] as const;

export interface WeddingEvent { id: string; name: string; date: string; expected: number }
export interface Wedding { couple: string; date: string; city: string; budget: number; guests: number; events: WeddingEvent[] }
export interface Task { id: string; title: string; due: string; category: CategoryId | 'general'; done: boolean }
export interface BudgetLine { category: CategoryId; planned: number; booked: number; paid: number; vendor: string | null }

export interface LineItem { item: string; qty: number | null; unit: string | null; unitPrice: number | null; amount: number | null }
export interface QuoteData {
  vendor: string; category: CategoryId; phone: string | null;
  perPlate: number | null; minGuests: number | null;
  lineItems: LineItem[];
  subtotal: number | null; taxes: { name: string; rate: number | null; amount: number | null }[];
  taxIncluded: boolean | null; total: number | null;
  extrasMentioned: string[]; terms: string[]; validTill: string | null;
}
export interface Quote { id: string; file: string; thumb: string | null; data: QuoteData; source: 'gemini' | 'sample' | 'typed'; addedAt: string }

export type Side = 'bride' | 'groom';
export type Rsvp = 'yes' | 'no' | 'maybe' | '';
export interface Guest { id: string; name: string; side: Side; count: number; phone: string | null; needsRoom: boolean; rsvp: Record<string, Rsvp>; check?: string | null }

export interface Plan { wedding: Wedding; tasks: Task[]; budget: BudgetLine[]; quotes: Quote[]; guests: Guest[]; demo: boolean }

export const rupees = (n: number | null | undefined) => (n == null ? '–' : `₹${Math.round(n).toLocaleString('en-IN')}`);
export const lakh = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)} lakh` : rupees(n));
export const uid = () => Math.random().toString(36).slice(2, 9);
