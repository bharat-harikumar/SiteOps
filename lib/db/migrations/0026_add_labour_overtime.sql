-- Add optional labour overtime (OT) fields to labour_entries.
-- OT total is server-calculated (ot_people_count * ot_hours * ot_rate).
--
-- Idempotent + txn-wrapped (mirrors 0020/0022/0024/0025 procedure). Apply with:
--   psql "$DIRECT_URL" -f lib/db/migrations/0026_add_labour_overtime.sql
BEGIN;

ALTER TABLE "labour_entries" ADD COLUMN IF NOT EXISTS "ot_people_count" integer;
--> statement-breakpoint
ALTER TABLE "labour_entries" ADD COLUMN IF NOT EXISTS "ot_hours" numeric(6, 2);
--> statement-breakpoint
ALTER TABLE "labour_entries" ADD COLUMN IF NOT EXISTS "ot_rate" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "labour_entries" ADD COLUMN IF NOT EXISTS "ot_total_amount" numeric(12, 2);

COMMIT;
