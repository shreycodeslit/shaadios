// Comparing vendor quotes fairly: everything is brought to the same basis (your headcount, tax included),
// and anything that will likely be added later is flagged. Pure code, so the numbers are checkable.
import type { Quote } from './types';

export interface Compared { quote: Quote; effectiveTotal: number | null; perGuest: number | null; flags: { text: string; severity: 'warn' | 'info' }[] }

const GST_DEFAULT = 0.18; // catering and event services are usually billed at 18% GST when outside a hotel; we only assume it to flag the gap

export function compare(quotes: Quote[], guests: number): Compared[] {
  return quotes.map((q) => {
    const d = q.data;
    const flags: Compared['flags'] = [];
    const billable = Math.max(guests, d.minGuests ?? 0);
    let base = d.total ?? d.subtotal ?? (d.perPlate != null ? d.perPlate * billable : null);
    if (d.perPlate != null && d.total == null && d.subtotal == null) base = d.perPlate * billable;

    if (d.minGuests != null && d.minGuests > guests) flags.push({ text: `Minimum ${d.minGuests} guests: you pay for ${d.minGuests - guests} more than you expect`, severity: 'warn' });
    const taxAmount = d.taxes.reduce((a, t) => a + (t.amount ?? 0), 0);
    let effective = base;
    if (d.taxIncluded === false || (d.taxIncluded == null && !d.taxes.length)) {
      flags.push({ text: 'GST not included; expect about 18% more', severity: 'warn' });
      if (base != null) effective = base * (1 + GST_DEFAULT);
    } else if (d.total == null && base != null && taxAmount) effective = base + taxAmount;
    for (const t of d.taxes) {
      if (!/service/i.test(t.name)) continue;
      flags.push({ text: `Service charge${t.rate ? ` of ${t.rate}%` : ''} added on top`, severity: 'warn' });
      if (t.amount == null && t.rate && base != null && effective != null && d.total == null) effective += (base * t.rate) / 100;
    }
    for (const x of d.extrasMentioned) flags.push({ text: `Extra cost: ${x}`, severity: 'warn' });
    if (d.perPlate != null && guests && d.minGuests == null && d.total == null) flags.push({ text: `Worked out for your ${guests} guests at ${d.perPlate}/plate`, severity: 'info' });
    if (d.validTill) flags.push({ text: `Price valid till ${d.validTill}`, severity: 'info' });
    return { quote: q, effectiveTotal: effective, perGuest: effective != null && guests ? effective / guests : null, flags };
  }).sort((a, b) => (a.effectiveTotal ?? Infinity) - (b.effectiveTotal ?? Infinity));
}
