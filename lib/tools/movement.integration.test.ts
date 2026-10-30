import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sites, userProfiles, tools, toolCategories, toolAssignments, toolMovements } from "@/lib/db/schema";
import { listToolMovements } from "./query";
import { createTool } from "./manage";
import { getSiteTools, listReceiveOptions, listSiteToolMovements } from "./siteQuery";
import { executeMovement } from "./movement";
import { applyOneTool } from "./applyBatch";
import { returnSiteToolsOnLifecycle } from "./siteLifecycle";
import { isDisposableTestDatabase } from "@/lib/db/testDatabaseSafety";
if (process.env.TOOLS_IT_DB === "1" && !isDisposableTestDatabase(process.env.DATABASE_URL)) {
  throw new Error("Tool write tests require the disposable local siteops_tools_test database.");
}
const IT = process.env.TOOLS_IT_DB === "1" ? describe : describe.skip;
IT("explicit movements on scratch database", () => {
  let owner: string, other: string, category: string, a: string, b: string, c: string;
  const ids: string[] = [];
  beforeAll(async () => {
    owner = crypto.randomUUID();
    other = crypto.randomUUID();
    await db.insert(userProfiles).values([{ userId: owner, role: "Supervisor", fullName: "Owner" }, { userId: other, role: "Supervisor" }]);
    [category] = (await db.insert(toolCategories).values({ name: `Movement ${owner}`, codePrefix: owner.slice(0, 8) }).returning()).map(x => x.categoryId);
    const rows = await db.insert(sites).values([owner, owner, other].map((supervisorId, i) => ({ name: `Movement ${owner} ${i}`, location: "scratch", supervisorId, createdByUserId: owner, updatedByUserId: owner }))).returning();
    [a, b, c] = rows.map(s => s.siteId);
  });
  afterAll(async () => {
    if (ids.length)
      await db.delete(tools).where(inArray(tools.toolId, ids));
    await db.delete(sites).where(inArray(sites.siteId, [a, b, c]));
    await db.delete(toolCategories).where(eq(toolCategories.categoryId, category));
    await db.delete(userProfiles).where(inArray(userProfiles.userId, [owner, other]));
  });
  async function fresh(total = 10) { const t = await createTool({ name: crypto.randomUUID(), categoryId: category, openingStock: total, actorUserId: owner }); ids.push(t.toolId); return t; }
  const actor = () => ({ id: owner, role: "Supervisor" as const });
  const send = (toolId: string, expectedVersion: number, targetSiteId = a, quantity = 4) => executeMovement({ toolId, expectedVersion, actor: actor(), action: { kind: "send_to_site", targetSiteId, quantity } });
  it("rejects missing sources and excessive returns without changing allocations", async () => {
    const t = await fresh();
    const deployed = await send(t.toolId, t.version);
    for (const kind of ["return_to_godown", "transfer_site"] as const) {
      await expect(executeMovement({ toolId: t.toolId, expectedVersion: deployed.version, actor: actor(), action: { kind, fromSiteId: a, targetSiteId: b, quantity: 5 } })).rejects.toMatchObject({ reason: "insufficient_source", available: 4 });
      await expect(executeMovement({ toolId: t.toolId, expectedVersion: deployed.version, actor: actor(), action: { kind, fromSiteId: b, targetSiteId: a, quantity: 1 } })).rejects.toMatchObject({ reason: "insufficient_source", available: 0 });
    }
    expect(await db.select({ siteId: toolAssignments.siteId, quantity: toolAssignments.quantity }).from(toolAssignments).where(eq(toolAssignments.toolId, t.toolId))).toEqual([{ siteId: a, quantity: 4 }]);
  });
  it("transfers between owned sites using one real transfer ledger row and preserves unrelated allocations", async () => {
    const t = await fresh();
    const first = await send(t.toolId, t.version);
    const unrelated = await executeMovement({ toolId: t.toolId, expectedVersion: first.version, actor: { id: owner, role: "Admin" }, action: { kind: "send_to_site", targetSiteId: c, quantity: 2 } });
    const moved = await executeMovement({ toolId: t.toolId, expectedVersion: unrelated.version, actor: actor(), action: { kind: "transfer_site", fromSiteId: a, targetSiteId: b, quantity: 3 } });
    expect(moved.assignments).toEqual(expect.arrayContaining([{ siteId: a, qty: 1 }, { siteId: b, qty: 3 }, { siteId: c, qty: 2 }]));
    const rows = await db.select().from(toolMovements).where(and(eq(toolMovements.toolId, t.toolId), eq(toolMovements.kind, "transfer")));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ fromLocation: a, toLocation: b, quantity: 3 });
  });
  it("rejects either unowned transfer endpoint and supervisor stock actions", async () => {
    const t = await fresh();
    const v = (await send(t.toolId, t.version)).version;
    for (const [fromSiteId, targetSiteId] of [[a, c], [c, a]])
      await expect(executeMovement({ toolId: t.toolId, expectedVersion: v, actor: actor(), action: { kind: "transfer_site", fromSiteId, targetSiteId, quantity: 1 } })).rejects.toMatchObject({ reason: "forbidden_site" });
    await expect(executeMovement({ toolId: t.toolId, expectedVersion: v, actor: actor(), action: { kind: "add_stock", quantity: 1 } })).rejects.toMatchObject({ reason: "forbidden_site" });
  });
  it("serializes simultaneous last item requests and repeated explicit versions", async () => {
    const t = await fresh(1);
    const results = await Promise.allSettled([send(t.toolId, t.version, a, 1), send(t.toolId, t.version, b, 1)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: { reason: "stale_version" } });
    await expect(send(t.toolId, t.version, a, 1)).rejects.toMatchObject({ reason: "stale_version" });
  });
  it("rolls back assignments and version when ledger insertion fails", async () => {
    const t = await fresh();
    await expect(executeMovement({ toolId: t.toolId, expectedVersion: t.version, actor: { id: crypto.randomUUID(), role: "Admin" }, action: { kind: "send_to_site", targetSiteId: a, quantity: 1 } })).rejects.toBeDefined();
    expect(await db.select().from(toolAssignments).where(eq(toolAssignments.toolId, t.toolId))).toHaveLength(0);
    expect((await db.select().from(tools).where(eq(tools.toolId, t.toolId)))[0].version).toBe(t.version);
  });
  it("rejects movement after site archive and correctly returns the committed quantity", async () => {
    const t = await fresh();
    await send(t.toolId, t.version, b, 3);
    await db.transaction(async (tx) => { await tx.update(sites).set({ archivedAt: new Date() }).where(eq(sites.siteId, b)); await returnSiteToolsOnLifecycle(tx, b, owner, "site_archived"); });
    await expect(send(t.toolId, t.version, b, 1)).rejects.toMatchObject({ reason: "site_unavailable" });
    const rows = await db.select().from(toolMovements).where(and(eq(toolMovements.toolId, t.toolId), eq(toolMovements.note, "site_archived")));
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(3);
    await db.update(sites).set({ archivedAt: null }).where(eq(sites.siteId, b));
  });
  it("legacy saves still report version conflicts", async () => {
    const t = await fresh();
    await send(t.toolId, t.version);
    expect(await applyOneTool({ toolId: t.toolId, version: t.version, assignments: [{ siteId: b, qty: 2 }] }, owner)).toMatchObject({ status: "conflict" });
  });
  it("scopes holdings, receive availability and historical labels without leaking allocations", async () => {
    const t = await fresh();
    const moved = await send(t.toolId, t.version, a, 4);
    const here = await getSiteTools(a, actor());
    expect(here.items.find(x => x.toolId === t.toolId)).toEqual({ toolId: t.toolId, name: t.name, categoryName: expect.any(String), quantityHere: 4, version: moved.version });
    expect((await listReceiveOptions(a, actor(), t.name)).find(x => x.toolId === t.toolId)).toEqual({ toolId: t.toolId, name: t.name, categoryName: expect.any(String), availableInGodown: 6, version: moved.version });
    await expect(getSiteTools(c, actor())).rejects.toMatchObject({ reason: "forbidden_site" });
    await executeMovement({ toolId: t.toolId, expectedVersion: moved.version, actor: { id: owner, role: "Admin" }, action: { kind: "transfer_site", fromSiteId: a, targetSiteId: c, quantity: 4 } });
    await db.update(tools).set({ isDeleted: true }).where(eq(tools.toolId, t.toolId));
    expect((await listToolMovements(t.toolId, 50, 0)).find(x => x.kind === "transfer")).toMatchObject({ actorName: "Owner" });
    const history = await listSiteToolMovements(a, actor(), { toolId: t.toolId, limit: 50, offset: 0 });
    const transfer = history.find(x => x.kind === "transfer");
    expect(transfer).toMatchObject({ toolName: t.name, from: { label: expect.any(String), href: `/app/sites/${a}/tools` }, to: { label: "Another site", href: null }, actorName: "Owner" });
    expect(JSON.stringify(history)).not.toContain(c);
    expect((await getSiteTools(a, actor())).items.some(x => x.toolId === t.toolId)).toBe(false);
  });
  async function waitForBlockedBy(pid: number) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const [row] = await db.execute<{
        blocked: boolean;
      }>(sql`select exists(select 1 from pg_stat_activity where ${pid}=any(pg_blocking_pids(pid))) as blocked`);
      if (row.blocked)
        return;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error("Expected database lock was not observed");
  }
  it("archive wins a site lock race before receiving", async () => {
    const t = await fresh();
    let release!: () => void;
    let ready!: (pid: number) => void;
    const gate = new Promise<void>(resolve => release = resolve);
    const locked = new Promise<number>(resolve => ready = resolve);
    const archive = db.transaction(async (tx) => {
      await tx.update(sites).set({ archivedAt: new Date() }).where(eq(sites.siteId, b));
      const [row] = await tx.execute<{
        pid: number;
      }>(sql`select pg_backend_pid() as pid`);
      ready(row.pid);
      await gate;
      await returnSiteToolsOnLifecycle(tx, b, owner, "site_archived");
    });
    const pid = await locked;
    const movement = send(t.toolId, t.version, b, 1).then(() => ({ reason: "unexpected_success" }), e => e);
    try {
      await waitForBlockedBy(pid);
    }
    finally {
      release();
    }
    await archive;
    expect(await movement).toMatchObject({ reason: "site_unavailable" });
    await db.update(sites).set({ archivedAt: null }).where(eq(sites.siteId, b));
  });
  it("movement wins the site lock race and archive returns exactly its committed quantity", async () => {
    const t = await fresh();
    let release!: () => void;
    let ready!: (pid: number) => void;
    const gate = new Promise<void>(resolve => release = resolve);
    const locked = new Promise<number>(resolve => ready = resolve);
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(tools).where(eq(tools.toolId, t.toolId)).for("update");
      const [row] = await tx.execute<{
        pid: number;
      }>(sql`select pg_backend_pid() as pid`);
      ready(row.pid);
      await gate;
    });
    const pid = await locked;
    const movement = send(t.toolId, t.version, b, 2);
    try {
      await waitForBlockedBy(pid);
    }
    catch (e) {
      release();
      await blocker;
      throw e;
    }
    // The movement already holds its site share lock while waiting for the tool.
    const archive = db.transaction(async (tx) => {
      await tx.update(sites).set({ archivedAt: new Date() }).where(eq(sites.siteId, b));
      await returnSiteToolsOnLifecycle(tx, b, owner, "site_archived");
    });
    release();
    await blocker;
    await movement;
    await archive;
    expect(await db.select().from(toolAssignments).where(eq(toolAssignments.toolId, t.toolId))).toHaveLength(0);
    const returns = await db.select().from(toolMovements).where(and(eq(toolMovements.toolId, t.toolId), eq(toolMovements.note, "site_archived")));
    expect(returns).toHaveLength(1);
    expect(returns[0].quantity).toBe(2);
    await db.update(sites).set({ archivedAt: null }).where(eq(sites.siteId, b));
  });
  it("reassignment wins the site lock race and revokes the old supervisor", async () => {
    const t = await fresh();
    let release!: () => void;
    let ready!: (pid: number) => void;
    const gate = new Promise<void>(resolve => release = resolve);
    const locked = new Promise<number>(resolve => ready = resolve);
    const reassignment = db.transaction(async (tx) => {
      await tx.update(sites).set({ supervisorId: other }).where(eq(sites.siteId, b));
      const [row] = await tx.execute<{
        pid: number;
      }>(sql`select pg_backend_pid() as pid`);
      ready(row.pid);
      await gate;
    });
    const pid = await locked;
    const movement = send(t.toolId, t.version, b, 1).then(() => ({ reason: "unexpected_success" }), e => e);
    try {
      await waitForBlockedBy(pid);
    }
    finally {
      release();
    }
    await reassignment;
    expect(await movement).toMatchObject({ reason: "forbidden_site" });
    await db.update(sites).set({ supervisorId: owner }).where(eq(sites.siteId, b));
  });
  it("rejects revoked ownership between the guard and each scoped SQL statement",async()=>{
    const originalExecute=db.execute.bind(db);
    const reads=[()=>getSiteTools(a,actor()),()=>listReceiveOptions(a,actor()),()=>listSiteToolMovements(a,actor(),{limit:50,offset:0})];
    for(const read of reads){
      const spy=vi.spyOn(db,"execute").mockImplementationOnce(query=>{
        const raw=originalExecute(query);
        const executeRaw=raw.execute.bind(raw);
        raw.execute=async()=>{
          await db.update(sites).set({supervisorId:other}).where(eq(sites.siteId,a));
          return executeRaw();
        };
        return raw;
      });
      try{await expect(read()).rejects.toMatchObject({reason:"forbidden_site"});}
      finally{spy.mockRestore();await db.update(sites).set({supervisorId:owner}).where(eq(sites.siteId,a));}
    }
  });

  it("legacy save detects newly acquired allocation sites without taking reverse-order locks",async()=>{
    const t=await fresh();const deployed=await send(t.toolId,t.version,a,1);
    let release!:()=>void;let ready!:(pid:number)=>void;
    const gate=new Promise<void>(resolve=>release=resolve);const locked=new Promise<number>(resolve=>ready=resolve);
    const concurrent=db.transaction(async tx=>{
      await tx.select().from(sites).where(inArray(sites.siteId,[a,b])).orderBy(sites.siteId).for("update");
      const [row]=await tx.execute<{pid:number}>(sql`select pg_backend_pid() as pid`);ready(row.pid);await gate;
      await tx.select().from(tools).where(eq(tools.toolId,t.toolId)).for("update");
      await tx.insert(toolAssignments).values({toolId:t.toolId,siteId:b,quantity:1});
      await tx.update(tools).set({version:deployed.version+1}).where(eq(tools.toolId,t.toolId));
    });
    const pid=await locked;
    const saved=applyOneTool({toolId:t.toolId,version:deployed.version+1,assignments:[{siteId:a,qty:2}]},owner);
    try{await waitForBlockedBy(pid);}finally{release();}
    await concurrent;expect(await saved).toMatchObject({status:"conflict"});
    const rows=await db.select().from(toolAssignments).where(eq(toolAssignments.toolId,t.toolId));
    expect(rows.map(r=>({siteId:r.siteId,qty:r.quantity}))).toEqual(expect.arrayContaining([{siteId:a,qty:1},{siteId:b,qty:1}]));
  });

});
