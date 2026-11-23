import { useEffect, useMemo, useRef, useState } from 'react';
import { samplePlan } from './lib/demo';
import { headcount, parseGuests } from './lib/guests';
import { inviteText, reminderText, waLink } from './lib/messages';
import { budgetTotals, daysUntil, newPlan } from './lib/planner';
import { compare } from './lib/quotes';
import { CATEGORIES, categoryName, lakh, rupees, uid, type CategoryId, type Guest, type Plan, type Rsvp } from './lib/types';

const KEY = 'shaadios.plan.v1';
type Tab = 'overview' | 'timeline' | 'budget' | 'quotes' | 'guests' | 'ask';
const TABS: [Tab, string][] = [['overview', 'Overview'], ['timeline', 'Timeline'], ['budget', 'Budget'], ['quotes', 'Quotes'], ['guests', 'Guests'], ['ask', 'Ask the planner']];

function load(): Plan { try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* ignore */ } return samplePlan(); }

export default function App() {
  const [plan, setPlan] = useState<Plan>(load);
  const [tab, setTab] = useState<Tab>(() => (TABS.some(([t]) => `#${t}` === window.location.hash) ? (window.location.hash.slice(1) as Tab) : 'overview'));
  const [setup, setSetup] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => { try { if (!plan.demo) localStorage.setItem(KEY, JSON.stringify(plan)); } catch { /* ignore */ } }, [plan]);
  useEffect(() => { history.replaceState(null, '', `#${tab}`); }, [tab]);
  const days = daysUntil(plan.wedding.date);

  return (
    <div className="page">
      <div className="toran" aria-hidden="true" />
      <header className="top">
        <div>
          <p className="mark">ShaadiOS</p>
          <h1>{plan.wedding.couple}</h1>
          <p className="sub">{new Date(plan.wedding.date + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} · {plan.wedding.city} · {plan.wedding.guests} guests · {lakh(plan.wedding.budget)}</p>
        </div>
        <div className="count" aria-label={`${days} days to go`}><b>{Math.max(days, 0)}</b><span>{days >= 0 ? 'days to go' : 'days since'}</span></div>
      </header>
      {plan.demo && (
        <div className="banner">
          <p>You’re looking at a sample wedding with made-up families and vendors. Click around, or plan your own.</p>
          <button onClick={() => setSetup(true)}>Plan our wedding</button>
        </div>
      )}
      {setup && <Setup onCancel={() => setSetup(false)} onDone={(p) => { setPlan(p); setSetup(false); setTab('overview'); }} />}
      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map(([t, l]) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{l}</button>)}
      </nav>
      <main>
        {tab === 'overview' && <Overview plan={plan} go={setTab} />}
        {tab === 'timeline' && <Timeline plan={plan} setPlan={setPlan} />}
        {tab === 'budget' && <Budget plan={plan} setPlan={setPlan} />}
        {tab === 'quotes' && <Quotes plan={plan} setPlan={setPlan} />}
        {tab === 'guests' && <Guests plan={plan} setPlan={setPlan} />}
        {tab === 'ask' && <Ask plan={plan} />}
      </main>
      <footer className="foot">
        <p>Your plan is saved in this browser only. {!plan.demo && (confirmClear
          ? <>Delete your plan from this browser? <button className="link" onClick={() => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } setPlan(samplePlan()); setConfirmClear(false); }}>Yes, delete it</button> <button className="link" onClick={() => setConfirmClear(false)}>Keep it</button></>
          : <button className="link" onClick={() => setConfirmClear(true)}>Delete our plan</button>)}</p>
        <p>Built by <a href="https://shreygupta-three.vercel.app" target="_blank" rel="noopener">Shrey Gupta</a> · <a href="https://github.com/shreycodeslit/shaadios" target="_blank" rel="noopener">Code on GitHub</a></p>
      </footer>
    </div>
  );
}

function Setup({ onCancel, onDone }: { onCancel: () => void; onDone: (p: Plan) => void }) {
  const [f, setF] = useState({ couple: '', date: '', city: 'Gurugram', budget: '20', guests: '250' });
  const valid = f.couple.trim() && f.date && Number(f.budget) > 0 && Number(f.guests) > 0;
  return (
    <form className="setup" onSubmit={(e) => { e.preventDefault(); if (valid) onDone(newPlan({ couple: f.couple.trim(), date: f.date, city: f.city.trim() || 'Gurugram', budget: Number(f.budget) * 100000, guests: Number(f.guests) })); }}>
      <h2>Four things, and the plan writes itself</h2>
      <div className="grid4">
        <label><span>Couple</span><input required value={f.couple} onChange={(e) => setF({ ...f, couple: e.target.value })} placeholder="Riya & Arjun" /></label>
        <label><span>Wedding date</span><input required type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label><span>City</span><input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
        <label><span>Budget (lakh ₹)</span><input type="number" min="1" step="0.5" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></label>
        <label><span>Guests</span><input type="number" min="10" value={f.guests} onChange={(e) => setF({ ...f, guests: e.target.value })} /></label>
      </div>
      <p className="hint">You get a month-by-month timeline, a budget split you can change, and space for quotes and guests. Everything stays in this browser.</p>
      <div className="row"><button className="primary" disabled={!valid}>Create our plan</button><button type="button" className="link" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function Overview({ plan, go }: { plan: Plan; go: (t: Tab) => void }) {
  const t = budgetTotals(plan.budget);
  const today = new Date().toISOString().slice(0, 10);
  const next = plan.tasks.filter((x) => !x.done).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
  const hc = headcount(plan.guests);
  const pct = (n: number) => `${Math.min(100, (n / plan.wedding.budget) * 100)}%`;
  return (
    <div className="overview">
      <section className="card">
        <h2>Money</h2>
        <div className="money-bar" role="img" aria-label={`Booked ${lakh(t.booked)} of ${lakh(plan.wedding.budget)}, paid ${lakh(t.paid)}`}>
          <span className="booked" style={{ width: pct(t.booked) }} /><span className="paid" style={{ width: pct(t.paid) }} />
        </div>
        <p className="money-legend"><span><i className="sw paid" />Paid {lakh(t.paid)}</span><span><i className="sw booked" />Booked {lakh(t.booked)}</span><span><i className="sw free" />Not yet committed {lakh(plan.wedding.budget - t.booked)}</span></p>
        <button className="link" onClick={() => go('budget')}>Open the budget</button>
      </section>
      <section className="card">
        <h2>Next up</h2>
        <ul className="next">{next.map((x) => <li key={x.id} className={x.due < today ? 'late' : ''}><span>{x.title}</span><time>{x.due < today ? 'Overdue' : shortDate(x.due)}</time></li>)}</ul>
        <button className="link" onClick={() => go('timeline')}>See the whole timeline</button>
      </section>
      <section className="card">
        <h2>Events</h2>
        <ul className="events">{plan.wedding.events.map((e) => { const h = headcount(plan.guests, e.id); return <li key={e.id}><b>{e.name}</b><span>{shortDate(e.date)}</span><span>{'yes' in h ? `${h.yes} coming` : ''}</span></li>; })}</ul>
        <p className="hint">{plan.guests.length} families, {hc.total} people on the list so far; {hc.rooms} need rooms.</p>
      </section>
      <section className="card ask-teaser">
        <h2>Not sure about something?</h2>
        <p>Ask the planner, which reads your own budget, quotes and guest list before it answers.</p>
        <button className="primary" onClick={() => go('ask')}>Ask the planner</button>
      </section>
    </div>
  );
}

const shortDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function Timeline({ plan, setPlan }: { plan: Plan; setPlan: (f: (p: Plan) => Plan) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const months = useMemo(() => {
    const m = new Map<string, typeof plan.tasks>();
    for (const t of [...plan.tasks].sort((a, b) => a.due.localeCompare(b.due))) { const k = t.due.slice(0, 7); m.set(k, [...(m.get(k) || []), t]); }
    return [...m.entries()];
  }, [plan.tasks]);
  const [newTask, setNewTask] = useState('');
  return (
    <div>
      <form className="add" onSubmit={(e) => { e.preventDefault(); if (newTask.trim()) { setPlan((p) => ({ ...p, tasks: [...p.tasks, { id: uid(), title: newTask.trim(), due: today, category: 'general', done: false }] })); setNewTask(''); } }}>
        <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add your own task" aria-label="New task" /><button>Add</button>
      </form>
      {months.map(([k, list]) => (
        <section key={k} className="month">
          <h2>{new Date(k + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
          <ul className="tasks">{list.map((t) => (
            <li key={t.id} className={`${t.done ? 'done' : ''} ${!t.done && t.due < today ? 'late' : ''}`}>
              <label><input type="checkbox" checked={t.done} onChange={() => setPlan((p) => ({ ...p, tasks: p.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) }))} /><span>{t.title}</span></label>
              <span className="meta">{t.category !== 'general' && categoryName(t.category)} · {shortDate(t.due)}</span>
            </li>))}</ul>
        </section>
      ))}
    </div>
  );
}

function Budget({ plan, setPlan }: { plan: Plan; setPlan: (f: (p: Plan) => Plan) => void }) {
  const t = budgetTotals(plan.budget);
  const set = (cat: CategoryId, k: 'planned' | 'booked' | 'paid', v: number) => setPlan((p) => ({ ...p, budget: p.budget.map((b) => (b.category === cat ? { ...b, [k]: Math.max(0, v || 0) } : b)) }));
  return (
    <div>
      <p className="hint">The split starts from a typical Indian wedding and is yours to change. Booked means agreed with a vendor; paid is what has left your account.</p>
      <div className="table-wrap"><table className="budget">
        <thead><tr><th>Category</th><th>Planned</th><th>Booked</th><th>Paid</th><th>Vendor</th></tr></thead>
        <tbody>{plan.budget.map((b) => (
          <tr key={b.category} className={b.booked > b.planned ? 'over' : ''}>
            <td>{categoryName(b.category)}<div className="mini"><span style={{ width: `${Math.min(100, (b.booked / Math.max(1, b.planned)) * 100)}%` }} /></div></td>
            {(['planned', 'booked', 'paid'] as const).map((k) => <td key={k}><input type="number" min="0" step="1000" value={b[k]} onChange={(e) => set(b.category, k, Number(e.target.value))} aria-label={`${categoryName(b.category)} ${k}`} /></td>)}
            <td><input value={b.vendor ?? ''} onChange={(e) => setPlan((p) => ({ ...p, budget: p.budget.map((x) => (x.category === b.category ? { ...x, vendor: e.target.value || null } : x)) }))} placeholder="–" aria-label={`${categoryName(b.category)} vendor`} /></td>
          </tr>))}</tbody>
        <tfoot><tr><td>Total</td><td>{rupees(t.planned)}</td><td>{rupees(t.booked)}</td><td>{rupees(t.paid)}</td><td>{t.planned !== plan.wedding.budget && <span className={t.planned > plan.wedding.budget ? 'warn' : ''}>{t.planned > plan.wedding.budget ? `${rupees(t.planned - plan.wedding.budget)} over budget` : `${rupees(plan.wedding.budget - t.planned)} unplanned`}</span>}</td></tr></tfoot>
      </table></div>
    </div>
  );
}

function Quotes({ plan, setPlan }: { plan: Plan; setPlan: (f: (p: Plan) => Plan) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const cats = CATEGORIES.filter((c) => plan.quotes.some((q) => q.data.category === c.id));

  async function upload(f: File) {
    setBusy(true); setMsg(null);
    try {
      const isPdf = f.type === 'application/pdf';
      let data: string, mime: string, thumb: string | null = null;
      if (isPdf) { data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(f); }); mime = 'application/pdf'; }
      else {
        const bmp = await createImageBitmap(f); const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s); c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', 0.85); data = url.split(',')[1]; mime = 'image/jpeg';
        const t = document.createElement('canvas'); const ts = 360 / c.width; t.width = 360; t.height = Math.round(c.height * ts); t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height); thumb = t.toDataURL('image/jpeg', 0.7);
      }
      const res = await fetch('/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: data, mime }) });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || 'Couldn’t read that quote.');
      setPlan((p) => ({ ...p, quotes: [...p.quotes, { id: uid(), file: f.name, thumb, data: out.data, source: 'gemini', addedAt: new Date().toISOString() }] }));
      setMsg(`Read “${out.data.vendor}” in ${(out.ms / 1000).toFixed(1)} s.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Couldn’t read that quote.'); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="upload">
        <input ref={file} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        <button className="primary" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'Reading the quote…' : 'Add a quote (screenshot, photo or PDF)'}</button>
        <p className="hint">AI reads the prices, taxes and extras. The comparison below is plain arithmetic: every quote is brought to your {plan.wedding.guests} guests with GST and service charges in.</p>
        {msg && <p className="msg">{msg}</p>}
      </div>
      {!cats.length && <p className="empty">No quotes yet. Add the first one above.</p>}
      {cats.map((c) => {
        const rows = compare(plan.quotes.filter((q) => q.data.category === c.id), plan.wedding.guests);
        const booked = plan.budget.find((b) => b.category === c.id);
        return (
          <section key={c.id} className="qcat">
            <h2>{c.name} <small>{rows.length} quote{rows.length === 1 ? '' : 's'} · planned {lakh(booked?.planned || 0)}</small></h2>
            <div className="qgrid">{rows.map((r, i) => (
              <article key={r.quote.id} className={`quote${i === 0 ? ' best' : ''}`}>
                {r.quote.thumb && <button className="thumb" onClick={() => setZoom(r.quote.thumb)} aria-label={`See the ${r.quote.data.vendor} quote`}><img src={r.quote.thumb} alt="" /></button>}
                <div className="qbody">
                  <h3>{r.quote.data.vendor}{r.quote.source === 'sample' && <span className="tag">sample</span>}</h3>
                  <p className="quoted">Quoted: {r.quote.data.total != null ? rupees(r.quote.data.total) : r.quote.data.subtotal != null ? rupees(r.quote.data.subtotal) : r.quote.data.perPlate != null ? `${rupees(r.quote.data.perPlate)} a plate` : '–'}</p>
                  <p className="real"><b>{rupees(r.effectiveTotal)}</b> like for like{r.perGuest && <span> · {rupees(r.perGuest)} a guest</span>}</p>
                  {i === 0 && rows.length > 1 && <p className="lowest">Lowest once everything is added</p>}
                  <ul className="flags">{r.flags.map((f) => <li key={f.text} className={f.severity}>{f.text}</li>)}</ul>
                  <button onClick={() => setPlan((p) => ({ ...p, budget: p.budget.map((b) => (b.category === c.id ? { ...b, booked: Math.round(r.effectiveTotal || 0), vendor: r.quote.data.vendor } : b)) }))} disabled={booked?.vendor === r.quote.data.vendor}>
                    {booked?.vendor === r.quote.data.vendor ? 'Booked' : 'Book this one'}
                  </button>
                </div>
              </article>))}</div>
          </section>
        );
      })}
      {zoom && <div className="zoom" role="dialog" aria-modal="true" onClick={() => setZoom(null)}><img src={zoom} alt="Quote" /><button aria-label="Close">×</button></div>}
    </div>
  );
}

const NEXT_RSVP: Record<Rsvp, Rsvp> = { '': 'yes', yes: 'maybe', maybe: 'no', no: '' };

function Guests({ plan, setPlan }: { plan: Plan; setPlan: (f: (p: Plan) => Plan) => void }) {
  const [paste, setPaste] = useState('');
  const [preview, setPreview] = useState<Guest[] | null>(null);
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [evId, setEvId] = useState(plan.wedding.events.at(-1)?.id || '');
  const ev = plan.wedding.events.find((e) => e.id === evId) || plan.wedding.events[0];
  const hc = headcount(plan.guests);
  const update = (id: string, patch: Partial<Guest>) => setPlan((p) => ({ ...p, guests: p.guests.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
  return (
    <div>
      <section className="card">
        <h2>Paste a list</h2>
        <p className="hint">Straight from WhatsApp or Excel. “Sharma ji + family (4)”, “Mr & Mrs Gupta” and “Bride side:” headings are understood.</p>
        <textarea rows={5} value={paste} onChange={(e) => { setPaste(e.target.value); setPreview(null); }} placeholder={'Bride side:\nSharma ji + family (4)\nMr & Mrs Gupta, 98100 12345\nGroom side:\nKapoor family x5'} aria-label="Guest list" />
        <div className="row">
          <button onClick={() => setPreview(parseGuests(paste))} disabled={!paste.trim()}>Read the list</button>
          {preview && <button className="primary" onClick={() => { setPlan((p) => ({ ...p, guests: [...p.guests, ...preview] })); setPaste(''); setPreview(null); }}>Add {preview.length} families ({preview.reduce((a, g) => a + g.count, 0)} people)</button>}
        </div>
        {preview && <ul className="preview">{preview.map((g) => <li key={g.id}>{g.name} · {g.count} · {g.side === 'bride' ? 'Bride’s side' : 'Groom’s side'}{g.check && <em> {g.check}</em>}</li>)}</ul>}
      </section>

      <div className="guest-head">
        <h2>{plan.guests.length} families, {hc.total} people</h2>
        <p>Bride’s side {hc.bride} · Groom’s side {hc.groom} · {hc.rooms} need rooms</p>
        <label className="evpick"><span>RSVPs for</span><select value={evId} onChange={(e) => setEvId(e.target.value)}>{plan.wedding.events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      </div>
      {ev && (() => { const h = headcount(plan.guests, ev.id); return 'yes' in h && <p className="rsvp-sum"><b>{h.yes}</b> coming · {h.maybe} maybe · {h.no} not coming · {h.pending} haven’t replied · planned for {ev.expected}</p>; })()}
      <div className="table-wrap"><table className="guests">
        <thead><tr><th>Family</th><th>People</th><th>Side</th><th>{ev?.name}</th><th>Room</th><th>Invite</th></tr></thead>
        <tbody>{plan.guests.map((g) => (
          <tr key={g.id}>
            <td>{g.name}{g.check && <small className="warn"> {g.check}</small>}</td>
            <td><input type="number" min="1" max="40" value={g.count} onChange={(e) => update(g.id, { count: Math.max(1, Number(e.target.value) || 1), check: null })} aria-label={`${g.name} people`} /></td>
            <td>{g.side === 'bride' ? 'Bride' : 'Groom'}</td>
            <td><button className={`rsvp r-${g.rsvp[ev?.id] || 'none'}`} onClick={() => update(g.id, { rsvp: { ...g.rsvp, [ev.id]: NEXT_RSVP[g.rsvp[ev.id] || ''] } })}>{({ yes: 'Coming', maybe: 'Maybe', no: 'Not coming', '': 'No reply' } as Record<string, string>)[g.rsvp[ev?.id] || '']}</button></td>
            <td><input type="checkbox" checked={g.needsRoom} onChange={() => update(g.id, { needsRoom: !g.needsRoom })} aria-label={`${g.name} needs a room`} /></td>
            <td><a href={waLink(inviteText(plan.wedding, ev, lang), g.phone)} target="_blank" rel="noopener">WhatsApp</a></td>
          </tr>))}</tbody>
      </table></div>
      {ev && <section className="card">
        <div className="row spread"><h2>Message for the {ev.name}</h2><div className="seg"><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button><button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिंदी</button></div></div>
        <pre className="msgbox">{inviteText(plan.wedding, ev, lang)}</pre>
        <p className="hint">Reminder for the week before:</p>
        <pre className="msgbox">{reminderText(plan.wedding, ev, lang)}</pre>
      </section>}
    </div>
  );
}

interface Msg { role: 'you' | 'planner'; text: string; steps?: { tool: string; args: Record<string, unknown> }[]; provider?: string }
const TOOL_LABEL: Record<string, string> = { get_budget: 'Checked the budget', can_afford: 'Checked if it fits', list_tasks: 'Looked at the timeline', compare_quotes: 'Compared the quotes', guest_counts: 'Counted guests' };
const SUGGESTED = ['Which caterer should we book, honestly?', 'Can we afford a ₹2.5 lakh photographer?', 'What’s overdue, and what should we do this month?', 'Sangeet ke liye kitne log aa rahe hain?'];

function Ask({ plan }: { plan: Plan }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  async function send(text: string) {
    if (!text.trim() || busy) return;
    setMsgs((m) => [...m, { role: 'you', text }]); setQ(''); setBusy(true);
    try {
      const res = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, plan: { ...plan, quotes: plan.quotes.map((x) => ({ ...x, thumb: null })) } }) });
      const d = await res.json();
      setMsgs((m) => [...m, res.ok ? { role: 'planner', text: d.answer, steps: d.steps, provider: d.provider } : { role: 'planner', text: d.error || 'The planner couldn’t answer just now.' }]);
    } catch { setMsgs((m) => [...m, { role: 'planner', text: 'No connection. Try again.' }]); }
    finally { setBusy(false); }
  }
  return (
    <div className="ask">
      <p className="hint">The planner doesn’t guess numbers. It looks them up in your plan with tools (budget, quotes, timeline, guests) and shows which ones it used.</p>
      <div className="chat" aria-live="polite">
        {!msgs.length && <div className="suggest">{SUGGESTED.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>}
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.steps && m.steps.length > 0 && <p className="steps">{m.steps.map((s, j) => <span key={j}>{TOOL_LABEL[s.tool] || s.tool}{s.args.category ? ` (${categoryName(String(s.args.category))})` : ''}</span>)}</p>}
            <p className="text">{m.text}</p>
            {m.provider && <p className="by">Answered by {m.provider === 'gemini' ? 'Gemini' : 'Groq'} on the free tier</p>}
          </div>
        ))}
        {busy && <div className="bubble planner"><p className="text">Looking it up…</p></div>}
      </div>
      <form className="add" onSubmit={(e) => { e.preventDefault(); send(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything about the plan, in English or Hindi" aria-label="Your question" maxLength={500} /><button disabled={busy || !q.trim()}>Ask</button>
      </form>
    </div>
  );
}
