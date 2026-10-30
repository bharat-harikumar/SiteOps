# Company and Site Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Company Tools easy for admins to understand and give admins and supervisors a clear, secure Tools page inside each permitted site.

**Architecture:** Keep company inventory and its existing global endpoints admin-only. Add site-scoped reads and movements using the existing capability/ownership patterns, inventory tables, version counter, movement translator, and transactional assignment engine. Share a single-purpose movement dialog between company and site screens, and extend the existing SWR/PWA handling so successful writes show current balances.

**Tech Stack:** Existing Next.js App Router, React 19, TypeScript, Tailwind CSS, Inter, Lucide, motion/react, Sonner, SWR, Zod, Drizzle/Postgres, Vitest, Playwright, and Serwist. No new package or database migration is planned.

**Date:** 2026-10-31, Asia/Kolkata.

**Source of requirements:** Approved design in the conversation. The user explicitly requested this implementation plan, skipped the separate spec file, and requires approval of this plan before implementation. The user subsequently approved implementation with test-driven development and prohibited changes to the shared production database. Implementation and review are complete; see the verification record below.

---

## 1. Approved behavior and boundaries

### Company Tools

- `/app/tools` and its dashboard entry remain admin-only.
- Replace the four large KPI blocks with a compact, wrapping summary: `28 items total · 9 in godown · 19 at sites`. These are illustrative values, never hardcoded inventory.
- Display `15 tool types` beside the list heading, separately from physical item counts. During search, show `3 matching tool types` without changing the global totals.
- Put search and readable tool rows near the top. Remove the All Tools / By Site tab switch.
- Each row shows its name, secondary category, godown quantity, and quantity at sites. An explicit expand control reveals per-site quantities and links to each site's Tools page.
- `Send to site` opens the send form directly. Show a clear zero-stock explanation when unavailable. Secondary actions: `Add stock`, `Remove damaged / lost stock`, `Movement history`. Keep edit/category management in the existing admin catalog.
- Header: `New tool type`, using the existing creation modal. Stock additions are a separate action on an existing tool; no ambiguous generic `Add Tool` operation.
- Remove the technical `free pool`, `assignments`, and `atomically ledgered` copy. Continue using `Godown`, consistent with the existing domain language.

### Site Tools

- Add a `Tools` card beside All Operations and Work Stages on the site detail page. Show `6 items across 3 tool types`, or `No tools at this site`; link to `/app/sites/[id]/tools`.
- The dedicated page always identifies the current site, lists only its current tool holdings, and has `Receive from godown` as a page action.
- Each tool row offers `Return to godown` and `Transfer to another site`. Both preselect the tool and source site. Receiving preselects the destination site.
- A separate `Movement history` view shows the current site's events, including tools fully returned and no longer in its inventory.
- Supervisors may read and move tools only for sites currently assigned to them. A transfer requires access to both source and destination. Admins can operate across all available sites.
- The receive picker may expose a tool's name/category, available godown quantity, and version. It never returns company totals or other sites' allocations.
- Supervisors cannot create/edit/delete tool types, add/remove company stock, clear history, use the global batch-save API, or browse company inventory/history.
- Movements save immediately; this work introduces no request/approval workflow, receipt acknowledgment, multi-tool batch form, serialized asset tracking, or site-level damage deduction. Damaged/lost stock removal remains the existing godown-only admin action.
- Existing site status semantics remain: `Blocked` and `Completed` do not independently make a site unavailable. Archived or soft-deleted sites cannot receive/move tools. Preserve the existing archive behavior that returns tools to godown, while making its concurrency safe.

### Movement form

- One tool, one action, one save. No Move / Stock / History tabs or nested action accordion.
- Show source, destination, available quantity, integer quantity field with minus/plus controls, optional note, and a plain-language result before the submit button.
- Example: `Return 1 barrel from Kollam Site to Godown`, followed by `Return 1 barrel`.
- No instant Return All. A full return is entered and submitted like a partial return.
- Do not silently clamp, round, or replace invalid quantities. Keep the user's input visible with an inline explanation.
- On success, update the visible balance and show a specific success toast. On a changed balance, preserve the user's choices and ask them to review the refreshed availability before submitting a new intent.

## 2. Findings verified against the current code

1. `lib/tools/applyBatch.ts` already locks each tool `FOR UPDATE`, checks versions, diffs assignments, and writes quantities and ledger rows in one transaction. Reuse this engine.
2. `lib/tools/translate.ts` filters out non-positive source assignments before the end-state validator sees them. A read-only local invocation demonstrated that returning 5 from a site holding 2 removes the 2 rather than rejecting 5. Transferring 5 from that site can add 5 at the destination while removing only 2 at the source, silently consuming godown stock. A nonexistent transfer source can similarly consume godown stock. Validate the action against the locked source before translating.
3. `app/api/tools/[id]/move/route.ts` returns HTTP 200 for `status: conflict` and `status: invalid`. `ToolDrawer` checks only the HTTP envelope's `ok`, so those results currently produce success toasts. Normalize the single-movement route to actual 409/400 errors; preserve the separate batch API's documented mixed-result contract.
4. The move route reads before entering the engine transaction and accepts no client version. The existing optimistic check protects overlapping server snapshots, but a repeated request can read a new version and apply again. Require the form's displayed `expectedVersion`.
5. `lib/tools/siteLifecycle.ts` reads assignments without first locking their tools; a site archive or deletion can race a movement. Site availability checks currently do not lock site ownership/lifecycle rows. Coordinate these writers rather than merely adding frontend guards.
6. The service worker caches nearly every GET `/api/*` with stale-while-revalidate. A normal SWR refresh can therefore return stale inventory. Tool reads must bypass that persistent cache.
7. All five existing `tool:*` / `tool_category:*` capabilities are admin-only. Granting their broad read/assign capabilities to supervisors would expose global APIs and the legacy end-state batch writer. Introduce narrowly scoped capabilities instead.
8. `ToolAddModal` currently floors/clamps opening stock and exposes internal tool codes in its success toast/category options. Correct those touched surfaces while reusing the modal.
9. Existing tools e2e tests are quarantined or skipped; their old self-service signup path creates real accounts and is no longer supported. They are not evidence of working browser coverage.
10. `vitest.setup.ts` loads `.env.local`. Some other suites enable database tests whenever a URL exists. Full-suite execution must explicitly point to the disposable database; a plain `npm test` against the current local environment is not automatically an isolated unit run.
11. Company list reads fetch tool totals and assignments in separate statements, and dashboard totals/deployed counts are separate parallel queries. Concurrent commits can mix snapshots in the displayed availability. Preserve their DTOs while making each displayed stock calculation read one consistent database snapshot.

No database writes or mutation requests were used to establish these findings.

## 3. Reuse and file responsibilities

| File | Responsibility/change |
|---|---|
| `lib/auth/capabilities.ts` and its test | Add `site_tool:read` and `site_tool:move` for both roles; keep all global tool capabilities admin-only. |
| `lib/tools/contracts.ts` (new) | Client-safe scoped DTOs and movement outcomes; no database imports at runtime. |
| `lib/validation/toolSchemas.ts` and its test | Require expected version for explicit moves; strict site receive/return/transfer bodies; existing limits. |
| `lib/tools/movementRules.ts` and test (new) | Pure source-balance/action validation, before translation. |
| `lib/tools/locking.ts` (new) | Ordered site row locking for movement/batch/lifecycle coordination. |
| `lib/tools/applyBatch.ts` | Extract the existing locked-state reader and transaction body so explicit moves and legacy batch writes share assignment application. Keep `applyOneTool` as a compatible wrapper. |
| `lib/tools/executeMovement.ts` and test (new) | Authorize affected sites under their locks, lock tool, check expected version and source quantity, translate, apply once. |
| `lib/tools/siteLifecycle.ts` | Lock affected tools in stable order and reread their quantities before auto-returning. |
| `lib/tools/siteQuery.ts` and test (new) | Server-filtered holdings, godown choices, summaries, and site movement history. |
| `lib/tools/query.ts` and its existing test | Preserve company query DTOs while reading each availability/summary calculation from a consistent database snapshot. |
| `lib/tools/siteAccess.ts` and test (new) | Fresh site availability/ownership checks, using `checkOwnership` and capability guards; no cached authorization. |
| `app/api/sites/[id]/tools/route.ts` (new) | GET scoped holdings and POST scoped movement. |
| `app/api/sites/[id]/tools/receive-options/route.ts` (new) | Minimal available-godown picker data after site authorization. |
| `app/api/sites/[id]/tools/movements/route.ts` (new) | Paginated site history, independent of current holdings. |
| `app/api/tools/[id]/move/route.ts` | Admin adapter to the same explicit movement service; correct error statuses. |
| `lib/client/tools.ts` and its test | Keep existing global hooks; add scoped hooks/mutation and shared invalidation. |
| `lib/pwa/toolRequests.ts` and test (new), `app/sw.ts` | Match live tool API/page reads, bypass persistent caching, retire prior cached tool responses. |
| `app/providers.tsx` | Clear tool/site-list SWR entries on account/role changes through a child bridge inside SWRConfig. |
| `components/tools/ToolMovementForm.tsx` (new) | Shared one-action dialog using `ModalShell`; no inventory fetching outside its declared context. |
| `components/tools/movementFormState.ts` and test (new) | Pure input validation and submit-state transitions, including stale/unknown outcomes. |
| `components/tools/ToolHistory.tsx` (new) | Shared read-only timeline presentation; site versus company data is supplied by separate authorized hooks. |
| `components/tools/SiteToolsCard.tsx` (new) | Site detail link and scoped count, using the shared scoped holdings hook. |
| `components/tools/SiteTools.tsx` (new) | Site list/search/history and explicit action orchestration. |
| `app/app/sites/[id]/tools/page.tsx`, `loading.tsx`, `error.tsx` (new) | Site route with existing auth/ownership conventions and retry/loading states. |
| `app/app/sites/[id]/SiteDetailPageClient.tsx` | Mount the Tools card; avoid unrelated edits to the page. |
| `components/tools/ToolsHub.tsx`, `ToolRow.tsx`, `ToolDashboardStrip.tsx`, `ToolAddModal.tsx`, `ToolSummaryTile.tsx` | Simplify the admin UI, separate stock/type actions, and align terminology. |
| `components/tools/ToolDrawer.tsx`, `BySiteView.tsx` | Replace hub callers with the shared form/history. Remove these two files only after `rg` confirms no remaining imports. |
| `components/tools/ToolLedgerDrawer.tsx` | Preserve catalog callers; share history presentation/labels rather than duplicating a third timeline. |
| `lib/tools/integration.test.ts`, `lib/tools/movementConcurrency.integration.test.ts` (new) | Real scratch-database transaction, source-balance, version, and lifecycle tests. |
| `e2e/tools-inventory.spec.ts` and `e2e/fixtures/tools.ts` (new) | Replace obsolete signup flows with provisioned test-environment auth and owned fixtures. |

Keep `AssignmentPanel`, the batch API, catalog manager, code generation, database constraints/indexes, request/error envelopes, `requestJson`, toast helpers, `ModalShell`, focus trap, scroll lock, and back-dismiss behavior. Do not build a parallel inventory store or copy the 700+ line drawer into the site route.

## 4. API and data contracts

Keep the existing company `ToolDTO` for admin responses. Define narrow site DTOs explicitly instead of omitting fields from an already serialized company response.

```ts
// lib/tools/contracts.ts
import type { ToolMovementBody } from "@/lib/validation/toolSchemas";

// A domain action has no client concurrency token. Keep that token separate
// from the translator/rules inputs; preserve the discriminated union.
type WithoutVersion<T> = T extends unknown ? Omit<T, "expectedVersion"> : never;
export type MovementAction = WithoutVersion<ToolMovementBody>;

export type SiteToolItem = {
  toolId: string;
  name: string;
  categoryName: string;
  quantityHere: number;
  version: number;
};

export type SiteToolsData = {
  site: { siteId: string; name: string };
  items: SiteToolItem[];
  itemCount: number;
  toolTypeCount: number;
};

export type ReceiveToolOption = {
  toolId: string;
  name: string;
  categoryName: string;
  availableInGodown: number;
  version: number;
};

export type SiteToolMove = {
  toolId: string;
  expectedVersion: number;
  quantity: number;
  note?: string;
} & (
  | { kind: "receive" }
  | { kind: "return" }
  | { kind: "transfer"; targetSiteId: string }
);

export type SiteToolMoveResult = {
  status: "ok";
  toolId: string;
  version: number;
  quantityHere: number;
};

export type SiteToolMovement = {
  movementId: string;
  toolName: string;
  kind: string;
  quantity: number;
  from: { label: string; href: string | null };
  to: { label: string; href: string | null };
  actorName: string;
  createdAt: string;
  note: string | null;
};
```

| Endpoint | Authorization | Response/operation |
|---|---|---|
| GET `/api/sites/:id/tools` | `site_tool:read` + live site ownership | `SiteToolsData`; no global totals or allocation arrays. |
| GET `/api/sites/:id/tools/receive-options?q=...` | Same | `{ tools: ReceiveToolOption[] }`, only positive availability; q trimmed and limited to 120 characters. No admin categories fetch is needed. |
| GET `/api/sites/:id/tools/movements?toolId=...&limit=50&offset=0` | Same | `{ movements: SiteToolMovement[], limit, offset }`; every row involves the route's site. |
| POST `/api/sites/:id/tools` | `site_tool:move`; both sites locked and owned for transfers | Strict `SiteToolMove` body; derive current source/destination from route; return `SiteToolMoveResult`. |
| GET `/api/sites` | Existing site authorization | Reuse for destination choices; exclude the current site in UI. The server still rechecks destination ownership under lock. |
| POST `/api/tools/:id/move` | Existing admin-only global capability | Existing action vocabulary plus required `expectedVersion`; return `{ status: "ok", tool: ToolDTO }` only for an actual write. |

All new routes use `withApiRoute`, `parseJsonBody`, `validateBody`, `successResponse`, and `errorResponse`. Use `Cache-Control: private, no-store` on tool reads; PWA bypass is also required because a request cache option alone does not bypass a service worker.

The shared service has one input contract and returns internal state only to adapters:

```ts
import type { SessionUser } from "@/lib/auth/session";
import type { FreshTool } from "@/lib/tools/applyBatch";
import type { MovementAction } from "@/lib/tools/contracts";

export type ExecuteMovementInput = {
  toolId: string;
  expectedVersion: number;
  action: MovementAction;
  actor: Pick<SessionUser, "id" | "role">;
};
// executeMovement(input: ExecuteMovementInput): Promise<FreshTool>
// Throw a typed MovementError on failure; HTTP adapters shape safe errors.
```

Define `MovementError` in `executeMovement.ts` with a fixed reason union: `stale_version`, `insufficient_source`, `same_site`, `invalid_quantity`, `total_limit`, `forbidden_site`, `site_unavailable`, `tool_not_found`. Its optional `available` field contains only the explicitly authorized source balance. Adapters map reasons to the statuses below and fixed friendly messages.

Errors: 401 signed out; 403 authenticated but unowned site/forbidden action; 404 missing, archived, or deleted resource; 400 malformed quantity/action, insufficient stock, or same-site transfer; 409 stale version. Site page navigation uses the existing non-disclosing 404 behavior for an unowned site. Error details may contain a fixed reason and the permitted source's available quantity, never `FreshTool`, global allocations, raw database text, or an unauthorized destination name.

New transfers write one `transfer` movement with the actual from/to site, using the existing movement kind/columns. Keep old return+assign history exactly as recorded; do not infer or fabricate historical transfer pairs. The legacy batch path continues writing its existing assignment deltas.

## 5. Transaction and locking contract

### One explicit movement

1. Authenticate before database inventory reads. Validate UUIDs, positive bounded integer quantity, nonnegative integer expected version, and note length (500). Reject undeclared JSON keys.
2. Map the scoped action to the existing movement vocabulary. Compute affected site IDs from the action only; never trust a submitted allocation array or actor ID.
3. Inside a single transaction, acquire affected site row locks **in sorted UUID order**, before acquiring any tool lock. Use `FOR SHARE` so concurrent movements can coexist but site reassignment/archive updates must wait. Reread availability and ownership from those locked rows.
4. Lock the tool `FOR UPDATE` and read its assignments in that transaction. Reject a deleted/missing tool and a mismatched expected version with no writes.
5. Check exact action semantics against this locked state: send <= godown stock; return/transfer <= source site's current holding; source must exist; transfer source != target; remove <= godown stock; add keeps total within the existing 1,000,000 limit.
6. Only then call `translateToPayload`. Apply the assignment diff, optional total change, exact explicit ledger event, actor, and one version increment through the extracted existing engine body in this same transaction.
7. Shape the HTTP result according to the caller's scope. A supervisor never receives the engine's full internal tool state, including on errors.

### Other inventory writers

- Preserve `applyOneTool(payload, actorUserId)` for the admin batch API. Before locking its tool, observe current assignment site IDs, union them with all submitted desired site IDs, sort, and lock the sites. Then lock/read the tool and check the payload version. Before writes, verify all current/desired sites are covered by the acquired site locks; otherwise return conflict without writing. This prevents a pre-lock observation race from leaving an affected site unlocked.
- Extract `loadToolForUpdate(tx, toolId)` and `applyLockedTool(tx, current, payload, actorUserId, explicitMovement?)` from `applyBatch.ts`. Keep existing invariant checks, field-presence semantics, diff application, and fresh-state assembly there. `executeMovement` supplies the optional exact ledger event; batch calls omit it and retain their current ledger behavior. Never start a nested `db.transaction` around `applyOneTool`.
- Site archive/delete already updates/locks its site first. In `returnSiteToolsOnLifecycle`, collect affected tool IDs in sorted order, lock each tool, and reread that site's assignment after acquiring the tool lock. Record exactly that current quantity and bump the tool version once for an actual return. If a concurrent force-delete already removed the assignment, skip it without a duplicate ledger event.
- Keep tool force-delete's existing tool lock. It does not add site assignments or acquire site locks after a tool lock; do not introduce a reverse lock order. All paths touching multiple tools lock them in sorted order.
- A supervisor reassignment is an UPDATE of the same site row, so it serializes with movement's site lock. The movement is either authorized before reassignment commits or rejected after it; a stale client list never authorizes a write.
- Do not automatically retry a conflicted or failed mutation, including a deadlock/connection failure. Roll back, refresh permitted data, and require explicit user action. Reads may retry through the existing UI retry controls.

### Duplicate saves and uncertain outcomes

Require the version the user reviewed, not a new version fetched inside the POST adapter. Two requests carrying that same version can produce at most one mutation. Disable submit using both React state and an immediate ref latch; use `try/finally` to release the latch.

If a response is lost after a commit, show `We couldn't confirm the result. Check the latest stock and history before trying again.` Preserve the submitted version/intent and offer `Check latest stock`. Do not silently obtain a new version and replay it. This deliberately uses the existing version counter instead of claiming an exactly-once request protocol or adding an idempotency table. A successful response followed by a refresh failure is still saved: report `Saved; couldn't refresh the latest stock` and offer a read retry.

## 6. Ordered implementation tasks

Every implementation task is performed only after plan approval. Commit only its owned files. Preserve the pre-existing `next-env.d.ts` modification. A low-impact layout change needs browser verification, not a new test that simply mirrors its markup. Targeted pure/mocked unit commands below must not connect to a database; inspect their imports when adding tests. Full-suite, mutation integration, and authenticated browser checks require explicitly configured disposable infrastructure, as detailed in Task 10.

### Task 1: Establish scoped capabilities and request contracts

**Files:** `lib/auth/capabilities.ts`, `lib/auth/capabilities.test.ts`, `lib/tools/contracts.ts` (new), `lib/validation/toolSchemas.ts`, `lib/validation/toolSchemas.test.ts`, `lib/tools/translate.ts` (type import/signature only).

- [ ] Add failing capability assertions for `site_tool:read` / `site_tool:move` on both roles, retaining assertions that all existing global tool capabilities are denied to supervisors.
- [ ] Add schema cases for each site action, required version, unknown fields, invalid UUIDs, decimals, empty quantity, negative/zero quantity, >1,000,000 quantity, note >500, and an extra `fromSiteId` on scoped receive/return.
- [ ] Run `npx vitest run lib/auth/capabilities.test.ts lib/validation/toolSchemas.test.ts`; new assertions must fail for the intended missing capability/schema behavior.
- [ ] Add the scoped capabilities to the shared role set and the union. Define the DTOs and `MovementAction` from section 4. Change the translator's input type from `ToolMovementBody` to `MovementAction`; the translator's algorithm and its existing fixtures remain unchanged. Extend explicit global movement request bodies with a required `expectedVersion`; this is intentional validation tightening, so old cached clients fail safely until refreshed.
- [ ] Define the strict site schema with three explicit branches:

```ts
const siteMoveFields = {
  toolId: z.string().uuid(),
  expectedVersion: z.number().int().min(0),
  quantity: z.number().int().min(1).max(1_000_000),
  note: z.string().trim().max(500).optional(),
};
export const siteToolMovementSchema = z.discriminatedUnion("kind", [
  z.object({ ...siteMoveFields, kind: z.literal("receive") }).strict(),
  z.object({ ...siteMoveFields, kind: z.literal("return") }).strict(),
  z.object({ ...siteMoveFields, kind: z.literal("transfer"), targetSiteId: z.string().uuid() }).strict(),
]);
```

- [ ] Rerun the two test files; expect PASS. Find all `ToolMovementBody` / `moveTool` call sites with `rg -n 'ToolMovementBody|moveTool\(' app components lib`; update typed fixtures and existing callers to include the displayed tool version so the tree remains type-correct before UI replacement.
- [ ] Commit as `feat(tools): define scoped site tool permissions and movement contracts`.

### Task 2: Reject invalid source movements before translation

**Files:** `lib/tools/movementRules.ts`, `lib/tools/movementRules.test.ts` (new), `lib/tools/translate.ts`, `lib/tools/translate.test.ts`.

- [ ] Add these action-level regression assertions using the existing translator fixture conventions:

```ts
const state = {
  toolId: "t", version: 1, totalQuantity: 10,
  assignments: [{ siteId: "a", qty: 2 }, { siteId: "b", qty: 1 }],
};
expect(validateMovement(state, { kind: "return_to_godown", fromSiteId: "a", quantity: 5 }))
  .toEqual({ ok: false, reason: "insufficient_source", available: 2 });
expect(validateMovement(state, { kind: "transfer_site", fromSiteId: "missing", targetSiteId: "b", quantity: 1 }))
  .toEqual({ ok: false, reason: "insufficient_source", available: 0 });
expect(validateMovement(state, { kind: "transfer_site", fromSiteId: "a", targetSiteId: "a", quantity: 1 }))
  .toEqual({ ok: false, reason: "same_site" });
expect(validateMovement(state, { kind: "send_to_site", targetSiteId: "c", quantity: 8 }))
  .toEqual({ ok: false, reason: "insufficient_source", available: 7 });
expect(validateMovement(state, { kind: "return_to_godown", fromSiteId: "a", quantity: 2 }))
  .toEqual({ ok: true });
```

- [ ] Run `npx vitest run lib/tools/movementRules.test.ts lib/tools/translate.test.ts`; expect the new rules assertions to fail before implementation.
- [ ] Export `validateMovement(state: BaseToolState, body: MovementAction): {ok:true} | {ok:false; reason:"insufficient_source"|"same_site"|"invalid_quantity"|"total_limit"; available?:number}`. Its body uses `free = totalQuantity - sum(assignments.qty)` and exact source lookup; rejects non-integers, values outside 1..1,000,000, same-site transfer, and stock additions making the total >1,000,000. Import `BaseToolState` from the existing translator and `MovementAction` from contracts using type-only imports. Keep the translator as a pure conversion, called only after this check in the explicit movement path.
- [ ] Add assertions for 1 item, exact full return, final godown item, remove beyond free, add at the limit, and an empty source list. Existing happy-path translator outputs remain unchanged.
- [ ] Rerun both files; expect PASS. Commit as `fix(tools): reject oversized and invalid source movements`.

### Task 3: Reuse the transaction engine with consistent locks

**Files:** `lib/tools/locking.ts`, `lib/tools/executeMovement.ts`, `lib/tools/executeMovement.test.ts` (new), `lib/tools/applyBatch.ts`, `lib/tools/siteLifecycle.ts`, `lib/tools/integration.test.ts`.

- [ ] Add service tests that assert stale version/source insufficiency/forbidden destination produce no assignment or ledger writes. Assert site authorization is checked after site locks, and tool reads/application share the transaction handle.
- [ ] Run `npx vitest run lib/tools/executeMovement.test.ts`; expect FAIL before the new service exists.
- [ ] Extract the locked reader/application functions described in section 5 without changing the legacy `ApplyResult`, `ToolPayload`, or `applyOneTool` public signatures. The only optional application input is a trusted internal explicit ledger event. Map explicit actions to `assign`, `return`, `transfer`, `procure`, and `retire`; emit exactly one event for that action and skip the diff-generated ledger events in that branch.
- [ ] Implement ordered shared site locks and the movement transaction orchestration in this exact order:

```text
transaction
  lock sorted affected site rows FOR SHARE
  reject missing/archived/deleted sites
  check each affected site's ownership for this actor
  loadToolForUpdate(tx, toolId)
  reject expectedVersion mismatch
  validateMovement(locked state, body)
  translateToPayload(locked state, body)
  applyLockedTool(tx, locked state, payload, actor.id, explicit ledger event)
commit
```

- [ ] Update the batch wrapper and lifecycle auto-return to the site-before-tool and ordered-tool rules in section 5. Use existing `checkOwnership`/`can` behavior, not new role-string conditionals. Preserve batch sequential processing and omitted-field behavior.
- [ ] Run `npx vitest run lib/tools/executeMovement.test.ts lib/tools/translate.test.ts lib/tools/invariant.test.ts lib/tools/diff.test.ts app/api/tools/batch-save/route.test.ts`; expect PASS. Add the real concurrency cases in Task 10 before claiming the locking strategy verified.
- [ ] Commit as `fix(tools): share transactional moves and coordinate site lifecycle locks`.

### Task 4: Add narrowly scoped reads and site history

**Files:** `lib/tools/siteAccess.ts`, `siteAccess.test.ts`, `siteQuery.ts`, `siteQuery.test.ts` (all new); the three new site tool API route files and colocated `route.test.ts` files from section 3.

- [ ] Start with route tests modeled on `app/api/sites/[id]/stages/[stage]/route.test.ts`: unauthenticated request never calls inventory queries; missing/archived/deleted site returns 404; another supervisor's site returns 403 before any inventory query. Include an admin accessing a site assigned to somebody else.
- [ ] Add query cases for no holdings, one holding, multiple holdings, a fully returned tool still present in history, inactive categories on existing tools, and deleted tool metadata retained for historical event display. Assert exact response keys; ban `assignments`, `totalQuantity`, `free`, `code`, and raw actor/location identifiers from scoped DTOs.
- [ ] Run `npx vitest run lib/tools/siteAccess.test.ts lib/tools/siteQuery.test.ts 'app/api/sites/[id]/tools'`; expect FAIL for the new exports/routes before implementation.
- [ ] Implement a fresh authorization helper using `requireCapability`, current site lifecycle/ownership data, and `checkOwnership`; use a DB/transaction executor parameter where needed. Do not use the cached GET site endpoint as the source of write authorization.
- [ ] Query holdings by joining `toolAssignments` to tools/categories/site with the route's `siteId` and live ownership predicate in SQL. Build count fields from that result. For receive choices, compute `totalQuantity - coalesce(sum(all assignments),0)` in one statement, select only allowed picker columns, and return only positive availability. Include the requested site's current ownership/lifecycle predicate in the inventory/history SQL itself, not solely an earlier preflight lookup. Do not fetch global `ToolDTO[]` and filter in the browser.
- [ ] Query history by `fromLocation = siteId OR toLocation = siteId`, optional validated `toolId`, and existing bounded pagination. Order by `createdAt DESC, movementId DESC`. Resolve names in set-based joins/lookups, not one query per row. Render an inaccessible counterparty as `Another site` with no raw UUID/name/link; show allowed destinations and godown normally. Use `Former user` if the actor no longer resolves. Preserve recorded notes, but do not enrich them with inaccessible names.
- [ ] Add GET adapters using the contracts and existing response helpers. Set private/no-store headers. Reuse `/api/sites` for destination choices rather than creating another site picker API.
- [ ] Rerun the targeted tests; expect PASS. Commit as `feat(tools): add authorized site inventory and history reads`.

### Task 5: Wire site and admin movement APIs to the shared service

**Files:** `app/api/sites/[id]/tools/route.ts` and its test; `app/api/tools/[id]/move/route.ts` and `route.test.ts` (new test).

- [ ] Add route tests for receive/partial return/full return/transfer; missing version; posted actor/source/assignments fields; unauthorized stock operations; stale version; same-site transfer; unowned destination; reassigned source; archived target; and error responses containing no full tool state.
- [ ] Run `npx vitest run 'app/api/sites/[id]/tools/route.test.ts' 'app/api/tools/[id]/move/route.test.ts'`; expect failing assertions before route wiring.
- [ ] Map scoped bodies to existing domain actions using the route site, not caller-supplied source IDs:

```ts
const action = body.kind === "receive"
  ? { kind: "send_to_site" as const, targetSiteId: siteId, quantity: body.quantity, note: body.note }
  : body.kind === "return"
    ? { kind: "return_to_godown" as const, fromSiteId: siteId, quantity: body.quantity, note: body.note }
    : { kind: "transfer_site" as const, fromSiteId: siteId, targetSiteId: body.targetSiteId, quantity: body.quantity, note: body.note };
```

- [ ] Call `executeMovement({ toolId: body.toolId, expectedVersion: body.expectedVersion, action, actor: auth.session.user })`. Keep its `FreshTool` result internal. Site success returns only `SiteToolMoveResult`, obtaining `quantityHere` from that site's entry or zero after a full return. For the admin adapter, destructure `expectedVersion` from the validated body and pass the remaining `MovementAction` separately.
- [ ] Replace the global move route's read/translate/apply sequence with the same service. Retain existing global capability checks. Map stale version to `ERROR_CODES.CONFLICT` / 409; source/quantity failures to `VALIDATION_ERROR` / 400; scope failures to `FORBIDDEN` / 403; disappeared resources to `NOT_FOUND` / 404. Do not alter the mixed-result batch route's HTTP contract.
- [ ] Re-run route tests, capability tests, and batch-save tests; expect PASS. Commit as `feat(tools): enable scoped site moves with explicit conflict responses`.

### Task 6: Keep client and PWA inventory fresh

**Files:** `lib/client/tools.ts`, `lib/client/tools.test.ts`, `lib/pwa/toolRequests.ts`, `lib/pwa/toolRequests.test.ts` (new), `app/sw.ts`, `app/providers.tsx`.

- [ ] Add tests for the tool-key predicate, stale/invalid movement response handling, and live-request matching. Include querystrings, site history/receive choices, company routes, unrelated site routes, and unrelated entry APIs.
- [ ] Run `npx vitest run lib/client/tools.test.ts lib/pwa/toolRequests.test.ts`; expect new behavior to fail before changes.
- [ ] Add `useSiteTools(siteId)`, `useSiteToolReceiveOptions(siteId, query)`, and `useSiteToolMovements(siteId, toolId, offset)` using `useApiResult` and section 4 DTOs. Define the mutation as a scope-discriminated API adapter: company requests use the existing URL; site requests use POST `/api/sites/:id/tools`. Never use global hooks in the supervisor site screen.
- [ ] Use one invalidation predicate for already-mounted global tool keys and all scoped tools keys, including queries/history/receive choices. Await reads needed to refresh the current screen. Trigger revalidation on success and conflict/source-balance errors. Keep successful-save and failed-refresh outcomes separate.

```ts
export function isToolDataKey(key: unknown): key is string {
  return typeof key === "string" && (
    /^\/api\/tools(?:[/?]|$)/.test(key) ||
    /^\/api\/sites\/[^/?]+\/tools(?:[/?]|$)/.test(key)
  );
}
```

- [ ] Place a `NetworkOnly` rule before the service worker's general API/page/default rules for GET company tools and site tools API/page paths, including RSC requests to those pages. Leave entry/resource offline writes unchanged. Retire cached tool requests from `siteops-api-v1` and `siteops-pages-v1` during worker activation; match the actual pathname, including cache keys with `_u`, so the prior cache cannot serve a tool screen through a fallback.
- [ ] Add a small auth-cache bridge *inside* SWRConfig in `app/providers.tsx`, so it can use `useSWRConfig`. On identity changes, sign-out, and user updates, clear existing tool keys and `/api/sites` via `mutate(predicate, undefined, { revalidate: true })`; prevent old requests from repopulating the previous account's data. Do this independently of service worker availability. In the tool UI, a 401/403/404 refresh discards stale holdings and closes an open form; an ordinary network refresh failure may retain labeled previous data but cannot silently authorize a save.
- [ ] Rerun targeted tests; expect PASS. Commit as `fix(tools): refresh scoped inventory and bypass persistent stock caching`.

### Task 7: Build one movement form and shared history presentation

**Files:** `components/tools/ToolMovementForm.tsx`, `movementFormState.ts`, `movementFormState.test.ts`, `ToolHistory.tsx` (new), `ToolLedgerDrawer.tsx`.

- [ ] Add pure form-state tests for empty, decimal, negative, over-available, exact-max, loading, saving, stale, unknown-result, and changed selected tool inputs. Start with this input contract:

```ts
export function quantityError(raw: string, available: number): string | null {
  if (!/^\d+$/.test(raw)) return "Enter a whole number.";
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) return "Enter at least 1.";
  if (value > Math.min(available, 1_000_000)) return `Only ${Math.min(available, 1_000_000)} available.`;
  return null;
}
```

- [ ] Run `npx vitest run components/tools/movementFormState.test.ts`; expect FAIL before the helper exists.
- [ ] Build `ToolMovementForm` with an action-discriminated context, selected tool/version, permitted site choices, available source count, `onSubmit`, and `onClose`. It owns input/pending state only; parent context hooks own authorized data. Stock additions use remaining room under the total cap as their available maximum. Reset draft state only when the action/site/tool identity changes, not on unrelated SWR renders.
- [ ] Reuse `ModalShell` for focus/scroll/back dismissal. Give it a heading ID, a bounded scrollable body, keyboard-safe footer, and overlay token `z-[var(--z-overlay)]`. Use semantic labels, 44px controls, 16px number input, `inputMode="numeric"`, `step={1}`, `aria-describedby`, and inline error text. Minus/plus disable at boundaries; typed invalid input stays untouched. The result sentence remains visible above the submit button.
- [ ] Guard submit with a ref latch plus state, release in `finally`, and call `toast.success` only after a confirmed success response. On stale/source errors, retain the draft and display refreshed availability with `Review quantity`; refresh the reviewed version only after the user acknowledges that new state. On unknown outcome, retain the submitted version and require checking stock/history before a new intent. Never auto-retry POST.
- [ ] Keep the pending request observer mounted if the user dismisses a saving dialog, so a committed result still invalidates data and receives correct feedback. Do not claim canceling the dialog canceled a server transaction.
- [ ] Extract common history labels/rows into `ToolHistory` and reuse them in the existing catalog ledger drawer. Site history is driven by the scoped hook and company history by the existing admin hook. Include actor, time, quantity, location labels, notes, pagination, loading, retry, and genuinely empty states. Do not use raw UUIDs as display fallbacks.
- [ ] Rerun pure-state tests and `npx vitest run tests/ui`; expect PASS. Commit as `feat(tools): add focused shared movement and history views`.

### Task 8: Add the site entry point and Tools page

**Files:** `components/tools/SiteToolsCard.tsx`, `SiteTools.tsx` (new), `app/app/sites/[id]/tools/page.tsx`, `loading.tsx`, `error.tsx` (new), `app/app/sites/[id]/SiteDetailPageClient.tsx`.

- [ ] Add the server route with the same session/ownership guard chain used by the Work Stages route, also checking `isDeleted`. Use `safeGetSessionFromHeaders`, redirect for signed-out users, and `notFound` for unavailable/unowned sites. Keep the company route's global gate unchanged.
- [ ] Add the card using `useSiteTools(siteId)` so its summary shares SWR data with the destination page and subsequent mutations. Do not make every dashboard site card fetch inventories. Loading shows a count skeleton; failure says `Tools unavailable` with retry rather than `0`.
- [ ] Mount the card beside the existing All Operations and Work Stages cards, using `.card-standard`, Lucide Wrench, existing colors, and the established link/chevron pattern.
- [ ] Render the site's name and `Tools`, compact count, search, Receive button, holdings, and Movement history entry. Filter loaded holdings locally by tool name; show total holdings counts separately from search matches. No matches offers `Clear search`, while a genuinely empty inventory offers Receive.
- [ ] Pass explicit action contexts to the shared form. Fetch godown choices only when Receive opens. Load destinations from existing `/api/sites`, removing the current site. If none remain, explain `No other assigned sites available` for supervisors; keep Return available.
- [ ] Make history an in-page view with a visible back-to-inventory control; entering history resets pagination. Back-to-site uses `/app/sites/:id`, independent of how this page was reached.
- [ ] Check the rendered layouts at 320px and 390px widths: long names wrap, source/destination stay readable, the fixed bottom nav covers no row/action, and keyboard opening leaves the submit control reachable. Authenticated movement verification follows in Task 10 after provisioning its disposable fixtures; do not use production movements to verify this step.
- [ ] Commit as `feat(tools): bring inventory and movements into each site`.

### Task 9: Simplify the company overview and retire duplicate flows

**Files:** `components/tools/ToolsHub.tsx`, `ToolRow.tsx`, `ToolDashboardStrip.tsx`, `ToolAddModal.tsx`, `ToolSummaryTile.tsx`, `ToolDrawer.tsx`, `BySiteView.tsx`, `lib/tools/query.ts`, `lib/tools/query.test.ts`.

- [ ] Replace tabs with the compact global summary, search, and tool list from section 1. Keep the dashboard totals query independent of search. Do not silently render failed/loading totals as zero.
- [ ] Keep the existing company query outputs but compute each tool's total/version/assignments/free from a single SQL statement using an assignment aggregate joined to tools. Compute the compact dashboard's total quantity and assigned quantity from aggregate subqueries in one statement as well, avoiding join fan-out. Existing per-category/per-site aggregates may remain for their consumers. Extend `lib/tools/query.test.ts` and scratch integration assertions to preserve ordering, filters, shapes, and `free = total - assigned`; do not introduce a second inventory calculation in React.
- [ ] Replace Manage with Send plus a clear details control. Details reveal the tool's site distribution and links to `/app/sites/:id/tools`. Put stock actions/history in that tool's secondary actions; keep new-tool registration in the page header.
- [ ] Route explicit send/add/remove actions through `ToolMovementForm`; reuse the existing category/create APIs and catalog entry points. Rename the existing modal to `New tool type`; show Name, Category, and `Initial quantity in godown`. Validate the initial quantity as an integer between 0 and 1,000,000, allowing a blank value to mean zero; stop flooring/clamping. Hide internal code/category-prefix text in both modal and success toast.
- [ ] Update the Home summary's `Free Tools` / `Deployed` labels to `In godown` / `At sites`, matching the rest of the module. Preserve its admin-only visibility and existing destination.
- [ ] Run `rg -n 'ToolDrawer|BySiteView' app components lib tests`; remove the obsolete drawer and by-site component only after their live callers are replaced. Preserve `AssignmentPanel` and catalog behavior; do not remove code just because the hub no longer uses it.
- [ ] Run `npm run lint` and `npx vitest run lib/client/tools.test.ts tests/ui`; expect PASS. Check the company page at phone and desktop widths with long names, zero stock, no tools, search misses, and failed summary/list fetches.
- [ ] Commit as `refactor(tools): simplify company inventory and replace generic manage actions`.

### Task 10: Verify permissions, race conditions, and mobile flows

**Files:** `lib/tools/integration.test.ts`, `lib/tools/movementConcurrency.integration.test.ts` (new), `e2e/tools-inventory.spec.ts`, `e2e/fixtures/tools.ts` (new).

- [ ] Add the concurrency/edge scenarios from section 7 as real integration tests. Require `TOOLS_IT_DB === "1"` plus an explicitly supplied scratch URL; do not infer scratch safety from `.env.local`. Use independent database connections/transactions and barriers around actual lock acquisition rather than sleep-based scheduling. Add bounded timeouts and clean up only IDs created by the fixtures, even after assertion failures.
- [ ] Provision fixture identities out of band in a disposable test environment: Admin, Supervisor A owning two sites, Supervisor B owning another site. The browser fixture signs these users in through existing auth or uses their supplied storageState; it never calls self-service signup. Keep test-only credentials outside the repository.
- [ ] Replace the obsolete e2e stubs with real assertions: supervisor company page/API denial, owned-site card and inventory, foreign-site direct URL/API denial, tampered transfer denial, receive, partial/full return, both-side transfer updates, conflict input preservation, no false success, history after last return, empty/error/retry states, keyboard/back/focus, and long names at phone sizes.
- [ ] Before full-suite checks, verify `SITEOPS_SCRATCH_DB_URL` names the disposable database and configure the app's test auth/service credentials for that same environment. Do not print credentials. Run normal checks once changes are ready with an explicit database override:

```bash
npm run lint
: "${SITEOPS_SCRATCH_DB_URL:?Set a verified disposable database URL}"
DATABASE_URL="$SITEOPS_SCRATCH_DB_URL" npm test
DATABASE_URL="$SITEOPS_SCRATCH_DB_URL" npm run build
```

Expected: exit 0 for each, except pre-existing failures documented with their baseline. The default suite skips opt-in tool mutation cases, but other `describeDb` suites may execute against the explicitly supplied scratch URL. Skipped cases are not a passing concurrency result. If no disposable environment is available, run the listed pure/mocked unit checks and typecheck, then report the full-suite/integration/browser checks as unexecuted; do not fall back to `.env.local` for them.

- [ ] Against an explicitly configured disposable database, run:

```bash
: "${SITEOPS_SCRATCH_DB_URL:?Set a verified disposable database URL}"
TOOLS_IT_DB=1 DATABASE_URL="$SITEOPS_SCRATCH_DB_URL" npx vitest run lib/tools/integration.test.ts lib/tools/movementConcurrency.integration.test.ts --testTimeout=30000
```

Expected: the real mutation/concurrency cases execute and pass, with no remaining fixture rows. Set `SITEOPS_SCRATCH_DB_URL` only after verifying it names the disposable environment. Do not run `npm run db:migrate`; package.json explicitly disables it for this push-managed database.

- [ ] Run `npx playwright test e2e/tools-inventory.spec.ts --project=chromium` only with the app configured for the same non-production fixture environment. The fixture must fail clearly if that environment/auth is absent, not silently skip the happy paths. Also verify an installed production-build PWA: after a move, fresh counts survive reopening/focus; offline tools do not pretend a write succeeded or use an outbox replay.
- [ ] Review `git diff --check` and the changed file list; verify scoped response payloads contain no company allocations, user-facing codes, or raw backend copy. Report executed checks, skipped/environment-blocked checks, and any remaining limitation accurately.
- [ ] Commit as `test(tools): cover scoped access stock races and mobile movements`.

## 7. Edge cases and race-condition acceptance matrix

| Scenario | Required outcome | Verification |
|---|---|---|
| Return 5 when source has 2 | 400, no writes, `Only 2 available`; preserve 5 in the field. | Pure rules + route + integration. |
| Transfer from a missing/empty source | Reject; godown is not used as an implicit fallback. | Rules + integration. |
| Transfer to the same site | 400, no ledger/version change. | Rules + route. |
| Two users send the final item from the same reviewed version | One success, one 409; no negative free count or extra event. | Real concurrent service calls. |
| Double tap or network replay of the same form | At most one write for that version. | Ref-latch UI + version integration. |
| Source changes between opening and submitting | 409, refreshed permitted availability, no automatic replay. | Route + browser. |
| Dashboard/list read overlaps a stock addition and send | Each displayed total/free calculation uses one committed snapshot; counts do not mix different versions. | Query parity + scratch concurrent-read cases. |
| Godown stock changes after receive options load | Version/source validation under lock decides; picker data never authorizes a save. | Integration. |
| Site is archived while a send/return/transfer is pending | Serialized by site lock; archive returns exactly the committed stock or move is rejected; no orphan assignment. | Race both orderings on separate connections. |
| Archive competes with tool force-delete | Return is recorded once for each actual quantity; second path rereads and skips missing assignments. | Integration. |
| Supervisor is reassigned while a movement waits | After acquiring site lock, old supervisor is rejected if reassignment committed first. | Integration + route. |
| Transfer destination is unowned, removed, or stale in picker | Reject server-side; no partial source debit. | Tampered-request tests. |
| Tool has stock on unrelated sites | Their allocations are neither changed nor serialized to the supervisor. | Integration + exact DTO tests. |
| Last unit returned | Remove zero assignment; keep history visible; card counts update. | Integration + browser. |
| Failure inserting ledger after assignment changes | Entire transaction rolls back, including version/counts. | Integration with injected transaction failure. |
| Positive/negative fractional, blank, scientific notation input | No rounding/clamping; explicit whole-number message. | Pure state + browser. |
| Stock addition crosses 1,000,000 total | Reject before SQL integer overflow or application-cap bypass. | Rules + integration. |
| Empty, loading, denied, and failed reads | Distinct states; never show an error as a true zero. | Route + browser. |
| No other assigned destinations | Transfer explains why; receive/return still usable. | Browser. |
| Inactive category / deleted actor / historical deleted tool | Existing inventory stays usable; history retains readable fallback labels. | Query fixtures. |
| Historical movement touches an unowned site | No raw counterpart UUID/name/link in scoped result; label `Another site`. | Exact response assertions. |
| Lost response after a commit | Unknown-result message; check history/stock before a fresh intent, no auto-retry. | Intercepted response browser test. |
| Save succeeds but revalidation fails | Saved feedback remains truthful, show refresh retry. | Browser + client tests. |
| Account switches or role changes in the same browser | Clear prior tool/site-picker client data; new reads reauthorize. | Authenticated account-switch browser case. |
| Installed PWA or offline phone | No stale service-worker tool reads and no queued/replayed tool POST. | Production-build PWA verification. |
| 120-character name, large counts, 320px viewport, keyboard | Wrap naturally; 44px targets; no horizontal scroll; footer/submit remain usable. | Browser QA. |

## 8. UI/codebase principles to preserve

- Use existing dark slate surfaces, blue primary action, Inter, Lucide, card/input/button utilities, theme tokens, and app-shell spacing. No new visual framework, palette, font, or component library.
- `app/globals.css` requires at least 12px readable text and 14px interactive labels; use 16px form inputs and at least 44px touch controls for these outdoor/mobile workflows. Locally override the small defaults of existing button classes rather than changing every screen.
- Keep one primary action per context. Use familiar verbs and sentence case, remove technical implementation language from the product UI, and hide internal tool codes.
- Keep list names visible, with wrapping and `min-w-0` rather than truncating the only identifier. Use tabular numerals for quantities; use words alongside colors for status.
- Reuse shared dialog focus trapping, focus return, scroll locks, back dismissal, reduced-motion configuration, overlay z-index tokens, safe-area padding, and bounded content scrolling. Avoid nested dialogs and gratuitous animation.
- Follow capability checks plus ownership checks; API access never depends on hidden buttons. Validate with Zod, return existing envelopes/error codes, and render friendly errors with the existing toast helpers.
- Bound queries, avoid N+1 location/actor lookups, retain existing indexes, and keep unrelated inventory/cache entries out of mutation refreshes. No broad route reload is needed for a normal movement.
- Keep each new component/module focused. The targeted engine extraction and shared form replace duplicate behavior; avoid unrelated refactoring or editing generated files.

## 9. Delivery and approval checkpoint

The implementation is ready for review when both entry points work, scoped access holds for direct requests, stock/ledger invariants hold under tested races, and the mobile flows meet section 8. Final reporting must name any scratch-database/PWA/browser checks that could not execute; it must not claim those passed because unit tests passed.

This plan has been checked against the approved conversation for scope, DTO/route consistency, reuse, error outcomes, lock ordering, and UI states. No separate spec file is required. The user approved execution. The implementation was completed with focused commits, test-first changes, and independent spec and quality reviews.


## Implementation and verification record

Completed on `feat/tools-usability`. All ten work areas are implemented. The shared movement service lives in `lib/tools/movement.ts`; common HTTP/cache behavior lives in `lib/tools/http.ts`. Site/tool locking remains alongside the reused transaction engine rather than adding an unused locking abstraction.

- Full suite: 146 files, 1,192 tests passed with the disposable database and `--no-file-parallelism`.
- Browser workflows: 10 passed, including receive, partial/full return, transfer, role boundaries, conflict review, lost responses, reopened forms, category retry, focus return, and 120-character names on mobile.
- Production build and TypeScript checks passed.
- Production service-worker test passed: existing stock-cache entries are bypassed online and offline.
- Spec and code-quality reviews have no remaining material findings.
- No production database access, schema changes, or data changes were performed. Database writes ran exclusively in a separate empty PostgreSQL instance on loopback. Tests now refuse shared/remote database write targets and ambiguous multihost URLs.
- The pre-existing `next-env.d.ts` change was preserved. Generated build output was excluded from the implementation commits.

See [safe test setup](../../testing-tools.md) for reproducible commands. Actual installed-device testing remains separate from browser viewport and service-worker verification.
