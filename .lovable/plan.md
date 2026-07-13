# Create Match Redesign + Rich Demo Mode

## Goals

1. A first-time coach starts a match in < 20 seconds without leaving the page.
2. No database terminology ("External Team", "Search Team"). Human language only.
3. Demo Academy behaves like a mature academy — every list is populated, every search returns results.

---

## Part 1 — Create Match Flow (`src/routes/match-center.create.tsx`)

Replace the current 1093-line Quick/Advanced dual layout with one linear form.

### Layout (top → bottom)

```text
1. Match Type       [Practice] [Friendly] [League] [Tournament]
2. Format           [T10] [T20] [30] [40] [50] [Test]  ← sets overs
3. Team A
   ┌────────────────────────────────────────────┐
   │ ○ Use existing team                        │
   │ ○ Create team for this match               │
   │ ○ Guest team                               │
   └────────────────────────────────────────────┘
   (contextual body renders under the chosen option)
4. Team B  (same three-option picker)
5. ▸ Advanced match settings (collapsible)
      Ground · Pitch · Toss · Umpires · Scorers · Streaming · Notes
6. Summary card
   ┌────────────────────────────────────────────┐
   │ Practice · T20 · 20 overs                  │
   │ Sai U16   vs   Sky Cricket Academy         │
   │ 11 vs 11 · Ready to start                  │
   │ [ Start Match ]                            │
   └────────────────────────────────────────────┘
```

Remove the Quick / Advanced toggle entirely; everything is visible, advanced settings live only in the one collapsible.

### The three team-source options (new `TeamSourcePicker` component)

- **Use existing team** — team combobox (searchable). On select, load the team's saved XI into an editable player list. Coach can remove/add players inline using the same academy-player search that already exists (`listStudentsSearch`).
- **Create team for this match** — text input for team name + inline academy-player search. Selected players append to a chips list. Persisted as a real academy team on submit (so it appears next time under "Use existing team"). Optional: "Save this team for later" toggle (default on).
- **Guest team** — text input for opponent name + a "Add player" row that just types a name and hits Enter. Chips list of temporary players. Persisted as an `is_external` team; players stored as external squad names (existing `createExternalTeam` + name-only squad rows).

All three options collapse into a single `<TeamPanel side="A" | "B" />` component that owns its own state and emits a normalised `{ teamId, squad }` to the parent.

### Removed / renamed strings

- "External Team" → not shown anywhere in copy. Underlying `is_external` flag stays.
- "Search Team" empty box → replaced by the three-option picker with a real placeholder ("Search academy teams…").
- "Quick match" / "Advanced" tabs → deleted. Advanced settings live only in one `<Collapsible>`.

### Interaction rules

- No modals for team creation. Everything inline.
- Empty search returns *suggested teams* (top 5 recent) instead of "No teams found".
- Player search shows a "+ Add guest player 'name'" row when zero matches, only inside the Guest team panel.
- Advanced panel starts collapsed; a small badge shows count of filled-in fields.
- Start Match button is disabled with a plain reason string ("Add at least 2 players to Team A") — never a silent disable.

---

## Part 2 — Demo Academy Enrichment (`src/lib/mc-demo/generate.ts`)

Extend the existing deterministic generator (no DB writes; overlay pattern is already there).

### Named team roster (replaces the current random names)

Academy teams — always present:
- Sai Sports Academy U12
- Sai Sports Academy U14
- Sai Sports Academy U16
- Sai Sports Academy U19
- Senior Team
- Girls Team

Opponent teams (`is_external: true`):
- Sky Cricket Academy
- Royal Cricket Club
- City Cricket Academy
- Lions CC
- Warriors CC

Each team gets 14–18 players with realistic Indian names (extend the existing FIRST/LAST pools, ensure the 5 example names — Rahul Sharma, Aman Patel, Aryan Singh, Mohit Verma, Rohit Yadav — appear in the U16 squad).

### Other surfaces (already generated deterministically; ensure non-empty)

- Grounds: "Sai Main Ground", "Practice Ground", "Indoor Nets" (add to `GROUNDS` constant).
- Tournaments: "Summer Cup", "Academy League", "Weekend Practice".
- Matches: one upcoming, one in-progress (live), five completed with full ball-event logs (already supported by the simulator in `generate.ts`).
- Statistics / awards / records / leaderboards derive automatically from the ball events via the existing stats engine — nothing extra to seed.

### Search behaviour

- The teams combobox in Create Match uses fuzzy/substring match on team name + on member names (so `rah` matches "Rahul Sharma" → surfaces "U16"). Implemented as a small ranked filter (substring on lowercased strings, then prefix boost, then initials boost — no external dep).
- When the query is empty, show a "Suggested" section (top 5 by recent match participation, falling back to first 5).

---

## Files touched

- `src/routes/match-center.create.tsx` — rewrite as the new linear flow.
- `src/components/match-center/create-match/` (new folder):
  - `TeamPanel.tsx` — the three-option picker + squad editor.
  - `PlayerChips.tsx` — reusable chips list.
  - `TeamCombobox.tsx` — searchable team picker with fuzzy match + suggested fallback.
  - `PlayerCombobox.tsx` — searchable academy-player picker with optional guest-add row.
  - `SummaryCard.tsx` — the bottom recap + Start button.
- `src/lib/mc-matches.ts` — small helper additions if needed (e.g. a `createAcademyTeamWithSquad` helper that today lives inline in the route).
- `src/lib/mc-demo/generate.ts` — named team roster + expanded name pool + grounds/tournaments constants.

No DB migrations. No changes to the scoring engine, statistics engine, ball-event schema, or existing API surface. Demo mode continues to work purely through the existing in-memory overlay.

## Out of scope for this pass

- Match reschedule / edit flow.
- Persisting "guest players" as real athlete profiles (they remain squad-name-only rows).
- Live search on remote opponent teams from other academies.
- Design-system token changes.

## Validation

- Manual: on a fresh demo tenant, opening `/match-center/create` shows populated team lists immediately; typing `rah`, `sky`, `u16` returns the expected matches; a full match can be created and "Start Match" navigates to the scorer with 11-v-11 squads.
- `bunx tsgo --noEmit` clean.
- Existing scoring-simulation harness still passes.
