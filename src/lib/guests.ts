// Cleans a messy pasted guest list (from WhatsApp or Excel) into one row per family with a headcount.
// "Sharma ji + family (4)" → Sharma ji, 4 · "Mr & Mrs Gupta" → 2 · "Bua ji +1" → 2 · "Bride side:" switches side.
import { uid, type Guest, type Side } from './types';

export function parseGuests(text: string, defaultSide: Side = 'bride'): Guest[] {
  let side: Side = defaultSide;
  const out: Guest[] = [];
  for (let raw of text.split(/\r?\n|;/)) {
    raw = raw.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim();
    if (!raw) continue;
    if (/^(?:bride|ladki|girl)(?:'s)?\s*(?:side|wale|paksh)?\s*:?\s*$/i.test(raw)) { side = 'bride'; continue; }
    if (/^(?:groom|ladka|boy)(?:'s)?\s*(?:side|wale|paksh)?\s*:?\s*$/i.test(raw)) { side = 'groom'; continue; }
    const csv = raw.split(/\t|,(?=\s*(?:\+?\d[\d\s-]{7,}|\d{1,2}\s*$|bride|groom))/i).map((s) => s.trim());
    let name = csv[0];
    let phone: string | null = null;
    let count = 1;
    let check: string | null = null;
    let lineSide = side;
    for (const extra of csv.slice(1)) {
      if (/^\+?\d[\d\s-]{7,}$/.test(extra)) phone = extra.replace(/[\s-]/g, '');
      else if (/^\d{1,2}$/.test(extra)) count = Number(extra);
      else if (/^bride$/i.test(extra)) lineSide = 'bride';
      else if (/^groom$/i.test(extra)) lineSide = 'groom';
    }
    const ph = name.match(/(\+?\d[\d\s-]{9,})/);
    if (ph) { phone = ph[1].replace(/[\s-]/g, ''); name = name.replace(ph[0], '').trim(); }
    const n = name.match(/\((\d{1,2})\)|\b(?:x|×)\s*(\d{1,2})\b|\s(\d{1,2})\s*(?:log|people|pax|members)?\s*$/i);
    if (n) { count = Number(n[1] || n[2] || n[3]); name = name.replace(n[0], '').trim(); }
    else if (/\b(?:mr\.?\s*(?:&|and)\s*mrs\.?|couple|dampati)\b/i.test(name)) count = 2;
    else if (/\+\s*(?:family|parivar|pariwar)\b/i.test(name)) { count = 4; check = 'Family size not given; assumed 4'; }
    else if (/\+\s*(\d)\b/.test(name)) count = 1 + Number(name.match(/\+\s*(\d)\b/)![1]);
    name = name.replace(/\s*\+\s*(?:family|parivar|pariwar|\d)\b/i, '').replace(/[,\s]+$/, '').trim();
    if (!name) continue;
    out.push({ id: uid(), name, side: lineSide, count: Math.max(1, Math.min(count, 40)), phone, needsRoom: false, rsvp: {}, check });
  }
  return out;
}

export function headcount(guests: Guest[], eventId?: string) {
  const sum = (f: (g: Guest) => boolean) => guests.filter(f).reduce((a, g) => a + g.count, 0);
  if (!eventId) return { total: sum(() => true), bride: sum((g) => g.side === 'bride'), groom: sum((g) => g.side === 'groom'), rooms: guests.filter((g) => g.needsRoom).length };
  return { yes: sum((g) => g.rsvp[eventId] === 'yes'), maybe: sum((g) => g.rsvp[eventId] === 'maybe'), no: sum((g) => g.rsvp[eventId] === 'no'), pending: sum((g) => !g.rsvp[eventId]) };
}
