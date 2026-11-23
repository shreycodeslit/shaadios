// POST /api/quote { file: base64, mime } → the quote read into line items, taxes and extras
import { z } from 'zod';
import { generateJson, json, rateLimited } from './_lib/ai';
import { CATEGORIES, type QuoteData } from '../src/lib/types';

export const config = { runtime: 'edge' };
export const PROMPT_VERSION = 'quote-v2';

const SYSTEM = `You read a wedding vendor's quote (a screenshot, photo, WhatsApp message or PDF) from India and turn it into data.
Category ids: ${CATEGORIES.map((c) => `${c.id} (${c.name})`).join(', ')}.
Return JSON: {"vendor": string, "category": id, "phone": string|null, "perPlate": number|null, "minGuests": number|null,
 "lineItems": [{"item": string, "qty": number|null, "unit": string|null, "unitPrice": number|null, "amount": number|null}],
 "subtotal": number|null, "taxes": [{"name": string, "rate": number|null, "amount": number|null}], "taxIncluded": true|false|null,
 "total": number|null, "extrasMentioned": string[], "terms": string[], "validTill": string|null}
Rules: amounts are plain rupee numbers (₹5,40,000 → 540000; "1.45k" → 1450; "5.4 lakh" → 540000). Copy only what the quote says; use null when it doesn't say.
taxIncluded: true if it says GST/taxes are included, false if it says GST/taxes are extra, null if it doesn't say.
minGuests: a minimum guarantee of plates or guests, if stated.
extrasMentioned: anything charged on top that is not in the total (live counters, extra waiters, transport, drone, overtime), each with its price as written.
terms: payment and other conditions, short. Return only the JSON.`;

const num = z.number().nonnegative().nullable().catch(null);
const Reply = z.object({
  vendor: z.string().trim().min(1).max(120).catch('Unknown vendor'),
  category: z.enum(CATEGORIES.map((c) => c.id) as [string, ...string[]]).catch('misc'),
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
    const r = await generateJson(SYSTEM, 'Read this quote.', (raw) => Reply.parse(raw) as QuoteData, { mime, data: file });
    console.log(JSON.stringify({ route: 'quote', provider: r.provider, ms: r.ms, prompt: PROMPT_VERSION, items: r.data.lineItems.length }));
    return json({ data: r.data, source: r.provider, ms: r.ms });
  } catch (e) {
    console.error(JSON.stringify({ route: 'quote', error: e instanceof Error ? e.message : String(e) }));
    return json({ error: 'The quote reader is busy or out of free quota. You can type the quote in instead.' }, 503);
  }
}
