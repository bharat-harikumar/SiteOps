-- Planned mason/helper person-days per site + split-labour work type
-- ("Masons deployed: 13 / 60" on the labour category page).
--
-- Idempotent + txn-wrapped (mirrors 0024/0025/0026). Apply BEFORE deploying the
-- code that reads it — backup/export walk every table in tableRegistry.ts:
--   npm run db:apply -- lib/db/migrations/0027_labour_targets.sql
BEGIN;

CREATE TABLE IF NOT EXISTS "labour_targets" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "site_id" uuid NOT NULL REFERENCES "sites"("site_id") ON DELETE CASCADE,
  "work_type" varchar(100) NOT NULL,
  "mason_target" integer,
  "helper_target" integer,
  "updated_by" uuid REFERENCES "user_profiles"("user_id") ON DELETE SET NULL,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "labour_targets_mason_target_range" CHECK ("mason_target" IS NULL OR "mason_target" BETWEEN 0 AND 100000),
  CONSTRAINT "labour_targets_helper_target_range" CHECK ("helper_target" IS NULL OR "helper_target" BETWEEN 0 AND 100000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "labour_targets_site_work_type_uq" ON "labour_targets" USING btree ("site_id", "work_type");

COMMIT;
