import { desc } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { fieldRequests } from "@/lib/db/schema";

type Executor = Pick<typeof db, "select">;

// Every field-request list (requests page, approvals page, GET API) reads
// through here so they all show the newest request first.
export async function listFieldRequests(executor: Executor = db) {
  return executor
    .select()
    .from(fieldRequests)
    .orderBy(desc(fieldRequests.createdAt), desc(fieldRequests.id));
}
