---
name: hobikardisari-architecture
description: "Use when: understanding data flow, component interactions, or making changes to drivers, events, races, standings, or points calculations. Explains how mutations flow through the system and trigger UI updates."
applyTo: ["src/**/*.{ts,tsx}", "src/app/**/*"]
---

# Hobikardisari Carting System Architecture

This guide explains how data flows through the application and how components interact when actions occur. This is critical for understanding the system's behavior and making safe changes.

## Core Data Model

The system manages a **carting competition** with multiple **seasons**, each containing multiple **events** (races). Here's the hierarchy:

```
Season (is_active flag)
├── Events (draft → in_progress → completed → published)
│   ├── Sessions (quali_1, quali_2, heat, final)
│   │   ├── Session Participants (driver + kart assignment)
│   │   └── Session Results (position, lap times, points)
│   └── Event Entries (registers drivers + teams for the event)
├── Teams (driver1 + driver2 + optional substitute)
└── Drivers (by Class: Junior, Standard, Heavy)
```

**Critical:** Driver `class` must be consistent between:
- `drivers` table → base classification
- `event_entries.class` → may differ per event if reclassified
- Points calculations filter and award based on class

## Data Flow Architecture

### 1. **Mutations: Server Actions Pattern**

All database mutations happen in **server actions** (`'use server'` files):

- `src/app/drivers/actions.ts` → Driver CRUD
- `src/app/drivers/team-actions.ts` → Team CRUD  
- `src/app/races/actions.ts` → Event CRUD
- `src/app/races/[eventId]/actions.ts` → Session & Result CRUD
- `src/app/standings/actions.ts` → Read-only, derives data from sessions

**Pattern:** Each mutation calls `revalidatePath()` to invalidate Next.js caches:

```typescript
// After insert/update/delete:
revalidatePath('/drivers');        // Re-render Driver page
revalidatePath('/races');          // Re-render Event list
revalidatePath('/standings');      // Re-render Standings (affected by results)
```

### 2. **Client Components: UI Layer**

Client components (`'use client'`) do THREE things:

1. **Fetch data** on mount via server actions
2. **Manage UI state** (modals, tabs, forms, loading) with `useState`
3. **Call server actions** to mutate data
4. **Receive updates** via `revalidatePath` re-render

**Example flow:**

```
User clicks "Add Driver" 
  → Dialog opens (setState)
  → Form submitted
  → Call serverAction(data)  
  → Mutation in DB + revalidatePath('/drivers')
  → Component re-renders
  → New driver appears in table
```

### 3. **Points Calculation: Pure Logic Engine**

Points are **never stored** in `session_results`—they're **calculated** on-the-fly:

- **Heat Sessions:** Position → points (1st=13, 2nd=11, etc.) per group
- **Final Sessions:** Class-rank → points (1st=35, 2nd=31, etc.) across all classes
- **Fastest Lap Bonus:** +2 points (applied at session level)
- **Penalties:** `penalty_note` field can reduce points; manually edited
- **Exclusions:** `is_excluded_from_points=true` → 0 points for that event

**Calculation happens in:**

```
src/lib/points.ts → calculateEventPoints()
  ↓ Called by ↓
src/app/standings/actions.ts → getSeasonStandings()
  ↓ Consumed by ↓
src/app/standings/page.tsx → Displays standings table
```

## Component Interaction Patterns

### Pattern A: Form → Server Action → List Update

**When:** Drivers page, adding/editing driver

```
DriverFormDialog.tsx (client)
  ├─ Form state managed locally
  ├─ Call createDriver() / updateDriver()
  │  (server action in drivers/actions.ts)
  └─ Server action:
      ├─ Insert/update in Supabase
      ├─ Call revalidatePath('/drivers')
      └─ Return updated driver

DriversPage.tsx (client)
  ├─ useState([drivers]) on mount
  ├─ Render table with drivers
  └─ On driver page re-render:
      └─ Fetch fresh drivers via getDrivers() in useEffect
      └─ setState(newDrivers)
      └─ Table updates instantly
```

### Pattern B: Event Results → Points Cascade → Standings Update

**When:** Entering race results for an event

```
EventResults page (client)
  ├─ Display sessions + results input
  ├─ Call addSessionResult() 
  │  (server action in races/[eventId]/actions.ts)
  └─ Server action:
      ├─ Insert result into session_results
      ├─ revalidatePath(`/races/[eventId]`)
      ├─ revalidatePath(`/standings`)
      └─ Return result

Standings page (client) [if user is viewing it]
  ├─ Component cached by Next.js
  ├─ revalidatePath fires → cache invalidated
  ├─ Page re-fetches getSeasonStandings()
  │  ├─ Queries all events + sessions + results
  │  ├─ Calls calculateEventPoints()
  │  └─ Returns new standings with updated point totals
  └─ Standings table re-renders with new totals
```

### Pattern C: Class Changes → Event Entry Update → Standings Recalculation

**When:** Driver reclassified mid-season or event

```
Driver promoted from Junior → Standard
  ├─ Update drivers.class = 'Standard'
  └─ revalidatePath('/standings')  // Only standings affected

Event Entry Setup page
  ├─ For this specific event, assign class
  ├─ Call updateEventEntry({ driver_id, class: 'Standard' })
  └─ Server action:
      ├─ Update event_entries.class (can differ from drivers.class)
      ├─ revalidatePath(`/races/[eventId]`)
      ├─ revalidatePath(`/standings`)
      └─ Return entry

Standings recalculation
  ├─ Queries event_entries.class (not drivers.class)
  ├─ Groups results by class
  ├─ Awards points per class rank in finals
  └─ New standings reflect updated classification
```

## Key Behaviors & Constraints

### Session Type → Points Formula

| Session Type | Scoring | Handled By |
|--------------|---------|-----------|
| `quali_1`, `quali_2` | Position-based (no points stored; qualifications don't score) | Race page for display only |
| `heat` | Position within group → 13–1 pts | calculateEventPoints() |
| `final` | Class-rank across all classes → 35–1 pts | calculateEventPoints() |

### Driver Class Filter

- **Junior, Standard, Heavy:** Mutually exclusive per driver/event
- In finals, drivers compete **within their class** for ranking
- Points awarded **by class rank**, not global rank
- `event_entries.is_excluded_from_points` skips that driver for the event

### Kart Management

- `events.max_karts` → max drivers per session group (usually 9)
- `available_kart_numbers` → list of available karts for the event (e.g., `[1,2,3,4,5,6,7,8,9]`)
- Session participants assigned `kart_number` from available pool
- If kart is broken/removed → update `available_kart_numbers`, next group generation uses new list

### Disqualification (DSQ) Logic

- **Session-level DSQ:** `penalty_note = 'DSQ'` + manually set position to last
  - Points awarded based on last place in that session
  - Other sessions unaffected
  
- **Event-level DSQ (future feature):** Mark `is_excluded_from_points = true`
  - Driver gets 0 points for entire event
  - Next-ranked driver in their class inherits the position's points

## Making Changes: Common Tasks

### Adding a New Session Type

1. Update `src/types/database.ts` → `SessionType` union
2. Update `supabase/schema.sql` → `sessions.type` CHECK constraint
3. Add scoring logic to `src/lib/points.ts` → `calculateEventPoints()`
4. Update race page to handle new session in UI

### Modifying Point Awards

1. Edit `src/lib/points.ts` → `HEAT_POINTS` or `FINAL_POINTS`
2. Call `revalidatePath('/standings')` to recalculate
3. No DB changes needed (points are derived)

### Adding a Driver Property

1. Update `src/types/database.ts` → `Driver` type
2. Update `supabase/schema.sql` → `drivers` table
3. Update form schemas in `src/app/drivers/page.tsx`
4. Update server actions if needed

### Debugging: Why Didn't Standings Update?

1. **Check revalidatePath:** Did the mutation call it for `/standings`?
2. **Check points calculation:** Is the query in `getSeasonStandings()` filtering events correctly?
3. **Check session results:** Are results being inserted into `session_results` table?
4. **Check event status:** Only `completed` or `published` events score—drafts ignored

## File Structure Reference

```
src/
├── app/
│   ├── drivers/
│   │   ├── page.tsx         [Client] Driver+Team UI
│   │   ├── actions.ts       [Server] Driver CRUD
│   │   └── team-actions.ts  [Server] Team CRUD
│   ├── races/
│   │   ├── page.tsx         [Client] Event list
│   │   ├── actions.ts       [Server] Event CRUD
│   │   └── [eventId]/
│   │       ├── page.tsx     [Client] Event detail / Sessions
│   │       ├── actions.ts   [Server] Session/Result CRUD
│   │       └── race-utils.ts [Pure] Group generation logic
│   └── standings/
│       ├── page.tsx         [Client] Display standings
│       └── actions.ts       [Server] Calculate standings (read-only)
├── lib/
│   ├── points.ts            [Pure] Points calculation engine
│   ├── utils.ts             [Pure] Helpers (date, time parsing)
│   └── supabase/
│       ├── server.ts        [Server] Supabase client (app router)
│       └── client.ts        [Client] Supabase client (browser)
├── types/
│   ├── database.ts          [Types] DB row types
│   └── index.ts             [Types] Domain types
└── ai/
    ├── genkit.ts            [Config] Genkit + Google AI
    └── flows/               [Server] AI flow definitions
```

## Testing Component Interactions

To verify a change cascades correctly:

1. **Make the mutation** (e.g., add session result)
2. **Open DevTools** → Network tab
3. **Watch for revalidatePath calls** in server logs
4. **Refresh standings page** (should reflect new data immediately)
5. **Check points calculation** (open DevTools console, verify math)

## Performance Notes

- **Standings queries are expensive:** Joins across events × sessions × results
  - Cached by `revalidatePath` granularity
  - Only revalidate `/standings` when necessary (not on every driver change)
  
- **Session generation:** Groups assigned based on qualifying times
  - `race-utils.ts` contains group distribution logic
  - After kart changes, regenerate groups to reassign karts

- **Points are never stored:** Calculated on-demand
  - Fast for small datasets, slower as seasons grow
  - Consider caching if standings queries become slow
