// POST /api/quote { file: base64, mime } → the quote read into line items, taxes and extras
import { z } from 'zod';
import { generateJson, json, rateLimited } from './_lib/ai';
import { CATEGORIES, type QuoteData } from '../src/lib/types';

export const config = { runtime: 'edge' };
export const PROMPT_VERSION = 'quote-v3';

const SYSTEM = `You read a wedding vendor's quote (a screenshot, photo, WhatsApp message or PDF) from India and turn it into data.
Category ids: ${CATEGORIES.map((c) => `${c.id} (${c.name})`).join(', ')}.
Return JSON: {"vendor": string, "category": id, "phone": string|null, "perPlate": number|null, "minGuests": number|null,
 "lineItems": [{"item": string, "qty": number|null, "unit": string|null, "unitPrice": number|null, "amount": number|null}],
 "subtotal": number|null, "taxes": [{"name": string, "rate": number|null, "amount": number|null}], "taxIncluded": true|false|null,
 "total": number|null, "extrasMentioned": string[], "terms": string[], "validTill": string|null}
Rules: category is one of the ids above, in lower case. Amounts are plain rupee numbers (₹5,40,000 → 540000; "1.45k" → 1450; "5.4 lakh" → 540000). Copy only what the quote says; use null when it doesn't say.
taxIncluded: true if it says GST/taxes are included, false if it says GST/taxes are extra, null if it doesn't say.
minGuests: a minimum guarantee of plates or guests, if stated.
taxes: GST and service charges go here (with their rate if given), never in lineItems.
total: the final amount payable only when the quote states it including everything; a "total before GST" is the subtotal, and then total is null.
extrasMentioned: anything charged on top that is not in the total (live counters, extra waiters, transport, drone, overtime), each with its price as written.
terms: payment and other conditions, short. Return only the JSON.`;

const num = z.number().nonnegative().nullable().catch(null);
const Reply = z.object({
  vendor: z.string().trim().min(1).max(120).catch('Unknown vendor'),
  category: z.string().catch('misc'),
  phone: z.string().max(40).nullable().catch(null),
  perPlate: num, minGuests: num,
  lineItems: z.array(z.object({ item: z.string().max(200), qty: num, unit: z.string().max(30).nullable().catch(null), unitPrice: num, amount: num })).max(40).catch([]),
  subtotal: num,
  taxes: z.array(z.object({ name: z.string().max(60), rate: num, amount: num })).max(10).catch([]),
  taxIncluded: z.boolean().nullable().catch(null),
  total: num,
  extrasMentioned: z.array(z.string().max(160)).max(15).catch([]),
  terms: z.array(z.string().max(200)).max(15).catch([]),
  validTill: z.string().max(40).nullable().catch(null),
});

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (rateLimited(req, 15, 10 * 60_000)) return json({ error: 'Too many quotes just now. Try again in a few minutes.' }, 429);
  let file = '', mime = '';
  try { const b = await req.json(); file = String(b.file || ''); mime = String(b.mime || ''); } catch { return json({ error: 'Send JSON with "file" and "mime".' }, 400); }
  if (!file) return json({ error: 'No file received.' }, 400);
  if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(mime)) return json({ error: 'Send a JPEG, PNG, WebP or PDF.' }, 415);
  if (file.length > 4_000_000) return json({ error: 'That file is too large (3 MB max).' }, 413);
  try {
    const r = await generateJson(SYSTEM, 'Read this quote.', (raw) => tidy(Reply.parse(raw) as unknown as QuoteData), { mime, data: file });
    console.log(JSON.stringify({ route: 'quote', provider: r.provider, ms: r.ms, prompt: PROMPT_VERSION, items: r.data.lineItems.length }));
    return json({ data: r.data, source: r.provider, ms: r.ms });
  } catch (e) {
    console.error(JSON.stringify({ route: 'quote', error: e instanceof Error ? e.message : String(e) }));
    return json({ error: 'The quote reader is busy or out of free quota. You can type the quote in instead.' }, 503);
  }
}

const CATEGORY_WORDS: [string, RegExp][] = [
  ['catering', /cater|food|buffet|menu|plate|kitchen|rasoi|halwai/i], ['photo', /photo|video|film|cinemat|drone|album/i], ['decor', /decor|flower|floral|mandap|light/i],
  ['venue', /venue|banquet|hall|lawn|farmhouse|resort/i], ['beauty', /makeup|mehendi|mehndi|salon|hair/i], ['music', /\bdj\b|band|dhol|music|sangeet|choreo/i],
  ['invites', /invit|card|gift|hamper/i], ['stay', /hotel|room|transport|cab|bus|travel/i], ['outfits', /lehenga|sherwani|outfit|jewel|saree|couture/i],
];

/** Code, not the model, has the last word on structure: a known category, taxes in the taxes list, no "total" that is really a subtotal. */
export function tidy(d: QuoteData): QuoteData {
  const ids = CATEGORIES.map((c) => c.id) as string[];
  let category = String(d.category || '').toLowerCase().trim();
  if (!ids.includes(category)) {
    const byName = CATEGORIES.find((c) => c.name.toLowerCase() === category);
    const text = [d.vendor, ...d.lineItems.map((l) => l.item)].join(' ');
    category = byName?.id ?? CATEGORY_WORDS.find(([, re]) => re.test(category) || re.test(text))?.[0] ?? 'misc';
  }
  const taxes = [...d.taxes];
  const lineItems = d.lineItems.filter((l) => {
    if (!/service charge|\bgst\b|\btax\b/i.test(l.item)) return true;
    const rate = l.item.match(/(\d+(?:\.\d+)?)\s*%/);
    if (!taxes.some((t) => t.name.toLowerCase() === l.item.toLowerCase())) taxes.push({ name: /service/i.test(l.item) ? 'Service charge' : l.item, rate: rate ? Number(rate[1]) : null, amount: l.amount });
    return false;
  });
  let total = d.total;
  if (d.taxIncluded === false && total != null && d.subtotal != null && total === d.subtotal) total = null;
  return { ...d, category: category as QuoteData['category'], taxes, lineItems, total };
}
