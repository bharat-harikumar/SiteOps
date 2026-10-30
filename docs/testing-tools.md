# Testing tools inventory safely

The project's `.env.local` points at real client data. Do not seed, migrate, restore, or run write tests against it.

Database tests now accept only a loopback PostgreSQL URL whose database is named `siteops_tools_test`. Ordinary database-backed suites skip other databases. Explicit tool integration runs fail before querying if their URL is unsafe. Browser fixtures also require the isolated app on `127.0.0.1:3107`.

## Create an empty disposable database

With local PostgreSQL binaries installed, run from the repository root. These example ports and directories are dedicated to tests, and use no production credentials:

```sh
initdb -D /tmp/siteops-tools-test-db -A trust -U siteops_test --encoding=UTF8 --no-locale
pg_ctl -D /tmp/siteops-tools-test-db -l /tmp/siteops-tools-test-db.log -o '-h 127.0.0.1 -p 55439 -k /tmp' start
createdb -h 127.0.0.1 -p 55439 -U siteops_test siteops_tools_test
export SITEOPS_SCRATCH_DB_URL='postgres://siteops_test@127.0.0.1:55439/siteops_tools_test'
DATABASE_URL="$SITEOPS_SCRATCH_DB_URL" DIRECT_URL="$SITEOPS_SCRATCH_DB_URL" npx drizzle-kit push --force
psql "$SITEOPS_SCRATCH_DB_URL" -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm'
```

The schema push above is only for the empty local test database. The normal migration command remains disabled for the live project.

## Run checks

```sh
npm run lint
DATABASE_URL="$SITEOPS_SCRATCH_DB_URL" TOOLS_IT_DB=1 npm test -- --no-file-parallelism
SITEOPS_SCRATCH_DB_URL="$SITEOPS_SCRATCH_DB_URL" npx playwright test --config=e2e/tools.config.ts
```

Run the full database suite sequentially: existing restore tests take table-wide locks and cannot share their scratch database with other test files concurrently. The movement race tests still deliberately use multiple connections inside their own cases.

The browser configuration starts a separate app and a loopback signing-key fixture. It exercises the normal JWT verification path with fictional test identities; it does not provision Supabase users or use the production auth service. Fixtures clean up only their own rows. Do not run the database suite and browser suite against the same scratch database simultaneously.

For the production service-worker check, build using local-only placeholders for services that the build requires, then run the anonymous cache test:

```sh
DATABASE_URL="$SITEOPS_SCRATCH_DB_URL" NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:55440' NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='local-test-only' UPSTASH_REDIS_REST_URL='http://127.0.0.1:55441' UPSTASH_REDIS_REST_TOKEN='local-test-only' npm run build
SITEOPS_TOOLS_PRODUCTION=1 SITEOPS_SCRATCH_DB_URL="$SITEOPS_SCRATCH_DB_URL" npx playwright test --config=e2e/tools.config.ts
```

Those placeholders are test settings, not deployment settings. The cache test checks that an older persisted inventory response is used neither online nor offline. Real installed-device behavior still requires testing on the device.

Stop the disposable instance when finished:

```sh
pg_ctl -D /tmp/siteops-tools-test-db stop
```
