import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { labourTargets } from "@/lib/db/schema";

export type LabourTarget = { masonTarget: number | null; helperTarget: number | null };
export type LabourProgress = LabourTarget & { masons: number; helpers: number };

type Executor = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

type RawRow = {
  masons: number | string | null;
  helpers: number | string | null;
  mason_target: number | string | null;
  helper_target: number | string | null;
};

const toTarget = (v: number | string | null) => (v == null ? null : Number(v));

// Person-days deployed across ALL entries for this site + exact work_type
// (the category page's own filter is eq(work_type)), independent of the page's
// date/stage filters and row cap, plus the planned target. The aggregate always
// yields one row; the target subselects hit labour_targets' unique index.
export async function getLabourProgress(
  siteId: string,
  workType: string,
  executor: Executor = db,
): Promise<LabourProgress> {
  const result = await executor.execute(sql`
    select coalesce(sum(mason_count), 0)::int as masons,
           coalesce(sum(helper_count), 0)::int as helpers,
           (select mason_target from labour_targets
             where site_id = ${siteId}::uuid and work_type = ${workType}) as mason_target,
           (select helper_target from labour_targets
             where site_id = ${siteId}::uuid and work_type = ${workType}) as helper_target
      from labour_entries
     where site_id = ${siteId}::uuid and work_type = ${workType}
  `);
  // postgres-js returns the rows array directly; other drivers wrap in { rows }.
  const rows = (Array.isArray(result) ? result : (result as { rows?: RawRow[] })?.rows ?? []) as RawRow[];
  const row = rows[0];
  return {
    masons: Number(row?.masons ?? 0),
    helpers: Number(row?.helpers ?? 0),
    masonTarget: toTarget(row?.mason_target ?? null),
    helperTarget: toTarget(row?.helper_target ?? null),
  };
}

// Atomic insert-or-replace keyed on (site_id, work_type): concurrent saves
// cannot create duplicates; the last write wins.
export async function upsertLabourTarget(input: {
  siteId: string;
  workType: string;
  masonTarget: number | null;
  helperTarget: number | null;
  userId: string;
}): Promise<LabourTarget> {
  const values = {
    masonTarget: input.masonTarget,
    helperTarget: input.helperTarget,
    updatedBy: input.userId,
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(labourTargets)
    .values({ siteId: input.siteId, workType: input.workType, ...values })
    .onConflictDoUpdate({ target: [labourTargets.siteId, labourTargets.workType], set: values })
    .returning({ masonTarget: labourTargets.masonTarget, helperTarget: labourTargets.helperTarget });
  return row;
}
