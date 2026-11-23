// A small tool-using agent loop: the model decides which tools to call, the server runs them on the
// couple's plan, and the model answers from the results. Gemini (free tier) first, Groq as a backup.
import type { Plan } from '../../src/lib/types';
import { runTool, TOOLS } from './tools';

declare const process: { env: Record<string, string | undefined> };
const MAX_STEPS = 5;
export interface Step { tool: string; args: Record<string, unknown> }
export interface AgentResult { answer: string; steps: Step[]; provider: 'gemini' | 'groq'; ms: number }

const timeout = (ms: number) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };

async function viaGemini(system: string, question: string, plan: Plan): Promise<Omit<AgentResult, 'provider' | 'ms'>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const tools = [{ functionDeclarations: TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: Object.keys(t.parameters.properties).length ? t.parameters : undefined })) }];
  const contents: unknown[] = [{ role: 'user', parts: [{ text: question }] }];
  const steps: Step[] = [];
  for (let i = 0; i < MAX_STEPS; i++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, signal: timeout(25000),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, tools, generationConfig: { temperature: 0.2 } }),
    });
    const body = await res.json() as { candidates?: { content?: { role: string; parts: { text?: string; functionCall?: { name: string; args?: Record<string, unknown> } }[] } }[]; error?: { message?: string } };
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${body.error?.message || 'failed'}`);
    const content = body.candidates?.[0]?.content;
    if (!content) throw new Error('Gemini returned nothing');
    const calls = content.parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
    if (!calls.length) return { answer: content.parts.map((p) => p.text || '').join('').trim(), steps };
    contents.push(content);
    contents.push({ role: 'user', parts: calls.map((c) => { steps.push({ tool: c.name, args: c.args || {} }); return { functionResponse: { name: c.name, response: { result: runTool(plan, c.name, c.args || {}) } } }; }) });
  }
  throw new Error('Too many tool steps');
}

async function viaGroq(system: string, question: string, plan: Plan): Promise<Omit<AgentResult, 'provider' | 'ms'>> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not set');
  const tools = TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const messages: Record<string, unknown>[] = [{ role: 'system', content: system }, { role: 'user', content: question }];
  const steps: Step[] = [];
  for (let i = 0; i < MAX_STEPS; i++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, signal: timeout(25000),
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b', temperature: 0.2, messages, tools }),
    });
    const body = await res.json() as { choices?: { message: { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[]; error?: { message?: string } };
    if (!res.ok) throw new Error(`Groq ${res.status}: ${body.error?.message || 'failed'}`);
    const msg = body.choices?.[0]?.message;
    if (!msg) throw new Error('Groq returned nothing');
    if (!msg.tool_calls?.length) return { answer: (msg.content || '').trim(), steps };
    messages.push(msg as Record<string, unknown>);
    for (const c of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(c.function.arguments || '{}'); } catch { /* empty args */ }
      steps.push({ tool: c.function.name, args });
      messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(runTool(plan, c.function.name, args)) });
    }
  }
  throw new Error('Too many tool steps');
}

export async function ask(question: string, plan: Plan): Promise<AgentResult> {
  const system = `You are the planner for ${plan.wedding.couple}'s wedding in ${plan.wedding.city} on ${plan.wedding.date}, budget ₹${plan.wedding.budget.toLocaleString('en-IN')}, about ${plan.wedding.guests} guests. Today is ${new Date().toISOString().slice(0, 10)}.
Always use the tools to look up numbers; never guess an amount, date or count. Answer in 2–5 short sentences or a short list, with rupee amounts written like ₹5,40,000.
Be direct about trade-offs (e.g. a cheaper quote that has hidden costs). Reply in Hindi if the question is in Hindi. If the plan lacks what's needed, say what to add.`;
  const errors: string[] = [];
  for (const [provider, run] of [['gemini', viaGemini], ['groq', viaGroq]] as const) {
    const t0 = Date.now();
    try { const r = await run(system, question, plan); if (r.answer) return { ...r, provider, ms: Date.now() - t0 }; errors.push(`${provider}: empty answer`); }
    catch (e) { errors.push(e instanceof Error ? e.message : String(e)); }
  }
  throw new Error(errors.join(' | '));
}
