# Meeting Summary — Hobikardisari App

## What the App Is

A race management system for the "Corner 1 Hobikardisari" — a 6-round hobby go-kart racing series in Estonia (May–August 2026). ~40 participants per round, record 63.

## Hard Deadline

**May 3, 2026** — first race of the season. App must be fully operational.

## Core Functional Requirements

### Race Day Management (per event)
1. Register participants for event (name, weight, DOB, class)
2. Set available kart count (e.g., 9 karts) → system recommends group sizes
3. Qualification groups — auto kart draw, drivers get different karts in Q1 and Q2
4. Q1 & Q2 results — best lap time from both sessions counts
5. Heat groups — generated from quali results, auto kart draw (no repeats)
6. Heat results — manual entry + **OCR from timing screenshots**
7. Final groups — generated from heat results, auto kart draw
8. Final results — same entry methods
9. Penalty notes per driver per session (carries to PDF)
10. PDF export of quali, heats, and finals results

### Point System
- **Heat points** (per group): 1st=13, 2nd=11, 3rd=10, 4th=9...12th=1
- **Final points** (per class): 1st=35, 2nd=31, 3rd=28, 4th=26, 5th=25...29th=1
- **Fastest lap**: overall fastest across all groups/classes = 3pts, per-group fastest = 1pt
- Finals: all classes race together, but points counted per class separately

### Weight Classes
- **Junior**: up to 65 kg
- **Standard**: 65–85 kg
- **Heavy**: 90–105 kg

### Drivers & Teams
- CRUD for drivers (name, DOB, weight, class)
- Teams: 2 core members + 1 substitute allowed per season
- Licensed drivers can participate but **cannot score points** — must be excludable from final standings

### Standings (4 tables)
1. Junior standings
2. Standard standings
3. Heavy standings
4. Team standings (sum of 2 members' points)

### Website Integration
- Public standings page connected to hobbykardi.ee
- "Publish results" button after event
- Simple season calendar with countdown to next round

### OCR / Image Import
- Timing systems send screenshots via WhatsApp
- App extracts kart numbers + lap times from photo
- Maps kart numbers to registered driver names
- Auto-fills result fields, organizer confirms before saving

### Manual Override (Critical)
- Must be able to manually create/edit groups at any step
- Move drivers between groups freely
- Edit any auto-generated result
- Backup for when automation logic fails

### Data Safety
- Double-confirmation for any deletion
- Multi-season support (archive 2026, start 2027 fresh)
- Free DB tier acceptable (season is only 4 months)

## Tech Decisions
- **Database**: Supabase (Postgres + Auth + Storage)
- **OCR**: Gemini API (Vision)
- **Frontend**: Next.js + React + Tailwind + shadcn/ui
- **PDF**: jsPDF
- **Deploy**: Vercel

## Budget
- €1,500 project cost, 3–4 month installment plan
- Potentially €20/month DB if winter series added
- Considered a one-time build, minimal maintenance for 2+ years
