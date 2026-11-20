# Labour manpower deployed vs target: spec + implementation plan

Date: 2026-11-20 · Owner: Bharat Harikumar

> **For agentic workers:** Implement inline with superpowers:executing-plans + TDD (user chose: same session, no subagents). Steps use checkbox (`- [ ]`) syntax.

---

# Part 1: Spec

## Why
The client wants to see how far along a mason/helper work type is (Plastering, Brick work) by
comparing the masons and helpers deployed so far with the number allotted.
Example: "100 allotted, 50 used means about half done."

## What gets built
- **A progress row** on the labour category page `/app/sites/[id]/operations/labour/[category]`
  (the "Back to labour" screen). It sits as a full-width row at the bottom of the header card, under the
  existing title / Entries / ₹ block:
  - With a target: `Masons deployed: 13 / 60 (22%)` and `Helpers deployed: 7 / 40 (18%)`
  - Without a target: `Masons deployed: 13` and `Helpers deployed: 7`
  - A grey note: `counted per day, all dates`
  - A `Set target` button (or `Edit target` once a target exists) opens two number inputs (Mason target, Helper target) with Save and Cancel.
- **Shown only** when `type === "labour"` and `isSplitLabourWorkType(category)` (Plastering, Brick work, Brickwork).
- **Deployed count** = `SUM(mason_count)` and `SUM(helper_count)` over **all** labour entries for that
  site + exact `work_type`, computed in SQL. These are person-days (2 masons × 6 days = 12).
  The count deliberately **ignores** the page's date/stage filters, search and the 200-row list cap,
  because it measures progress against the whole allotment.
- **Target**: separate whole numbers 0–100000 for masons and for helpers, one pair per site + work type.
  Either one may be blank (null). A blank target shows that role without "/ N".
- **Who can set it**: anyone who can write entries for the site (Admin, or the site's Supervisor), via `assertSiteWritable`.
- **Over 100%** is allowed and shown as is (`65 / 60 (108%)`). A target of 0 shows `0 / 0` with no %.

## Decisions made with the user
Totals plus a planned target, split into masons and helpers. The label is "Masons deployed" / "Helpers deployed".
Edited on the category page. Admins and Supervisors can edit. Only mason/helper work types get this.
Stored in a new `labour_targets` table.

## Approaches considered
- **New `labour_targets` table** (picked): easy to validate, one row per site + work type.
- JSON blob on `sites`: no new table, but hard to validate, and renaming a work type would orphan the data.

## Non-goals
Tracking individual workers. Targets for single people-count types. A ₹ budget per work type.
Showing targets anywhere else (stage summary, analytics, site export beyond the backup registry).

## Known limits
- A renamed work type leaves its old target row orphaned. It is simply not shown.
- Two people editing at the same moment: last save wins (atomic upsert, no lost row). Acceptable for a planning number.

---

# Part 2: Audit (principal-engineer review of the first plan, each point checked against the code)

| # | Angle | Finding | Checked how | Change |
|---|---|---|---|---|
| A1 | Logic | v1 counted heads client-side from the loaded entries. The page loads at most **200** rows (`limit: 200` in `[category]/page.tsx`), and the query applies the date/stage filters. Progress vs. a target would be **wrong** when filtered ("4 / 60" for last week) or for more than 200 entries. | Read `page.tsx` and `getEntriesBySite` | Count in SQL over all entries for site + work type, independent of filters. Note says "all dates". |
| A2 | Existing features | Every table in `schema.ts` must be in `lib/export/tableRegistry.ts`. `tableRegistry.test.ts` fails otherwise, and backup/export/restore read the registry. **If code deploys before the table exists in prod, backup and export break.** | Read the registry header comment and `scripts/db-apply.mts` | Add `labour_targets` at level 2 (after `sites`). Apply the SQL to prod **before** merging/deploying. |
| A3 | Phone layout | The right column of the header is narrow (`flex justify-between`). Two "Masons deployed: 13 / 60 (22%)" lines plus a button would crush the title on a 360px screen. | Read `CategoryDetailPageClient.tsx` header markup | Full-width row under the header block instead. |
| A4 | DB / perf | v1 used two queries (sums plus target). | — | One query: aggregate over `labour_entries` with two scalar subselects on the target's unique index. Always returns one row. Filter `site_id` uses the existing `labour_entries_site_id_date_idx` prefix; rows per site are small, so no new index. |
| A5 | Consistency / DRY | The page's category filter is `eq(labourEntries.workType, value)` (exact match, `lib/entryTypes/server.ts:92`). | Read code | Key the target and the sums by the same exact string. No new normalisation helper. Reuse `isSplitLabourWorkType`, `assertSiteWritable`, `parseJsonBody`/`validateBody`, `handleDbError`. |
| A6 | Over-engineering | Removed the client-side `buildManpowerTotals` (no longer needed after A1). No GET route: the server page reads the progress directly. No optimistic locking. | — | Smaller plan. |
| A7 | Security | Auth: `assertSiteWritable` covers 401, archived **and soft-deleted** site (404), and other-site supervisor (403). Input: zod int 0–100000 or null, `workType` must be a split type, max 100 chars. A DB `CHECK` mirrors the range (defence in depth). SQL is parameterised (`sql` tag). CSRF: Supabase SSR cookies are SameSite=Lax and the body is JSON (preflighted), the same posture as every existing write route. | Read the guards | No new risk. |
| A8 | Data integrity | `updated_by` FK to `user_profiles`. | Prod code never hard-deletes users (only tests) | Nullable with `ON DELETE SET NULL`, so it can never block a user cleanup. |
| A9 | Race | Concurrent saves. | — | `INSERT … ON CONFLICT (site_id, work_type) DO UPDATE` is atomic. Last write wins. Documented. |
| A10 | Edge | Missing vs null target keys in the body. | — | Both keys required, each `number | null`. The client always sends both (empty input becomes null). |

Ruled out after checking: soft-deleted labour entries (labour has no `is_deleted` column, so deletes are hard and the SUM is correct). `work_stage` missing in prod (it exists, so the earlier note was wrong and has been removed). Amount masking (counts are not money).

---

# Part 3: Implementation plan

**Goal:** Show masons/helpers deployed (all dates) vs an editable target on the labour category page.

**Architecture:** New `labour_targets` table. One read query `getLabourProgress` feeds the server page.
One `PUT /api/sites/[id]/labour-target` saves. The client component `ManpowerProgress` renders and edits.

**Tech Stack:** Next.js App Router, Drizzle, Postgres (Supabase), zod, vitest.

## Global Constraints
- Never `npm run db:migrate`. Apply with `npm run db:apply -- lib/db/migrations/0027_labour_targets.sql`, **before** deploy, and only after the user approves.
- Exact copy: `Masons deployed`, `Helpers deployed`, `counted per day, all dates`, `Set target`, `Edit target`, `Mason target`, `Helper target`, `Save`, `Cancel`.
- Targets: integer 0–100000, or null.
- No `describeDb` tests (the shared prod DB). Unit and route tests use mocks.

## Review Focus
1. Null mason/helper counts sum as 0 (SQL `coalesce`). Verified by a read-only prod query in Task 5.
2. Target 0: `0 / 0` with no %. Task 1 test.
3. Non-split work type in the PUT gives 400. Task 3 test.
4. Other-site supervisor gives 403, archived site 404. Task 3 tests.
5. `" Brick work "` is trimmed to `"Brick work"` before the upsert. Task 3 test.

### Task 1: `formatDeployed` (pure)
**Files:** Modify `components/operations/categoryView.ts`. Test `components/operations/categoryView.test.ts`.
**Produces:** `formatDeployed(deployed: number, target: number | null): string`
- [ ] Test: `(13,null)` gives `"13"`. `(13,60)` gives `"13 / 60 (22%)"`. `(65,60)` gives `"65 / 60 (108%)"`. `(0,0)` gives `"0 / 0"`.
- [ ] Run, confirm FAIL. Implement with `Math.round`. Run, confirm PASS. Commit.

### Task 2: Table, migration, registry, queries
**Files:** Modify `lib/db/schema.ts` and `lib/export/tableRegistry.ts`. Create `lib/db/migrations/0027_labour_targets.sql` and `lib/db/queries/labourTargets.ts`.
**Produces:**
- `labourTargets` table: `id identityId()`, `site_id uuid not null → sites cascade`, `work_type varchar(100) not null`,
  `mason_target int`, `helper_target int`, `updated_by uuid → user_profiles set null`, `updated_at timestamp not null default now()`.
  Unique index `labour_targets_site_work_type_uq (site_id, work_type)`.
- `type LabourTarget = { masonTarget: number | null; helperTarget: number | null }`
- `type LabourProgress = LabourTarget & { masons: number; helpers: number }`
- `getLabourProgress(siteId: string, workType: string): Promise<LabourProgress>` (single SQL, A4)
- `upsertLabourTarget(input: { siteId; workType; masonTarget; helperTarget; userId }): Promise<LabourTarget>`
- [ ] The existing `tableRegistry.test.ts` fails after the schema change (red). Add the registry entry (green).
- [ ] SQL file: 0026 style, `BEGIN/COMMIT`, `IF NOT EXISTS`, both range CHECKs.
- [ ] `npx tsc --noEmit`. Commit.

### Task 3: Schema + PUT route
**Files:** Modify `lib/validation/schemas.ts`. Create `app/api/sites/[id]/labour-target/route.ts` and `route.test.ts`.
**Produces:** `labourTargetSchema` = `{ workType: trim 1–100, refined isSplitLabourWorkType, message "Targets are only supported for Plastering and Brickwork"; masonTarget, helperTarget: int 0–100000 nullable, required }`.
`PUT` returns `{ target: LabourTarget }`.
- [ ] Tests (mock `siteWritable` and `labourTargets`): 403 and 404 pass through with no upsert. Shuttering gives 400. -1 / 1.5 / 100001 / missing key give 400. `" Brick work "` gives 200 and the upsert is called with the exact trimmed args and `userId: "u1"`.
- [ ] Red, then implement (parse, validate, assertSiteWritable, upsert inside try/handleDbError), then green. Commit.

### Task 4: UI
**Files:** Create `components/operations/ManpowerProgress.tsx`. Modify `[category]/page.tsx` and `CategoryDetailPageClient.tsx`.
**Produces:** `<ManpowerProgress siteId workType initial: LabourProgress />`
- [ ] `page.tsx`: when labour + split, run `getLabourProgress` in `Promise.all` with the entries query. Pass `manpower` (or `null`).
- [ ] Client: render a full-width row inside the header card under the existing flex row, only when `manpower` is set.
- [ ] Component: read view and edit view as in the spec. Inputs are `type=number inputMode=numeric min=0 step=1`, `text-base`, with labels. Buttons are ≥ 44px tall. Save is disabled while saving. Show the API error inline. On success, merge the returned target into state.
- [ ] Render test via `renderToStaticMarkup` (as in `entryFormat.test.ts`): with a target, it contains `Masons deployed: 13 / 60 (22%)` and `Edit target`. Without one, it contains `Set target`.
- [ ] `npx tsc --noEmit`, the vitest suites, and lint. Commit.

### Task 5: Verify
- [ ] Read-only prod check of the sum SQL (without the target subselects) for Satheesh/Plastering gives 13 / 7.
- [ ] Full suite: `npx vitest run --no-file-parallelism --testTimeout=30000`.
- [ ] Ask the user, then `npm run db:apply` **before** deploy. Afterwards check `\d labour_targets`.
- [ ] Run the app at 360px. Check Plastering, Shuttering (no row), and a long category name.
