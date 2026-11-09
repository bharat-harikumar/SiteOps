# Hide Values (Demo Mode) and Reporting-Site Card Implementation Plan

> **Revision 2026-11-09 (supersedes the blur design below).** After seeing the blur, the client narrowed the requirement: show names, sites, quantities and notes; hide **only money**. Changes:
> - Every rupee figure renders through `components/ui/Amount.tsx`, which outputs the real value and a fixed mask `₹ ****` (`AMOUNT_MASK`) side by side; `app/globals.css` shows one or the other. No hook, so no hydration flash; works in server components.
> - Masked: budgets (`₹ **** / ₹ ****`), `% used` / `% of budget` (`**%`, derived from budget), spend/day/running/grand totals, costs, wages, OT, expense amounts, search-hit amounts, budget-alert notification text.
> - Unmasked again: everything else. All `data-private` tags and the blur CSS are removed. Form fields (`components/logs/`) still show what is typed.
> - Profile toggle renamed **Hide amounts** ("Show ₹ **** instead of budgets and amounts."). Admin scope, per-device storage, boot script and the Reporting-from card are unchanged.
> - Fences: `components/ui/Amount.test.ts`, `tests/ui/privacy-scope.test.ts` (CSS swap only inside the admin scope; no blur), `tests/ui/amount-coverage.test.ts` (every `{formatCurrency(…)}` / `{formatCompactCurrency(…)}` / `{formatBudgetPair(…)}` / `₹{…}` JSX child is inside `<Amount>`; variable-amount files listed explicitly; no `data-private` left). The Task 4 blur fence (`privacy-tags.test.ts`) is deleted.
> - Known limits: amounts inside free text (notes, request details) and web-push notification bodies are not masked; mask stars sit slightly high next to Inter (accepted).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For every UI step, load `ui-ux-pro-max`, `impeccable` and `emil-design-eng` guidance before writing markup/CSS.

**Goal:** (1) Give admins a one-tap "Hide values" setting that blurs names, sites and numbers across the app for demos without changing any layout; (2) show the "Reporting from" site card on every log-entry form so users always know which site they are logging for.

**Architecture:** Hiding is pure presentation. Sensitive text nodes get a `data-private` attribute; one CSS rule blurs them only when `<html data-privacy="on">` **and** the element sits inside the Admin-only `[data-privacy-scope]` wrapper rendered by `AppShell`. The preference lives in `localStorage` and a tiny inline boot script applies it before first paint. The reporting card is extracted from `LogsNewPageClient` into a shared component and rendered by the server form page with a permission-checked site lookup.

**Tech Stack:** Existing Next.js App Router, React 19, TypeScript, Tailwind, Lucide, Vitest (node env, static "fence" tests in `tests/ui/`). No new dependency, no API change, no DB change.

**Spec:** Approved design in the conversation of 2026-11-09 (user waived a separate spec file; this devlock is the only document). Requirements are restated in "Approved behaviour" below.

**Branch:** `feat/hide-values-and-reporting-site`, created from `origin/main` at `62c5f22` (already contains the merged tools work).

## Approved behaviour

**Hide values**
- Admin-only. Supervisors never see the setting and are never blurred, even on a device where an admin enabled it.
- Toggle lives in a new **Privacy** card on the Profile page: label `Hide values`, helper `Blur names, sites and amounts for demos.` Uses the existing `components/ui/Toggle.tsx`.
- Per device (`localStorage`), survives reload, no flash of real values on load.
- Blurred: site names, site locations, budgets, amounts, rates, quantities, totals, counts of business records, notes/descriptions, vendor names, people names/emails/phones, notification and search-hit body text.
- Readable: category names, catalog names (material types, tool names, work stages, units), statuses, dates/relative times, headings, labels, buttons, icons, the notification-bell badge, and **every form control** (`input`, `select`, `textarea`) so the admin can still type during a demo.
- Layout must be byte-for-byte identical in both states. Blur must look intentional (frosted chip), not smudged.
- Not a security boundary: values remain in the DOM. Accepted by the user.

**Reporting site on the form**
- `/app/logs/new/[categoryId]` shows the same `Reporting from` card (site name, location, `Change`) between the page header and the form.
- `Change` links to `/app/logs/new` (the site picker).
- If the site is missing or not permitted for this user, the card reads `No site selected` with a `Choose site` link to `/app/logs/new`.
- Site name/location in the card carry `data-private`.

## Global Constraints

- Attribute names, exactly: `data-private` (on sensitive nodes), `data-privacy-scope` (on AppShell root, Admin only), `data-privacy="on"` (on `<html>`).
- Storage key, exactly: `siteops:hide-values`, value `"1"` when on; key removed when off.
- Never put `data-private` on `input`, `select`, `textarea`, `button`, or an element that also contains an icon. Wrap the text in a `<span data-private>` instead.
- No layout-affecting CSS in the privacy rule: only `filter`, `clip-path`, `user-select`, `transition`.
- Blur ≤ `0.3em`, transition `filter 200ms cubic-bezier(0.23, 1, 0.32, 1)`, no transition under `prefers-reduced-motion: reduce`.
- Do not change what the forms submit (`siteId` passed to `EntryForm`/`DynamicEntryForm` stays as today).

## Review Focus

1. **Supervisor on a device where an admin enabled hiding** → nothing blurred. Pinned by the CSS-scope fence + AppShell test in Task 1.
2. **`localStorage` unavailable/throwing (iOS private mode, blocked storage)** → app loads, toggle defaults off, no console error. Pinned by `readHideValues` / boot-script tests in Task 1.
3. **First paint after reload with hiding on** → no flash of real values. Pinned by boot-script test (Task 1) + manual QA step (Task 5).
4. **Supervisor deep-links `/app/logs/new/<cat>?siteId=<someone else's site>`** → card shows `No site selected`, never the other site's name. Pinned by `reportingSiteFor` test in Task 3.
5. **A form control accidentally tagged** → admin can't read what they type. Pinned by the "no data-private on form controls" fence in Task 4.

---

### Task 1: Privacy core (storage, boot script, CSS, scope)

**Files:**
- Create: `lib/ui/privacy.ts`
- Create: `lib/ui/privacy.test.ts`
- Modify: `app/layout.tsx` (boot script in `<head>`, `suppressHydrationWarning` on `<html>`)
- Modify: `components/app-shell/AppShell.tsx` (scope attribute)
- Modify: `app/globals.css` (privacy rule, after the `@layer utilities` block, before the reduced-motion media query)
- Modify: `lib/security/headers.ts:11-17` comment ("ZERO inline scripts" is no longer true; name the one boot script and why `'unsafe-inline'` covers it)
- Test: `tests/ui/privacy-scope.test.ts`

**Interfaces — Produces:**
- `HIDE_VALUES_KEY = "siteops:hide-values"`
- `readHideValues(storage: Pick<Storage, "getItem"> | null | undefined): boolean` — `false` on missing storage or throw.
- `writeHideValues(storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined, on: boolean): void` — swallows throws.
- `applyHideValues(root: { dataset: DOMStringMap }, on: boolean): void` — sets `dataset.privacy = "on"` or deletes it.
- `HIDE_VALUES_BOOT_SCRIPT: string` — self-contained, try/catch wrapped, references `HIDE_VALUES_KEY` by value.
- `usePrivacyMode(): [on: boolean, setOn: (next: boolean) => void]` — client hook (`"use client"` file `lib/ui/usePrivacyMode.ts`), `useSyncExternalStore` over `document.documentElement.dataset.privacy`, server snapshot `false`; `setOn` calls `writeHideValues` + `applyHideValues` and notifies subscribers.

- [ ] **Step 1: Write failing tests** in `lib/ui/privacy.test.ts`:
  - `readHideValues` returns `true` for `"1"`, `false` for `null`, `"0"`, `"true"`, `undefined` storage, and a storage whose `getItem` throws.
  - `writeHideValues(s, true)` calls `setItem("siteops:hide-values", "1")`; `false` calls `removeItem`; a throwing storage does not throw.
  - `applyHideValues` sets/deletes `dataset.privacy`.
  - Boot script: run `new Function("localStorage", "document", HIDE_VALUES_BOOT_SCRIPT)` with fake objects → sets `privacy="on"` for `"1"`, leaves unset otherwise, does not throw when `getItem` throws.
- [ ] **Step 2:** `npx vitest --run lib/ui/privacy.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `lib/ui/privacy.ts` and `lib/ui/usePrivacyMode.ts`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Write failing fence test** `tests/ui/privacy-scope.test.ts` (read sources as text, like `tests/ui/back-navigation.test.ts`):
  - `app/globals.css` contains the selector `html[data-privacy="on"] [data-privacy-scope] [data-private]` and no other selector applying `filter` to `[data-private]`.
  - The privacy rule block contains none of: `width`, `height`, `margin`, `padding`, `display`, `font`, `letter-spacing`, `color`.
  - `components/app-shell/AppShell.tsx` sets `data-privacy-scope` conditioned on `role === 'Admin'`.
  - `app/layout.tsx` renders `HIDE_VALUES_BOOT_SCRIPT` and has `suppressHydrationWarning` on `<html>`.
- [ ] **Step 6:** Run → FAIL. Implement:
  - AppShell root div: `data-privacy-scope={role === 'Admin' ? '' : undefined}`.
  - Root layout: `<head><script dangerouslySetInnerHTML={{ __html: HIDE_VALUES_BOOT_SCRIPT }} /></head>`; `suppressHydrationWarning` on `<html>` (the boot script adds an attribute React did not render).
  - CSS (the look is decided here; tune only within these bounds during QA):
    ```css
    [data-private] { transition: filter 200ms cubic-bezier(0.23, 1, 0.32, 1); }
    html[data-privacy="on"] [data-privacy-scope] [data-private] {
      filter: blur(0.3em);            /* scales with font size: KPI and caption look equally soft */
      clip-path: inset(0 round 0.25em); /* keeps blur inside its own box: a tidy frosted chip, no halo over borders */
      -webkit-user-select: none; user-select: none;
    }
    @media (prefers-reduced-motion: reduce) { [data-private] { transition: none; } }
    ```
  - Update the `headers.ts` comment.
- [ ] **Step 7:** Run fence + `npm run lint` → PASS.
- [ ] **Step 8: Commit** `feat(privacy): add hide-values preference, boot script and scoped blur rule`.

### Task 2: Privacy card on Profile (Admin only)

**Files:**
- Modify: `app/app/profile/ProfilePageClient.tsx` (new `<section>` placed after "Account Details", before "Update Profile")
- Test: extend `tests/ui/privacy-scope.test.ts`

**Interfaces — Consumes:** `usePrivacyMode()` from Task 1; role from `initialProfile.user.role` (already in props).

- [ ] **Step 1: Failing fence:** `ProfilePageClient.tsx` renders `Hide values` only inside a branch guarded by `role === 'Admin'` and uses `<Toggle`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement the card with the existing `card-standard rounded-2xl p-4 flex flex-col gap-3` section pattern: title `Privacy` (`text-lg font-extrabold tracking-tight text-on-surface`, same as siblings), helper `Blur names, sites and amounts for demos.` (`text-sm text-on-surface-variant`), then `<Toggle checked={on} onChange={setOn} label="Hide values" />`. No toast — the switch state and the instantly blurred email header above are the feedback. Tag the header email `<h2>` text with `data-private` (it is a person identifier and gives an immediate preview).
- [ ] **Step 4:** Run → PASS; `npm run lint`.
- [ ] **Step 5: Commit** `feat(privacy): admin Hide values toggle on profile`.

### Task 3: Reporting-from card on the log form

**Files:**
- Create: `components/logs/ReportingFromCard.tsx`
- Create: `lib/nav/reportingSite.ts` + `lib/nav/reportingSite.test.ts`
- Modify: `app/app/logs/new/LogsNewPageClient.tsx:98-122` (replace inline banner with the component)
- Modify: `app/app/logs/new/[categoryId]/page.tsx` (look up site, render card between header and form)
- Test: `tests/ui/reporting-site.test.ts`

**Interfaces — Produces:**
- `reportingSiteFor(site: { name: string; location: string; supervisorId: string | null } | null, user: { id: string; role: "Admin" | "Supervisor" }): { name: string; location: string } | null` — Admin: any non-null site; Supervisor: only when `site.supervisorId === user.id`.
- `ReportingFromCard({ site, action }: { site: { name: string; location: string } | null; action: ReactNode })` — visual markup moved verbatim from `LogsNewPageClient` (same classes, `MapPin`, `Reporting From` eyebrow); name and location wrapped in `data-private`; when `site` is null render eyebrow `Reporting From`, title `No site selected`, muted MapPin (`text-slate-500`, no sky tint).

- [ ] **Step 1: Failing tests** `lib/nav/reportingSite.test.ts`: admin sees any site; supervisor sees own; supervisor gets `null` for another supervisor's site and for `supervisorId: null`; `null` site → `null`.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3: Failing fence** `tests/ui/reporting-site.test.ts`: both `LogsNewPageClient.tsx` and `[categoryId]/page.tsx` render `<ReportingFromCard`; the form page links `Change`/`Choose site` to `/app/logs/new`; `ReportingFromCard.tsx` contains `data-private`.
- [ ] **Step 4:** Implement:
  - `LogsNewPageClient`: `<ReportingFromCard site={selectedSite} action={<button … onClick={() => setSelectedSiteId(null)}>Change</button>} />` (behaviour unchanged).
  - Form page: when `siteId` is present, `getSiteById(siteId)` (excludes archived/deleted) → `reportingSiteFor(row, session.user)`. Run this lookup in `Promise.all` with the existing category query. Render the card with a `Link` action: `Change` when a site resolved, `Choose site` when not, both `href="/app/logs/new"`, classed `btn-secondary px-3 py-2 shrink-0`.
  - Do not change the `siteId` prop passed to the forms.
- [ ] **Step 5:** Run tests + lint → PASS.
- [ ] **Step 6: Commit** `feat(logs): show reporting site on the entry form`.

### Task 4: Tag sensitive surfaces

**Tagging rule (apply literally):** add `data-private` to the smallest element whose text is a site name, site location, budget, amount, rate, quantity, total, record count, note/description, vendor name, or person name/email/phone. If that element also holds an icon or a label word, wrap only the value in `<span data-private>`. Never tag form controls, headings that are fixed copy, catalog names, statuses, dates or buttons. For `formatCurrency` / `formatQuantityTotals` output, tag at the render site, not inside the formatter (formatters return strings).

**Files (each must end with at least one `data-private`):**
- Dashboard & sites: `app/app/dashboard/SiteRow.tsx`, `SitesCard.tsx`, `DashboardPageClient.tsx`, `ArchivedSites.tsx`, `app/app/sites/[id]/SiteDetailPageClient.tsx`, `app/app/logs/new/LogsNewPageClient.tsx` (site picker list)
- Operations: `components/operations/EntryLogList.tsx`, `components/operations/CategoryGrid.tsx`, `components/operations/entryFormat.tsx` (`renderEntrySummary` JSX), `app/app/sites/[id]/operations/[type]/AllOperationsPageClient.tsx`, `OperationDetailPageClient.tsx`, `[category]/CategoryDetailPageClient.tsx`, `app/app/sites/[id]/stages/StageSummaryClient.tsx`, `app/app/logs/[entryId]/page.tsx`
- Search & notifications: `components/search/SearchHitRow.tsx`, `app/app/notifications/page.tsx`, `components/app-shell/AppHeader.tsx` (profile-menu email at ~line 147; `GlobalSearchOverlay` renders inside AppHeader, so it is in scope)
- Admin: `app/app/admin/expenses/AdminExpensesPageClient.tsx`, `admin/analytics/AdminAnalyticsPageClient.tsx`, `admin/approvals/TransferApprovals.tsx`, `ResourceRequests.tsx`, `FieldRequests.tsx`, `admin/users/` row/table components (`components/admin-users/UserRow.tsx`), `admin/live-feed/page.tsx`
- Requests & transfers: `app/app/requests/field/FieldRequestsPageClient.tsx`, `requests/resource/ResourceRequestsPageClient.tsx`
- Tools: `components/tools/ToolsHub.tsx`, `SiteTools.tsx`, `SiteToolsCard.tsx`, `ToolRow.tsx`, `ToolHistory.tsx`, `ToolLedgerDrawer.tsx`, `ToolSummaryTile.tsx`, `ToolDashboardStrip.tsx`, `AssignmentPanel.tsx`, `ToolMovementForm.tsx` (source/destination/available text, not the quantity input)

Sub-tasks 4a (dashboard+sites+operations), 4b (search+notifications+admin+requests), 4c (tools) may be reviewed separately; each follows the steps below with its own file subset.

- [ ] **Step 1: Failing fence** `tests/ui/privacy-tags.test.ts`:
  - `PRIVATE_SURFACES` = the file list above; each file's code lines contain `data-private`.
  - Across all `.tsx` in `app/` and `components/`, no line matches `/<(input|select|textarea|button)\b[^>]*data-private/`.
- [ ] **Step 2:** Run → FAIL listing untagged files.
- [ ] **Step 3:** Tag per the rule. If a listed file turns out to render nothing sensitive (verify by reading what it renders), remove it from `PRIVATE_SURFACES` and say why in the commit message — do not add a dummy attribute.
- [ ] **Step 4:** Run fence + full `npm test` + `npm run lint` → PASS (DB-suite flake: rerun with `--no-file-parallelism --testTimeout=30000`).
- [ ] **Step 5: Commit** per sub-task, e.g. `feat(privacy): tag operations surfaces`.

### Task 5: Visual QA and verification

- [ ] **Step 1:** `npm run dev`, sign in as an admin, viewport 390×844. Turn Hide values on. Visit: dashboard, a site, all operations, an operation detail, a category detail, work stages, an entry detail, log-new (both steps) and an entry form, search with results, notifications, admin expenses/analytics/approvals/users/live-feed, requests, transfers, company tools, site tools, profile.
- [ ] **Step 2:** On each screen, screenshot on/off and confirm: identical layout (no shift, truncation unchanged), no blur bleeding over card borders, large KPI numbers and small captions look equally soft, icons/labels/catalog names crisp, form fields readable, no screen where most text is still readable values. Fix tagging gaps; re-run Task 4 fence.
- [ ] **Step 3:** Reload with hiding on → no flash of real values. Toggle on/off → 200ms fade; with OS reduce-motion → instant.
- [ ] **Step 4:** Sign out, sign in as a supervisor on the same browser → nothing blurred, no Privacy card. Deep link a non-owned `siteId` on an entry form → `No site selected`.
- [ ] **Step 5:** `npm test`, `npm run lint`, `npm run build` → all green. Record counts in the verification section below.
- [ ] **Step 6: Commit** `docs(privacy): record verification`.

---

## Self-audit (done before implementation)

| # | Angle | Finding | Resolution in this plan |
|---|---|---|---|
| A1 | Security / roles | Preference is per device; a supervisor later using that device would inherit the blur. | CSS requires `[data-privacy-scope]`, which AppShell renders only for Admin. Review Focus 1. |
| A2 | Race / first paint | Reading `localStorage` in a React effect would flash real values for ~1 frame after every reload. | Inline boot script in `<head>` before body paints. CSP already allows `'unsafe-inline'` scripts (report-only); headers comment updated. |
| A3 | Hydration | Boot script adds `data-privacy` to `<html>` that React did not render → hydration warning. | `suppressHydrationWarning` on `<html>` only (does not suppress children). Toggle uses `useSyncExternalStore` with server snapshot `false`, so no mismatch error on Profile. |
| A4 | Race / client nav | Inline scripts don't re-run on client navigation; would state drift? | No: root layout persists across navigation, attribute stays; the hook writes the attribute directly when toggled. |
| A5 | Fit / portals | Content outside AppShell (Sonner toasts, `ConfirmHost` dialogs) is outside the scope and won't blur; some confirm titles contain an email/site name. | Accepted, stated: toasts/dialogs only appear after the admin's own action. No `createPortal` exists in the app (grepped), so overlays inside AppShell (search, menus) are covered. |
| A6 | UI/UX | Fixed-px blur smudges big KPIs into blobs and barely hides small captions; blur halos bleed over card borders. | `blur(0.3em)` scales with font size; `clip-path: inset(0 round 0.25em)` contains it in a rounded chip. QA step checks both. |
| A7 | UI/UX | Tagging a row container would also blur icons/badges and make the screen look broken. | Tag the smallest text node; rule forbids tagging elements with icons; QA step 2. |
| A8 | Fit | Closed `<select>` (e.g. Transfer form site picker) shows a site name and stays readable. | Accepted per the agreed "form fields stay readable" rule. Listed for the user. |
| A9 | Over-engineering | Considered a `<Private>` component, a React context, cross-tab sync, a header eye button. | All dropped: a bare attribute works in server and client components; one consumer of the hook; demo is single-tab; user's request named Settings. |
| A10 | Performance | Many `filter` elements on a long list could cost repaint on low-end Android. | Blur is static once applied (no animation while scrolling); small radius. QA on a real phone; fallback if janky: `text-shadow` + transparent color variant (no layout change). |
| A11 | Security / Part 2 | Form page would render a site name from an arbitrary `?siteId=`, leaking other supervisors' site names. | `reportingSiteFor` ownership check; `getSiteById` excludes archived/deleted. Review Focus 4. |
| A12 | Fit / Part 2 | `Change` loses anything already typed in the form. | Card sits above all fields, so it's the first thing seen; no draft-guard added (would be new behaviour). Listed for the user. |
| A13 | Fit / Part 2 | Card says "No site selected" but the form still submits the raw `siteId`. | Unchanged on purpose: API already rejects non-permitted sites; changing submit behaviour is out of scope. |
| A14 | Reality | Tests run in node (no jsdom), so blur can't be unit-tested visually. | Logic unit-tested; wiring/coverage fenced by static tests (repo convention); look verified in Task 5 manually. |
| A15 | Maintenance | New screens added later won't be tagged automatically. | Fence lists current surfaces; new-screen authors must add `data-private` (note in commit/PR). |

## Verification record

Recorded 2026-11-09 on `feat/hide-values-and-reporting-site`.

- `npm test`: 1163 passed, 85 skipped, 1 failed — `lib/tools/query.test.ts` refuses to run without the disposable `siteops_tools_test` database (environment guard; unrelated to this change).
- Focused suites (`tests/ui lib/ui lib/nav components`): 344/344 passed.
- `npm run lint`: clean. `npm run build`: compiled successfully.
- Every test was watched failing before its implementation (privacy store, scope fence, profile fence, `reportingSiteFor`, reporting-card fence, coverage fence listing 35 untagged files).
- Coverage fence adjusted against reality: `logs/[entryId]` (edit form only), `ToolsHub` / `ToolLedgerDrawer` (catalog names only) and `AssignmentPanel` (not rendered) removed. Existing `toolsViews` tests now compare visible text.
- Visual QA (partial): real components (`ReportingFromCard`, `SiteRow`, entry summaries, a KPI block) rendered with the built CSS and screenshotted at 390px in both states. Layout identical; blur stays in its own box. Found and fixed: a truncated name's "…" stayed sharp (tag moved to the truncating element).
- **Not yet done:** Task 5 steps 1–4 against the running app with a signed-in admin and supervisor (needs credentials), the reload-flash check, the reduced-motion check and the real-phone performance check (A10).

### Revision verification (amounts only)

- `npm test`: 1136 passed, 85 skipped, 1 failed — the same `lib/tools/query.test.ts` disposable-database guard.
- Focused suites: 317/317 passed. `npm run lint` clean. `npm run build` compiled successfully.
- RED observed for each new test before implementation (Amount module missing; CSS swap rules; 26 unwrapped currency children; Profile label).
- Visual QA: real components rendered with the built CSS at 390px in both states — masks are fixed-length, no layout overlap, all non-money text unchanged.
