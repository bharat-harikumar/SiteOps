import { drizzle } from "drizzle-orm/pg-proxy";
import { describe, expect, it } from "vitest";

import * as schema from "@/lib/db/schema";
import { listFieldRequests } from "@/lib/db/queries/fieldRequests";
import { getResourceRequestsFor } from "@/lib/db/queries/resourceRequests";

// A proxy driver that records the SQL it is asked to run and returns no rows —
// no connection is ever opened, so these tests never touch a real database.
function recordingDb() {
  const statements: string[] = [];
  const db = drizzle(
    async (sql) => {
      statements.push(sql);
      return { rows: [] };
    },
    { schema },
  );
  return { db, statements };
}

describe("request lists are newest first", () => {
  it("orders field requests by created_at desc, then id desc", async () => {
    const { db, statements } = recordingDb();
    await listFieldRequests(db);
    expect(statements[0]).toMatch(/order by "field_requests"\."created_at" desc, "field_requests"\."id" desc/i);
  });

  it("orders every resource request newest first for an admin", async () => {
    const { db, statements } = recordingDb();
    await getResourceRequestsFor({ id: "u1", role: "Admin" }, db);
    expect(statements[0]).toMatch(/order by "resource_requests"\."created_at" desc, "resource_requests"\."id" desc/i);
  });

  it("orders a supervisor's own resource requests newest first", async () => {
    const { db, statements } = recordingDb();
    await getResourceRequestsFor({ id: "u1", role: "Supervisor" }, db);
    expect(statements[0]).toMatch(/where .*order by "resource_requests"\."created_at" desc, "resource_requests"\."id" desc/i);
  });
});
