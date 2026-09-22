# Sprint: Admin Users Refresh, Password Reset, Newest-First Lists, "+" Skips Site — Design & Implementation Plan

**Date:** 2026-09-22
**Status:** Implemented 2026-09-22; committed 2026-09-23. Unit tests, typecheck and production build green. Browser click-through not yet done — see §11.
**Author:** Bharat Harikumar (tech lead)
**Scope:** SiteOps-Web

---

## 0. Handoff — read this first (for the implementing session)

**What we're building (5 changes):**
1. **Redesigned Admin → Users tab:** search, filters, status badges, "You" tag, and a create-account drawer.
2. **Admin password reset:** an admin sets a temp password for any *other* admin or supervisor. The user is signed out everywhere and must set their own password at next sign-in.
3. **Change password for everyone:** a visible entry point on Profile (and on your own row in Users). The change-password page adapts for forced vs voluntary changes.
4. **Newest first on every log/entry list:** by default, including inside each date.
5. **"+" button skips site selection** when you're already inside a site.

**Plan in brief (do in this order, see §8 for detail):**
1. Newest-first lists (§6)
2. "+" skips site (§7)
3. Shared password policy + 8 vs 10 mismatch fix
4. Capability + reset-password route
5. Change-password page modes + Profile entry point (§5)
6. Users page split (no visual change)
7. Users page redesign (§3)
8. Reset dialog (§4)
9. Verify

**Guardrails. The implementing session MUST follow these:**
- Build **only** what §3–§7 describe. If the code doesn't match this doc (a helper is renamed, an assumption is wrong), **STOP and report**. Don't improvise.
- **Verify every referenced symbol exists before using it:**
  - Users/auth: `listAdminUsers`, `AdminUserListItem`, `requireCapability`, `getActorRoleFromDb`, `can`, `createSupabaseServiceClient`, `createSupabaseAuthClient`, `invalidateUserClaims`, `invalidateUserProfileCache`, `revokeUserSessions`, `scheduleAudit`, `withApiRoute`, `withNoStore`.
  - Lists: `buildGroupedRows`, `deriveOperationsView`, `getResourceRequestsFor`.
  - Shell: `AppFooterNav`, `LogsNewPageClient`.
- **No DB migration.** `user_profiles.must_change_password` already exists. **Never run `npm run db:migrate`.**
- **Never log, audit, cache or return a password.**
- Follow repo conventions:
  - Routes: `withApi` / `withApiRoute` + `withNoStore`, `ERROR_CODES`, and the stateful actor-role re-check (`getActorRoleFromDb`).
  - Client: SWR `useApiResult`, `requestJson`, `sonner` toasts.
  - Styling: `card-standard` / `input-standard`, design tokens (`bg-surface-container-*`, `text-on-surface*`, `border-outline*`), `lucide-react` icons.
- Tests first for logic and routes: failing test → fix → green. Commit each task on its own.
- DB tests: `npx vitest --run --no-file-parallelism --testTimeout=30000` (shared prod DB).
- Manual testing of reset/change password: **only on a throwaway test account**, never a real user.

---

## 1. Problems

1. **The Users tab is hard to use.**
   - The rarely used create form takes the top half of the page.
   - The account list has no search, filters or counts.
   - Status ("temp password pending") is a tiny text suffix.
   - Your own row isn't marked.
2. **There is no way to reset a user's password.** A locked-out user today needs a direct Supabase dashboard edit.
3. **Nobody can change their password voluntarily.** `/auth/change-password` exists, but **no UI links to it**. Users only get there when forced after a temp password, and its copy ("Your account was provisioned with a temporary password") is wrong for a voluntary change.
4. **Some lists aren't newest first.**
   - Category log lists show each day's entries oldest first.
   - All Operations orders a day's entries by type.
   - Field requests, resource requests and Approvals have **no order at all**.
5. **The "+" button always asks for the site**, even when the user is already inside one.

**Bug found while reading the code:** the create form checks `tempPassword.length < 8` on the client, but the server requires `min(10)` (`app/api/admin/users/route.ts`). An 8–9 character password passes the client check and then fails on the server.

---

## 2. Decisions (agreed 2026-09-22)

| # | Decision |
|---|---|
| D1 | Reset = **the admin sets a temp password and shares it by hand**. No email links for now. |
| D2 | An admin can reset **any admin or supervisor except themselves**. Their own password goes through **Change password**. |
| D3 | A reset **signs the user out on every device** and forces a password change at next sign-in (reusing the existing forced-change flow). |
| D4 | New capability `user:reset_password`, Admin only. |
| D5 | One password rule everywhere: **10–72 characters**, in one shared module. |
| D6 | **No "last sign-in" column.** It has no use until we have user deactivation (YAGNI). |
| D7 | Every log/entry list is **newest first by default, including inside each date**. If a page has a sort option and the user picks **Oldest**, the whole list flips, including inside each date. |
| D8 | Demoting an admin from the Users page asks for confirmation first, because it signs them out immediately. |
| D9 | The "+" button passes the current site when the user is inside `/app/sites/<id>/…`. The new-log page only accepts a site the user is allowed to log for. The **Change** button stays visible. |
| D10 | Change password rejects a new password that equals the current one. |

---

## 3. Users page redesign

### 3.1 Current code
| Piece | File |
|---|---|
| Page (SSR) | `app/app/admin/users/page.tsx`: `listAdminUsers(actorId)`, 404 for non-admins |
| Client | `app/app/admin/users/AdminUsersPageClient.tsx`: ~200 lines, one component |
| List query | `lib/db/queries/adminUsers.ts`: profiles + emails via `auth.admin.listUsers` |
| Create | `POST /api/admin/users` |
| Role change | `PATCH /api/admin/users/[id]/role` (last-admin guard, sign-out on demotion) |

### 3.2 Layout (desktop ≥ md)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ACCESS                                                               │
│ User management                                  [ + New account ]   │
│ Provision accounts, manage roles, reset passwords.                   │
│ 5 accounts · 4 admins · 1 supervisor · 0 pending setup               │
├──────────────────────────────────────────────────────────────────────┤
│ [🔍 Search email or designation…   ]  (All) (Admin) (Supervisor)      │
│                                        (Pending setup)               │
├──────────────────────────────────────────────────────────────────────┤
│ ACCOUNT                              ROLE           STATUS         ⋯ │
│ (PG) pgovind110896@gmail.com         [Admin ▾]      ✓ Active       ⋯ │
│ (BH) bharathariag15@gmail.com  You   Admin          ✓ Active       ⋯ │
│ (SP) shyamprasad145@yahoo.com        [Supervisor ▾] ◐ Pending setup ⋯ │
│      Supervisor                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Header**
- Eyebrow, title and description as now, plus a primary **New account** button.
- The stats line is plain text computed from the **full** list, not the filtered one.

**Toolbar**
- Search: email + designation, case-insensitive, client-side.
- Chips: All / Admin / Supervisor / Pending setup.
- Local state only. The list is small, so no URL state or server filtering.

**Table:** semantic `<table>` with `<th scope="col">`.

| Column | Contents |
|---|---|
| **Account** | Initials circle (2 letters from the email). Email, truncated, with `title`. Designation as a second line, left **empty** if missing (no "—"). **You** tag on the current user's row. If the email is missing, show the user id in monospace. |
| **Role** | Inline `<select>` as today. Demoting an admin shows a confirm: "This signs them out now. Continue?" (D8). On the **You** row the role is plain text. |
| **Status** | Icon + text, never color alone. ✓ **Active**, or ◐ **Pending setup** when `mustChangePassword` (tooltip: "Hasn't set their own password yet"). |
| **⋯** | Menu button (`aria-haspopup="menu"`). Other rows: **Reset password** (§4). **You** row: **Change password** → `/auth/change-password` (§5). |

**Sort:** rows sorted by email A→Z, with a missing email last.

### 3.3 Mobile (< md)
- One card per user:
  - Line 1: email + You tag.
  - Line 2: designation.
  - Line 3: role, status and ⋯.
- Chips scroll sideways. No page-level horizontal scroll.
- Check at 320 / 768 / 1024 / 1440 px.

### 3.4 Create account drawer
- **New account** opens a right-side drawer (full-screen sheet on mobile).
- Reuse the dialog pattern already used in `components/ui/motion.tsx` / `components/tools/ToolDrawer.tsx`: `role="dialog"`, `aria-modal`, focus on the first field, Esc closes, focus returns to the button.
- Fields are unchanged: Email *, Temp password *, Role *, Designation.
- The temp password uses the shared `TempPasswordField` (**Generate**, **Show/Hide**, **Copy**, hint "At least 10 characters.").
- **After success:** a confirmation step shows "Account created. Share this temp password with <email>:" + the password + Copy + **Done**. This replaces the toast. The password is shown once and cleared when the drawer closes.

### 3.5 States
- **Loading:** `loading.tsx` skeleton reshaped to header + table.
- **List error:** banner + **Retry** (`mutate()`).
- **No matches:** "No accounts match "abc"." + **Clear filters**.
- **Row saving:** only that row's role select is disabled, with a spinner.

### 3.6 Component split
New folder `components/admin-users/`:

| File | Responsibility |
|---|---|
| `adminUsersView.ts` | Pure: `filterUsers(users, query, filter)`, `userStats(users)`, `initialsFor(email)`, `sortUsers(users)` |
| `UsersHeader.tsx` | Title, stats line, New account button |
| `UsersToolbar.tsx` | Search + chips |
| `UsersTable.tsx` | Table / cards, empty + error states |
| `UserRow.tsx` | One row: avatar, role, status, ⋯ menu |
| `CreateUserDrawer.tsx` | Create form + confirmation step |
| `ResetPasswordDialog.tsx` | §4 |
| `TempPasswordField.tsx` | Input + Generate + Show/Hide + Copy (used by create + reset) |

- `AdminUsersPageClient.tsx` becomes the container: SWR list, working copy, `savingId`, filter state, open drawer/dialog.
- `page.tsx` passes `currentUserId={session.user.id}`.

---

## 4. Admin reset password

### 4.1 Admin flow
1. On another user's row: ⋯ → **Reset password**.
2. The dialog shows the user's email and a `TempPasswordField` **already filled with a generated password**.
3. Warning: "This signs them out on every device. They must set their own password the next time they sign in."
4. **Reset password**. While it runs: spinner, and Cancel/Esc are disabled.
5. **Success:**
   - The dialog switches to "Password reset. Share this temp password with <email>:" + password + Copy + **Done**.
   - The row updates to **Pending setup** locally, then SWR revalidates.
6. **Failure:** the error shows **inside** the dialog. The typed password is kept so the admin can retry.

**Accessibility:**
- `role="dialog"`, `aria-modal`, `aria-labelledby` (title), `aria-describedby` (warning).
- Focus is trapped. Initial focus goes on the password input. Focus returns to the ⋯ button on close.

The password lives only in component state and is cleared on close.

### 4.2 API — `POST /api/admin/users/[id]/reset-password`
New file `app/api/admin/users/[id]/reset-password/route.ts`, built with `withApiRoute<RouteCtx>` like the role route.

**Body (strict Zod):** `{ tempPassword }`, validated with the shared `passwordSchema` (10–72).

**Steps:**
1. `requireCapability(request, "user:reset_password")`. Returns 401/403.
2. Re-check the actor's role from the DB (`getActorRoleFromDb` + `can`). Returns 403.
3. Parse + validate the body. Returns 400.
4. `id === actorId` → **400** "Use Change password to update your own password".
5. Target must exist in `user_profiles`, else **404** "User not found".
6. `supabase.auth.admin.updateUserById(id, { password })`. On error → **400** with the GoTrue message (or **404** if GoTrue reports the user doesn't exist). **Stop: nothing else has changed.**
7. `UPDATE user_profiles SET must_change_password = true, updated_at = now() WHERE user_id = id`.
8. `invalidateUserClaims(id)` → `invalidateUserProfileCache(id, requestId)` → `revokeUserSessions(id)`.
9. `scheduleAudit({ action: "user.password_reset", resourceType: "user", resourceId: id, role: actorRole, allowed: true, metadata: {} })`. No password and no email.
10. **200** `{ userId: id, mustChangePassword: true }`. No password in the response.

**Why auth first, then the flag:** GoTrue and Postgres can't share a transaction.
- If step 7 fails after step 6 succeeded, the user has the new temp password but isn't forced to change it. That's the safe half-state. The route returns 500 and the admin retries (the route is idempotent).
- The reverse order could force a change to a password nobody knows.

### 4.3 Capability
- Add `"user:reset_password"` to the `Capability` union and to `ADMIN_CAPABILITIES` in `lib/auth/capabilities.ts`.
- Add a row to `.docs/2026-06-12-role-visibility-matrix.md`.

### 4.4 Security
- Same protections as the other admin write routes: capability + DB role re-check + `no-store`.
- Sessions are revoked immediately, so a stolen token can't survive a reset.
- No role change happens, and the target still has to choose their own password.
- Rate limiting on admin routes is **out of scope** (none exists today). Noted as a follow-up.

---

## 5. Change password for everyone

### 5.1 Entry points
- **Profile** (`app/app/profile/ProfilePageClient.tsx`): a new **Security** card above "Session Operations".
  - Text: "Change the password you use to sign in."
  - A **Change password** button linking to `/auth/change-password`.
- **Users page:** your own row's ⋯ → **Change password** (§3.2).

### 5.2 Page modes
Today `app/auth/change-password/page.tsx` is a client component with forced-only copy. Split it:
- `page.tsx` (server) reads the session, loads `user_profiles.must_change_password` for the user from the DB, and renders `ChangePasswordPageClient` with `forced: boolean`.
  - Read the **DB value, not the JWT claim**. The claim can be stale right after an admin reset.
- `ChangePasswordPageClient.tsx` is the current form, moved over, with copy that depends on `forced`:

| | Forced (`forced = true`) | Voluntary (`forced = false`) |
|---|---|---|
| Heading | Set a new password | Change password |
| Intro | You're using a temporary password. Choose a new one to continue. | Choose a new password for your account. |
| First field label | Current / temporary password | Current password |
| Way out | Sign out only (as today) | **Cancel** link → `/app/profile` |

Both modes show: "You'll be signed out on all devices and need to sign in again with your new password." That's what already happens.

### 5.3 API change — `app/api/auth/change-password/route.ts`
- Use the shared `passwordSchema` for `newPassword` (same 10–72 rule, no behaviour change).
- After re-authentication succeeds, if `newPassword === currentPassword` return **400** `VALIDATION_ERROR` "New password must be different from your current password" (D10).
  - Compare only *after* re-auth, so the check can't be used to guess the current password.
- The client form shows the same message before submitting.

---

## 6. Newest first on every list

### 6.1 Audit (2026-09-22)
| List | Source | Today | Action |
|---|---|---|---|
| Category log list | `components/operations/categoryView.ts` → `buildGroupedRows` | Oldest first inside each day | **Fix** |
| All Operations | `components/operations/allOperationsView.ts` → `deriveOperationsView` | Inside a day: grouped by type | **Fix** |
| Field requests | `app/app/requests/field/page.tsx`, `app/api/requests/field/route.ts`, `app/app/admin/approvals/page.tsx`: 3 copies of `db.select().from(fieldRequests)` | No `ORDER BY` | **Fix** |
| Resource requests | `lib/db/queries/resourceRequests.ts` → `getResourceRequestsFor` (Requests page + Approvals) | No `ORDER BY` | **Fix** |
| Transfers | `lib/db/queries/transfersList.ts`, `app/api/transfers/route.ts` | `desc(createdAt)` | OK |
| Live feed | `lib/db/queries/liveFeed.ts` + prepend on realtime | Newest first | OK |
| Notifications, dashboard | `desc(createdAt)` | Newest first | OK |
| Tools + tool movements | `lib/tools/query.ts` | `desc(createdAt)` | OK |
| Admin expenses | entries API, default sort = newest | Newest first | OK |
| Search | `lib/db/queries/search.ts` | Best match, then newest | OK, relevance ranking is intended |

### 6.2 Shared comparator
Add to `components/operations/entryFormat.tsx`, next to `entryDate` / `entryId`:

```ts
// Newest first: createdAt desc, then numeric id desc. A missing createdAt sorts as oldest.
export function compareNewestFirst(a: Entry, b: Entry, type: EntryType): number
```

Both log views use it. "Oldest" uses the negated result.

### 6.3 Category log list — `buildGroupedRows`
- Inside each date: `compareNewestFirst` for `newest` and the spend sorts; the reverse for `oldest`.
- Day group order is unchanged: by `sort`.
- ⚠ **Running totals:** the running-total loop walks `chronological` groups and then `group.rows` **in array order**. It currently relies on the rows being oldest first. After this change it must walk each group's rows **oldest first explicitly** (sort a copy ascending). A test must prove the running totals don't change.

### 6.4 All Operations — `deriveOperationsView`
- After grouping, sort each `DayGroup.rows` with `compareNewestFirst` on `row.entry`. Tiebreak on `SPEND_TYPES` index, then id, so the order is stable across types. Reverse for `oldest`.
- `dayTotal` / `grandTotal` don't depend on order.
- ⚠ **Do not reorder the flat `rows` array.** `boundaryIdsFor` reads the last row per type from it to build the load-more cursor. Only reorder the copies inside each day group.

### 6.5 Requests
- New `lib/db/queries/fieldRequests.ts` → `listFieldRequests()` = `db.select().from(fieldRequests).orderBy(desc(fieldRequests.createdAt), desc(fieldRequests.id))`.
  - Replace the 3 inline copies with it.
  - The single-row lookups in `app/api/requests/field/[id]/route.ts` stay as they are.
- `getResourceRequestsFor`: add the same `orderBy(desc(createdAt), desc(id))` to both branches.
- Both tables have `id` (identity) and `created_at`; the existing `*_created_idx` indexes are already `created_at desc`.

### 6.6 Not changed
Server entry query order (`entriesOrderTargets`) is already `(date, created_at, id)`, desc by default. Leave it; pagination depends on it.

---

## 7. "+" button skips site selection inside a site

### 7.1 Current code
- `components/app-shell/AppFooterNav.tsx`: the **New Log** "+" item always goes to `/app/logs/new`.
- `app/app/logs/new/page.tsx` already reads `?siteId=`. `LogsNewPageClient` starts on step 2 (pick an operation) when given one. The site page's own button already uses this (`SiteDetailPageClient.tsx:232`).
- `LogsNewPageClient` hides **Change** when `siteId` was passed.
- An invalid `siteId` still skips step 1 and shows an empty "Reporting from" banner (**existing bug**).

### 7.2 Changes
1. **New pure helper** `lib/nav/siteFromPath.ts` → `siteIdFromPath(pathname): string | null`.
   - Returns `<id>` for `/app/sites/<id>` and anything under it.
   - Returns `null` for `/app/sites`, `/app/sites/new` and every non-site path.
   - Check `app/app/sites/` for other non-id segments before writing (today: `new`).
2. **`AppFooterNav`:** the "+" href becomes `/app/logs/new?siteId=<id>` when `siteIdFromPath(pathname)` returns an id, otherwise `/app/logs/new`. The `key` stays stable (use the label, not the href).
3. **`app/app/logs/new/page.tsx`:** pass `siteId` to the client **only if it is in the user's `sites` list** (already loaded: all sites for admins, assigned sites for supervisors). Otherwise pass `undefined`, so the normal site picker shows. This fixes the empty-banner bug.
4. **`LogsNewPageClient`:** always show **Change** (remove the `!siteId` condition) (D9).

---

## 8. Task breakdown

Each task is test-first and committed on its own.

1. **Newest-first log views.**
   - `compareNewestFirst` + tests.
   - `buildGroupedRows` within-day order + running-total fix + tests.
   - `deriveOperationsView` within-day order + tests.
   - *Files:* `components/operations/entryFormat.tsx`, `categoryView.ts`, `allOperationsView.ts` + tests.
2. **Newest-first requests.**
   - `listFieldRequests()` + replace the 3 call sites.
   - `orderBy` in `getResourceRequestsFor`.
   - *Files:* `lib/db/queries/fieldRequests.ts` (new), `lib/db/queries/resourceRequests.ts`, `app/app/requests/field/page.tsx`, `app/api/requests/field/route.ts`, `app/app/admin/approvals/page.tsx` + tests.
3. **"+" skips site.**
   - `siteIdFromPath` + tests.
   - `AppFooterNav` href.
   - `logs/new` page validation.
   - Always show **Change**.
   - *Files:* `lib/nav/siteFromPath.ts` (new), `components/app-shell/AppFooterNav.tsx`, `app/app/logs/new/page.tsx`, `LogsNewPageClient.tsx`.
4. **Password policy.**
   - `lib/auth/passwordPolicy.ts`: `PASSWORD_MIN = 10`, `PASSWORD_MAX = 72`, `passwordSchema`.
   - Use it in `POST /api/admin/users` and `change-password`.
   - Fix the client's 8 → 10.
5. **Capability.** `user:reset_password` + test + role-matrix doc row.
6. **Reset route.** Route + full test matrix (§9).
7. **Change password.**
   - Server/client split of the page with `forced`.
   - Mode-dependent copy + Cancel.
   - Same-password check (API + client).
   - Profile **Security** card.
   - *Files:* `app/auth/change-password/page.tsx`, `ChangePasswordPageClient.tsx` (new), `app/api/auth/change-password/route.ts`, `app/app/profile/ProfilePageClient.tsx`.
8. **Users page split.** Move the current markup into `components/admin-users/*` + `adminUsersView.ts` with tests. The page must look **the same** after this step, to keep the review small.
9. **Users page redesign.**
   - Header + stats, toolbar, table/cards, You tag, status badges.
   - Demote confirmation, email sort.
   - Create drawer with `TempPasswordField` + confirmation step.
   - Reshaped `loading.tsx`.
10. **Reset dialog.** `ResetPasswordDialog` + ⋯ menu wiring + local status update + revalidate.
11. **Verify** (§9.2).

**Rollout:**
- No migration, no env change.
- Suggested PRs: **PR 1** = tasks 1–3 (lists + "+" button, low risk, ship first). **PR 2** = tasks 4–10.

**Rollback:** revert the PR. Users already reset remain in the normal "must change password" state, which the existing flow handles.

---

## 9. Testing

### 9.1 Automated
| Area | Cases |
|---|---|
| `compareNewestFirst` | later `createdAt` first; tie → higher id first; missing `createdAt` last |
| Category list | 2 entries on the same day → later first; `sort=oldest` → earlier first *and* oldest day first; **running totals equal today's values** for a 3-entry day |
| All Operations | labour 10:00 + material 15:00 on the same day → material first; `oldest` flips; day/grand totals unchanged; flat `rows` array not mutated |
| Requests | `listFieldRequests` and `getResourceRequestsFor` (both branches) return newest first |
| `siteIdFromPath` | `/app/sites/abc` → `abc`; `/app/sites/abc/operations/labour/x` → `abc`; `/app/sites` → null; `/app/sites/new` → null; `/app/dashboard` → null |
| New-log page | siteId not in the user's sites → picker shown; allowed siteId → step 2 |
| Password policy | 9 characters rejected, 10 accepted, 73 rejected, on create + reset + change |
| Capabilities | Admin has `user:reset_password`; Supervisor doesn't |
| Reset route | 401 no session; 403 capability; 403 stale DB role; 400 bad body; 400 self-reset; 404 no profile; GoTrue error → 400 **and flag not set, sessions not revoked**; happy path → `updateUserById`, flag set, claims + cache invalidated, sessions revoked, audit has no password, response has no password; DB update fails after GoTrue → 500 |
| Change password | same password → 400 (only after successful re-auth); wrong current password still 401 |
| Users view logic | search on email + designation (case-insensitive); each chip; stats from the full list; email sort with nulls last; initials |
| Temp password generator | length 14, only unambiguous characters (no `0 O 1 l I`) |

### 9.2 Verification before claiming done
- `npm run lint`
- `npx vitest --run --no-file-parallelism --testTimeout=30000`
- Manual click-through at 320 / 768 / 1440 px:
  - Users page.
  - Create drawer.
  - Reset dialog.
  - Profile → Change password (voluntary mode + Cancel).
  - "+" from Home vs from inside a site.
  - A category list with several entries on one day.
- Keyboard-only pass: Tab through the toolbar, table, ⋯ menu, dialog and drawer. Esc closes. Focus returns.
- End-to-end reset on a **throwaway test account**:
  1. Reset it.
  2. Its open session is signed out.
  3. Sign in with the temp password → forced to "Set a new password".
  4. Set a new one → sign in works.

---

## 10. Out of scope

- Email-based reset links (D1).
- Last sign-in column, deactivate/delete user, editing designation from the list (D6).
- Bulk actions, pagination, server-side user search.
- Rate limiting admin routes.
- Changing search result ranking.

---

## 11. Implementation notes (2026-09-22)

**Verification**
- `npx vitest --run` with `DATABASE_URL` set to an unreachable placeholder: **939 passed, 0 failed, 61 skipped**.
  - The skips are the DB integration suites (`describeDb`), the same set as the baseline run (baseline: 873 passed, 61 skipped).
  - **No test touched the production DB.**
- `npm run lint` (tsc): clean.
- **Not done:** manual browser click-through and the keyboard pass (§9.2). This needs a signed-in admin and a throwaway test account.

**Where the build differs from the plan (same behaviour)**
- **⋯ menu:** reuses the existing `components/catalog/RowActionsMenu.tsx` instead of a new menu. It gained one improvement: focus returns to the ⋯ button on Escape or when an item is picked, so the reset dialog can hand focus back to it.
- **Drawer and dialog:** both are built on `ModalShell`. It gained two optional props, `ariaLabelledBy` and `overlayClassName` (`justify-end` for the drawer). The existing callers are unchanged.
- **⋯ menu layer:** uses `z-[60]` (the `--z-dropdown` token), enforced by `tests/ui/z-index.test.ts`.
- **Request ordering tests:** `lib/db/queries/requestOrdering.test.ts` uses drizzle's `pg-proxy` driver to check the generated SQL. No connection is opened.
- **Resource-requests API:** `GET /api/requests/resource` had its own unordered copy of the query. It now calls `getResourceRequestsFor`, so page and API share one ordered query.
- **Sorting helper:** `compareNewestFirst(a, b)` takes no `type` argument. It only needs `createdAt` and `id`.
- **Change-password page:** decides forced vs voluntary from `getUserProfile` (cached, and invalidated by reset/change). If no profile is found it treats the change as forced.

**New files**
- `lib/auth/passwordPolicy.ts`
- `lib/nav/siteFromPath.ts`
- `lib/db/queries/fieldRequests.ts`
- `app/api/admin/users/[id]/reset-password/route.ts`
- `app/auth/change-password/ChangePasswordPageClient.tsx`
- `app/auth/change-password/changePasswordForm.ts`
- `components/admin-users/`: `adminUsersView.ts`, `tempPassword.ts`, `TempPasswordField.tsx`, `CreateUserDrawer.tsx`, `ResetPasswordDialog.tsx`, `UsersHeader.tsx`, `UsersToolbar.tsx`, `UsersTable.tsx`, `UserRow.tsx`, `useReturnFocus.ts`
- Tests: `passwordPolicy`, `siteFromPath`, `requestOrdering`, `reset-password/route`, `changePasswordForm`, `adminUsersView`, `tempPassword` (the React components have no test setup in this repo).

**Fixes after first device test (2026-09-22)**
- **⋯ menu clipped on the last card:** `.card-standard` has `overflow: hidden`.
  - The Accounts card now uses `overflow-visible`.
  - `RowActionsMenu` opens upward when there isn't room above the bottom nav (`components/catalog/menuPlacement.ts`, tested).
- **Chips and emails on mobile:** filter chips wrap instead of scrolling sideways; emails wrap on the mobile cards.
- **"Reset password" only opened the keyboard.** Two causes, both in `useBackDismiss`:
  1. The effect depended on `onClose`, so every re-render with a new inline `onClose` re-attached. The re-attach ran `history.back()`, and its async `popstate` closed the dialog.
  2. React Strict Mode (on by default in dev) mounts effects as attach → detach → attach, which triggered the same `history.back()` for a dialog that mounts already open.
  - **Fix:** the wiring moved into `lib/nav/backDismiss.ts` (tested with a fake window). `onClose` is read through a ref, and the pop on detach waits one tick; a re-attach within that tick cancels it.
  - This also protects every other `ModalShell` and drawer that passes an inline `onClose`.
- **Reset dialog focus:** initial focus is on the action button, so the keyboard doesn't cover the sheet on phones. `useReturnFocus` uses the same one-tick delay.
- Tests after these fixes: **948 passed, 0 failed, 61 skipped** (DB suites), with the placeholder DB. tsc clean.
