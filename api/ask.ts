// POST /api/ask { question, plan } → { answer, steps, provider, ms }
import { z } from 'zod';
import { json, rateLimited } from './_lib/ai';
import { ask } from './_lib/agent';
import type { Plan } from '../src/lib/types';

export const config = { runtime: 'edge' };

const Body = z.object({ question: z.string().trim().min(2).max(500), plan: z.object({ wedding: z.object({ couple: z.string(), date: z.string(), city: z.string(), budget: z.number(), guests: z.number(), events: z.array(z.any()) }), tasks: z.array(z.any()).max(200), budget: z.array(z.any()).max(20), quotes: z.array(z.any()).max(40), guests: z.array(z.any()).max(1500) }).passthrough() });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (rateLimited(req, 15, 10 * 60_000)) return json({ error: 'Too many questions just now. Try again in a few minutes.' }, 429);
  const text = await req.text();
  if (text.length > 400_000) return json({ error: 'The plan is too large to send.' }, 413);
  const p = Body.safeParse((() => { try { return JSON.parse(text); } catch { return null; } })());
  if (!p.success) return json({ error: 'Send a question and the plan.' }, 400);
  try {
    const r = await ask(p.data.question, p.data.plan as unknown as Plan);
    console.log(JSON.stringify({ route: 'ask', provider: r.provider, ms: r.ms, tools: r.steps.map((s) => s.tool) }));
    return json(r);
  } catch (e) {
    console.error(JSON.stringify({ route: 'ask', error: e instanceof Error ? e.message : String(e) }));
    return json({ error: 'The planner is busy or out of free quota right now. Try again in a minute.' }, 503);
  }
}
