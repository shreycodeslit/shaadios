// Tests: quote comparison maths, guest list cleaning, and the agent loop with a scripted model.
import { samplePlan, SAMPLE_QUOTES } from '../src/lib/demo';
import { parseGuests, headcount } from '../src/lib/guests';
import { compare } from '../src/lib/quotes';
import { runTool } from '../api/_lib/tools';

let fails = 0;
const ok = (c: unknown, l: string) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${l}`); if (!c) fails++; };

const cat = compare(SAMPLE_QUOTES.filter((q) => q.data.category === 'catering'), 300);
const by = Object.fromEntries(cat.map((c) => [c.quote.data.vendor, Math.round(c.effectiveTotal!)]));
ok(by['Rasoi Ghar Events'] === 442500, 'per-plate quote with no tax line: 1,250 × 300 + 18% GST = 4,42,500');
ok(by['Swaad Royal Kitchens'] === 540000, 'all-inclusive package stays at 5,40,000');
ok(by['Annapurna Caterers'] === 624225, 'minimum 350 plates + 18% GST + 5% service charge = 6,24,225');
ok(cat[0].quote.data.vendor === 'Rasoi Ghar Events' && cat[2].quote.data.vendor === 'Annapurna Caterers', 'sorted cheapest first on a like-for-like basis');
ok(cat.find((c) => c.quote.data.vendor === 'Annapurna Caterers')!.flags.some((f) => /Minimum 350/.test(f.text)), 'minimum guarantee above the headcount is flagged');
const ph = compare(SAMPLE_QUOTES.filter((q) => q.data.category === 'photo'), 300);
ok(ph[0].quote.data.vendor === 'Candid Lane Photography', 'a higher sticker price that includes GST can be the cheaper photographer');

const g = parseGuests('Bride side:\nSharma ji + family (4)\nMr & Mrs Gupta\nGroom side:\nKapoor family x5\nNeha didi + family');
ok(g.length === 4 && headcount(g).total === 15 && headcount(g).bride === 6, 'guest list: 4 families, 15 people, 6 on the bride side');
ok(g[3].check?.includes('assumed 4'), 'unknown family size is flagged for checking');

const plan = samplePlan(new Date('2026-11-23T10:00:00Z'));
const b = runTool(plan, 'get_budget', {}) as { total_budget: number; booked: number };
ok(b.total_budget === 2500000 && b.booked === 935000, 'budget tool totals the bookings (5.2 + 2.3 + 1.85 lakh)');
const af = runTool(plan, 'can_afford', { category: 'catering', amount: 800000 }) as { fits: boolean; over_by: number };
ok(af.fits === false && af.over_by === 50000, 'can_afford: ₹8 lakh catering is ₹50,000 over the ₹7.5 lakh plan');
const gc = runTool(plan, 'guest_counts', { event: 'sangeet' }) as { yes: number };
ok(gc.yes === 27, 'RSVP count for the sangeet (4+3+1+5+5+9)');

// Agent loop with a scripted Gemini: first asks for a tool, then answers
process.env.GEMINI_API_KEY = 'fake';
const sent: unknown[] = [];
let turn = 0;
globalThis.fetch = (async (_u: string, init: RequestInit) => {
  sent.push(JSON.parse(String(init.body)));
  turn++;
  const parts = turn === 1 ? [{ functionCall: { name: 'compare_quotes', args: { category: 'catering' } } }] : [{ text: 'Swaad Royal at ₹5,40,000 is the safest; Rasoi Ghar looks cheaper but adds GST and extras.' }];
  return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts } }] }), { status: 200 });
}) as typeof fetch;
const { ask } = await import('../api/_lib/agent');
const r = await ask('Which caterer should we pick?', plan);
const toolReply = JSON.stringify((sent[1] as { contents: unknown[] }).contents.at(-1));
ok(r.provider === 'gemini' && r.steps[0].tool === 'compare_quotes' && /Swaad/.test(r.answer), 'agent calls compare_quotes, then answers');
ok(toolReply.includes('442500') && toolReply.includes('Quote leaves out GST') && toolReply.includes('total_with_gst_and_charges'), 'the model receives the computed totals and flags from the tool');

const { tidy } = await import('../api/quote');
const messy = tidy({ ...SAMPLE_QUOTES[0].data, category: 'Catering' as never, taxes: [], total: 507500, subtotal: 507500, taxIncluded: false, lineItems: [{ item: 'Buffet', qty: 350, unit: 'plate', unitPrice: 1450, amount: 507500 }, { item: 'Service charge @ 5%', qty: null, unit: null, unitPrice: null, amount: null }] });
ok(messy.category === 'catering' && messy.taxes[0]?.rate === 5 && messy.lineItems.length === 1 && messy.total === null, 'quote tidy-up: category name, service charge moved to taxes, pre-GST total treated as subtotal');
ok(Math.round(compare([{ ...SAMPLE_QUOTES[0], data: messy }], 300)[0].effectiveTotal!) === 624225, 'tidied model output gives the same like-for-like total as the hand-checked sample');

console.log(fails ? `\n${fails} failed` : '\nAll passed');
process.exit(fails ? 1 : 0);
