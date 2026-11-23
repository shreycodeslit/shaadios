import type { Wedding, WeddingEvent } from './types';

const fmtDate = (d: string, lang: 'en' | 'hi') => new Date(d + 'T00:00:00Z').toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export function inviteText(w: Wedding, ev: WeddingEvent, lang: 'en' | 'hi'): string {
  if (lang === 'hi') return `🌼 सादर आमंत्रण 🌼\n\n${w.couple} के ${ev.name} में आपकी उपस्थिति हमारे लिए सौभाग्य होगी।\n\n📅 ${fmtDate(ev.date, 'hi')}\n📍 ${w.city}\n\nकृपया बताएं कि आप आ पाएंगे या नहीं, और कितने लोग होंगे। 🙏`;
  return `🌼 You're invited 🌼\n\nWe would love you to join us for the ${ev.name} of ${w.couple}.\n\n📅 ${fmtDate(ev.date, 'en')}\n📍 ${w.city}\n\nPlease reply with whether you can come and how many of you there will be. 🙏`;
}

export function reminderText(w: Wedding, ev: WeddingEvent, lang: 'en' | 'hi'): string {
  if (lang === 'hi') return `नमस्ते! याद दिला रहे हैं: ${w.couple} का ${ev.name} ${fmtDate(ev.date, 'hi')} को है। आपका इंतज़ार रहेगा। 🌼`;
  return `Hello! A gentle reminder that ${w.couple}'s ${ev.name} is on ${fmtDate(ev.date, 'en')}. Looking forward to seeing you. 🌼`;
}

export const waLink = (text: string, phone?: string | null) => `https://wa.me/${phone ? phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1') : ''}?text=${encodeURIComponent(text)}`;
