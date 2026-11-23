// Free-tier AI calls shared by the API routes.
// Order: Google Gemini (free tier, no card) → Groq (free tier) as a backup.
// Keys live only in Vercel environment variables: GEMINI_API_KEY, GROQ_API_KEY.

declare const process: { env: Record<string, string | undefined> };

export type Provider = 'gemini' | 'groq';
export interface AiResult<T> { data: T; provider: Provider; ms: number }

const GEMINI_MODEL = () => process.env.GEMINI_MODEL || 'gemini-flash-latest';
const GROQ_MODEL = () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const TIMEOUT_MS = 20_000;

function withTimeout(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

/** Pulls the first JSON object or array out of a model reply, even if it is wrapped in ``` fences. */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch { /* fall through */ }
  const start = t.search(/[[{]/);
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
  throw new Error('The model did not return JSON');
}

export interface ImagePart { mime: string; data: string }

async function gemini(system: string, user: string, image?: ImagePart): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL()}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [...(image ? [{ inline_data: { mime_type: image.mime, data: image.data } }] : []), { text: user }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
    signal: withTimeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({})) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${body.error?.message || 'request failed'}`);
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) throw new Error('Gemini returned an empty reply');
  return text;
}

async function groq(system: string, user: string, image?: ImagePart): Promise<string> {
  if (image) throw new Error('Groq free tier has no image model');
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not set');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL(),
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
    signal: withTimeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({})) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(`Groq ${res.status}: ${body.error?.message || 'request failed'}`);
  const text = body.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Groq returned an empty reply');
  return text;
}

/**
 * Asks for JSON, validates it with `parse`, and falls back to the next free provider
 * on any failure (quota used up, timeout, invalid JSON, failed validation).
 */
export async function generateJson<T>(system: string, user: string, parse: (raw: unknown) => T, image?: ImagePart): Promise<AiResult<T>> {
  const errors: string[] = [];
  for (const [provider, call] of [['gemini', gemini], ['groq', groq]] as const) {
    const t0 = Date.now();
    try {
      const data = parse(extractJson(await call(system, user, image)));
      return { data, provider, ms: Date.now() - t0 };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(`No AI provider could answer (${errors.join(' | ')})`);
}

export function transcribeAvailable(): boolean { return !!process.env.GROQ_API_KEY; }

/** Speech to text with Groq's hosted Whisper (free tier). */
export async function transcribe(audio: Blob, language?: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not set');
  const form = new FormData();
  form.append('file', audio, 'speech.webm');
  form.append('model', process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo');
  form.append('response_format', 'json');
  form.append('temperature', '0');
  if (language) form.append('language', language);
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: withTimeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({})) as { text?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(`Groq ${res.status}: ${body.error?.message || 'transcription failed'}`);
  return (body.text || '').trim();
}

// ---------- small helpers for the routes ----------

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

const hits = new Map<string, { count: number; start: number }>();
/** Best-effort per-visitor limit; each server instance keeps its own counts. */
export function rateLimited(req: Request, max: number, windowMs: number): boolean {
  const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.start > windowMs) { hits.set(ip, { count: 1, start: now }); return false; }
  e.count += 1;
  return e.count > max;
}
