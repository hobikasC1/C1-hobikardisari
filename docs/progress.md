# Hobikardisari — Development Progress

## Deadline: May 3, 2026 (14 days)

## Stack
- Next.js 15 (App Router) + React + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + Storage)
- Gemini API (OCR for timing screenshots)
- jsPDF (PDF export)
- Vercel (deploy)

---

## Phase 1: Foundation
- [x] Supabase project linked
- [x] Database schema created (8 tables + RLS + indexes)
- [x] Supabase client utilities (browser, server, admin)
- [x] Auth middleware (redirects to /login if not authenticated)
- [x] Login page
- [x] TypeScript types matching DB schema
- [x] Admin user created in Supabase
- [x] Build passes

## Phase 2: Driver & Team Management (`/drivers`)
- [x] Rewrite drivers page to use Supabase instead of localStorage
- [x] Driver CRUD (first name, last name, DOB, weight, class, is_licensed)
- [x] Team CRUD (name, 2 core drivers, 1 optional substitute)
- [x] Substitute can only be used once per season (track which event)
- [x] Delete driver with double confirmation
- [x] Search/filter drivers

## Phase 3: Event & Calendar Management (`/races`)
- [x] Season calendar view (6 events for 2026)
- [x] Create/edit events (name, venue, date, max karts, kart numbers)
- [x] Event status flow: draft → in_progress → completed → published
- [x] Countdown to next event on home page

## Phase 4: Race Day Workflow (`/races/[eventId]`)
- [x] Step 1: Register participants for event (from driver list)
- [x] Step 2: Set kart count → system recommends group sizes
- [x] Step 3: Qualification groups — auto kart draw (different karts in Q1 & Q2)
- [x] Step 4: Q1 & Q2 results entry (manual + OCR)
- [x] Step 5: Best lap time from both sessions calculated
- [x] Step 6: Heat groups generated from quali results + auto kart draw
- [x] Step 7: Heat results entry (manual + OCR)
- [x] Step 8: Final groups generated from heat results + auto kart draw
- [x] Step 9: Final results entry (manual + OCR)
- [x] Step 10: Event overview with status control
- [x] Manual override: edit groups, move drivers between groups at any step
- [x] Penalty notes per driver per session
- [x] Delete driver/result with double confirmation

## Phase 5: Points Calculation
- [x] Heat points per group: 1st=13, 2nd=11, 3rd=10, 4th=9...12th=1
- [x] Final points per class: 1st=35, 2nd=31, 3rd=28, 4th=26...29th=1
- [x] Fastest lap bonus: overall=3pts, per-group=1pt
- [x] All classes race together in finals, points counted per class
- [x] Licensed drivers excluded from points (removable from standings)

## Phase 6: Standings (`/standings`)
- [x] Junior standings table
- [x] Standard standings table
- [x] Heavy standings table
- [x] Team standings table (top 2 of 3 members per event)
- [x] Points per event columns (E1–E6)
- [x] Refresh button to recalculate

## Phase 7: OCR / Image Import (built into Phase 4)
- [x] Upload timing screenshot
- [x] Gemini Vision API extracts kart numbers + lap times
- [x] Map kart numbers to registered drivers
- [x] Auto-fill result fields, organizer confirms before saving

## Phase 8: PDF Export
- [x] Export qualification results as PDF
- [x] Export heat results as PDF
- [x] Export final results as PDF
- [x] Include penalty notes in PDF
- [x] "Laadi alla PDF" button on each results step (auto-detects session type)
- [x] Overview step: individual buttons per session type + "Kõik tulemused" combined PDF

## Phase 9: Polish & Deploy
- [ ] Public standings page (no auth, for hobbykardi.ee)
- [ ] Multi-season support (archive 2026, start 2027)
- [ ] Responsive design check
- [ ] Deploy to Vercel
- [ ] Connect to hobbykardi.ee domain

---

## Current Status
**Phase 9** — Polish & Deploy
