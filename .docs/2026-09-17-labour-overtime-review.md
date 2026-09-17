# Review: Labour Overtime (OT) + Material Quantity Totals — branch `ot-newfeatures`

**Date:** 2026-09-17
**Status:** Revised & verified 2026-09-17 (not yet merged)
**Original author:** Govindparameswar — commit `9f21d94` ("ot-new")
**Revision by:** Bharat Harikumar (tech lead)

> **Revision history**
> - v1 (2026-09-16, Govindparameswar): labour overtime as people × hours × rate, plus a material quantity chip on the category page.
> - v2 (2026-09-17, Bharat Harikumar): reviewed; OT reworked to a single lump-sum amount per the client's request; blockers and review findings fixed test-first; migration 0026 applied to production.

---

## 1. Problem statement

1. **Overtime on labour.** Supervisors pay crews extra for overtime and had nowhere to log it, so labour spend was under-reported.
   **Client requirement:** one "OT amount" box. The supervisor enters the total extra paid. On Mason/Helper work (Plastering, Brickwork) that one amount covers masons and helpers together. OT must count toward every labour spend total.
2. **Material quantity at a glance.** The material category page showed entry count and spend, but not how much material was logged.

## 2. How it was originally implemented (v1)

- **DB** — migration `0026_add_labour_overtime.sql` adds 4 nullable columns to `labour_entries`: `ot_people_count`, `ot_hours`, `ot_rate`, `ot_total_amount`.
- **Server** — Zod required all three of people / hours / rate together. The server computed `ot_total_amount = people × hours × rate`. `labourSpend()` and the shared SQL spend expression added the OT total to labour cost.
- **UI** — an "Enable OT" toggle with three inputs and a live `people × hours × rate` preview. The entry list showed an OT breakdown line.
- **Material** — `buildMaterialQuantitySummary()` summed quantity. It showed `"MIXED UNITS"` when units differed.

## 3. Review findings on v1

### Blockers
| # | Finding |
|---|---|
| B1 | Migration never applied → **32 existing tests failed** (0 on `main`). Deploying code before the migration would 500 the labour edit page and backups for **all** entries. |
| B2 | The SQL/TS labour-spend **parity test was switched off** (`describeOtDb` skipped it when the columns were missing). It also opened a raw DB connection at import time. |
| B3 | Limits allowed 10,000 × 24 h × ₹10,00,000 = ₹2.4×10¹¹, which overflows `numeric(12,2)` → unhandled **500**. |
| B4 | OT was read via `to_jsonb(row)->>'ot_total_amount'` in 6 hot aggregate queries. That serializes every row to JSON to read one column. It gave no real protection either, since `schema.ts` already required the columns. |

### Should fix
- Design mismatch with the client: separate people / hours / rate, and one blended rate for Mason + Helper.
- Same limits hardcoded in 3 places, although `ENTRY_FIELD_CONSTRAINTS` exists for this.
- The OT form duplicated input markup 3× instead of reusing `FieldRow`.
- The OT check lived inside `evaluateLabourSplit` (the split-labour function).
- Typing in **any** field cleared an OT error.
- Turning OT off on a saved entry wiped the amount with no confirmation.
- The OT preview showed "0 people × 0 hrs × ₹0" before any input.
- The material chip hid all numbers on `"MIXED UNITS"`, silently dropped zero quantities, used an order-dependent unit label, and had no caption.
- Unrelated generated files committed (`public/sw.js`, `next-env.d.ts`); migration missing from `meta/_journal.json`.
- OT was not visible as its own figure on any summary.

### Second review pass (fresh code-review run on all changed files)
It re-confirmed the findings above and added nothing that blocks. Minor notes:
- The labour field registry is static code, so the "OT form anchored to a field name" risk is low. The anchor is kept but now in one place for both layouts.
- `mergeLabourEntry` ignores OT, but it has no call sites (dead code). No action.
- Concurrent edits: PATCH is read-then-write with no version check, so two simultaneous saves → last write wins. This predates the branch and is **not fixed here**.

## 4. Revision (v2) — changes made

All changes were written test-first: failing test → fix → green.

### Overtime — single lump-sum amount
- **Input** — one `otTotalAmount`, ₹0.01 – ₹99,99,999.99, max 2 decimals. Bounds live in `ENTRY_FIELD_CONSTRAINTS.otTotalAmount` and are shared by Zod, the form field and client validation.
- **Reserved columns** — `ot_people_count` / `ot_hours` / `ot_rate` are kept in the table but always NULL. They are absent from the Zod schemas, so they are stripped from any request and can never be written. (Stripped rather than rejected, so an old cached client can't break a save.)
- **Create** — saves the typed amount. **Edit** — the amount is saved as sent, `null` clears it, and omitting it leaves it unchanged. The people × hours × rate maths (`calculateOtAmount`) and the 3-field pairing checks were removed. `evaluateLabourSplit` is back to its `main` version.
- **Form** — "Enable OT" shows one OT Amount box (the standard `FieldRow`) with a hint:
  - Mason/Helper work: *"Total overtime paid for all masons and helpers on this entry."*
  - Other labour: *"Total overtime paid for all workers on this entry."*
  - Turning OT off on a saved entry asks *"Remove overtime from this entry?"*
  - An OT error only clears when the OT box itself is edited.
- **Entry list** — `OT: ₹X`, or `OT (masons + helpers): ₹X` on split work. OT is included in the entry total.
- **Summaries** — the site card shows *"incl. OT ₹X"* under all-time labour spend. The stage breakdown shows *"• Overtime (included) ₹X"* per work type. Both come from one extra `sum()` inside existing queries, with no extra round trips.

### Blocker fixes
- **B1** — migration applied to production (log below). The suite is green.
- **B2** — `describeOtDb` and the import-time connection removed; the parity suite runs again, with OT fixtures.
- **B3** — cap on the amount (Zod + client), plus `handleDbError` now maps Postgres `22003` (numeric overflow) to a 400 *"Value is too large"* as a backstop.
- **B4** — plain `ot_total_amount` column reads. New `labourOtSumExpr` sits next to `labourSpendSumExpr` so the two can't drift.

### Material quantity totals
- `buildMaterialQuantityTotals()` returns a per-unit list, and `formatQuantityTotals()` renders it: `120.00 BAG · 5.00 KG` (top 3, then `+N more`).
- Unit-less entries get their own group, zero quantities count, and unit labels no longer depend on row order.
- Captioned "Total qty". Committed separately from the OT work.

### Hygiene
- `public/sw.js` and `next-env.d.ts` restored to `main`.
- `0026_add_labour_overtime` added to `meta/_journal.json`.
- `schema.ts` comment documents the reserved columns.

## 5. Files affected

| Area | Files |
|---|---|
| DB | `lib/db/migrations/0026_add_labour_overtime.sql`, `lib/db/migrations/meta/_journal.json`, `lib/db/schema.ts` |
| Validation / constraints | `lib/validation/schemas.ts`, `lib/entryTypes/constraints.ts`, `lib/entryTypes/server.ts` |
| Spend + queries | `lib/services/labourSpend.ts`, `lib/db/queries/labourSpendSql.ts`, `lib/db/queries/entries.ts`, `lib/db/queries/stageSummary.ts`, `lib/db/queries/search.ts`, `lib/db/queries/sites.ts` |
| API / errors | `app/api/entries/labour/route.ts`, `lib/errors/db.ts` |
| Form | `components/logs/EntryForm.tsx`, `components/logs/EntryForm.validate.ts`, `components/logs/labourOvertime.ts` *(new)*, `components/logs/mapEntryToFormValues.ts` |
| Display | `components/operations/entryFormat.tsx`, `components/operations/categoryView.ts`, `app/app/sites/[id]/SiteDetailPageClient.tsx`, `app/app/sites/[id]/stages/StageSummaryClient.tsx`, `app/app/sites/[id]/operations/[type]/[category]/CategoryDetailPageClient.tsx` |
| Tests | `labourOvertime.test.ts` *(new)*, `lib/errors/db.test.ts` *(new)*, and the colocated `*.test.ts` of every file above |

`lib/services/entries.ts` ends identical to `main`.

## 6. Production DB operation log (2026-09-17)

There is only one database (production), and local development uses it too.

1. **Read-only check:** no `ot_*` columns; 172 `labour_entries`, 24 `sites`.
2. **Backup:** `pg_dump --schema=public` → `~/siteops-backups/2026-09-17-before-0026.sql` (27 tables).
3. **Apply:** `npm run db:apply -- lib/db/migrations/0026_add_labour_overtime.sql` → `BEGIN; ALTER ×4; COMMIT`.
4. **Post-check:** 4 columns present; still 172 labour entries and 24 sites; every OT value NULL. The test runs use rolled-back transactions and left no data behind.

**Rollback (only if needed, before any OT is entered):**
```sql
BEGIN;
ALTER TABLE labour_entries DROP COLUMN IF EXISTS ot_total_amount, DROP COLUMN IF EXISTS ot_rate,
  DROP COLUMN IF EXISTS ot_hours, DROP COLUMN IF EXISTS ot_people_count;
COMMIT;
```

## 7. Verification

- `npm run lint` (tsc): clean.
- `npx vitest --run --no-file-parallelism --testTimeout=30000`: **922 passed, 0 failed**, 12 skipped. The skips are the env-gated tools integration suite, same as `main`.
- DB tests must run with `--no-file-parallelism`. In parallel, rolled-back transactions against the shared production DB contend and time out at 30 s. This is not a code failure.
- **Not done:** manual click-through in a browser. The site card and stage-breakdown OT lines have no component test (these pages have no component test setup); their data is covered by query tests.

## 8. Open items

- Manual QA of the OT toggle, the confirmation dialog and the summaries before merge.
- Concurrent-edit protection for entry PATCH (pre-existing; separate ticket).
- If a per-head OT breakdown is ever needed, the reserved columns are already in place.
