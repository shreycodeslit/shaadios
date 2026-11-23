# ShaadiOS

**An Indian wedding, run from one place.** Date, city, budget and guest count become a month-by-month plan, a budget split, a vendor-quote comparison and a guest list with RSVPs. AI reads the vendor quotes and answers questions from the couple's own numbers.

Live: _add the Vercel link here_

## What it does

- **Plan from four inputs.** A timeline of 29 tasks from the venue booking to thank-you messages, and a budget split across 10 categories that you can change.
- **Quotes compared like for like.** Drop a quote in as a screenshot, a WhatsApp chat or a PDF. Gemini reads it into line items, taxes, minimums and extras. Plain code then brings every quote to the same basis: your headcount, GST and service charges included. It also flags what will be added later (minimum plate guarantees, "GST extra", live counters, transport, drones).
  - In the sample wedding, the caterer quoting ₹1,450 a plate ends up the most expensive at ₹6,24,225 once its 350-plate minimum, GST and service charge are counted.
- **Ask the planner.** A tool-using agent (Gemini, with Groq as a backup) answers questions like "can we afford a ₹2.5 lakh photographer?" or "sangeet ke liye kitne log aa rahe hain?". It calls `get_budget`, `can_afford`, `compare_quotes`, `list_tasks` and `guest_counts` on the couple's own plan, never guesses a number, and shows which tools it used.
- **Guests from a messy list.** Paste straight from WhatsApp or Excel: "Sharma ji + family (4)", "Mr & Mrs Gupta", "Bride side:" headings. RSVPs are tracked per event, rooms flagged, and invites and reminders are ready in English and Hindi, opening in WhatsApp.
- **Budget tracker.** Planned, booked and paid per category, with overruns highlighted.

## How it's built

- React + TypeScript (Vite); the plan lives in the browser (localStorage), with no sign-up
- `api/quote.ts`: Gemini vision reads images and PDFs into a zod-validated schema
- `api/ask.ts` and `api/_lib/agent.ts`: an agent loop for Gemini function calling and OpenAI-style tools on Groq; the tools in `api/_lib/tools.ts` are pure functions over the plan
- Quote maths (`src/lib/quotes.ts`), the timeline and budget rules (`src/lib/planner.ts`) and the guest list reader (`src/lib/guests.ts`) are plain, tested code

## Tests

`npm test` checks the quote maths, the guest list reader, every agent tool, and the agent loop itself with a scripted model. It confirms the model receives the computed totals and flags, not raw quote text.

## Run and deploy

```bash
npm install && npm run dev
```

On Vercel, set `GEMINI_API_KEY` (and optionally `GROQ_API_KEY`). Both are free tiers; no card needed.

The sample wedding, families and vendors are invented. Built by [Shrey Gupta](https://shreygupta-three.vercel.app).
