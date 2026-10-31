import { test as base, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { isDisposableTestDatabase } from "../../lib/db/testDatabaseSafety";

export const test = base.extend<{
  tools: {
    source: string;
    target: string;
    foreign: string;
    toolId: string;
    toolName: string;
    asAdmin: () => Promise<void>;
  };
}>({
  tools: async ({ context, baseURL }, use) => {
    if (baseURL !== "http://127.0.0.1:3107")
      throw new Error("Tools fixtures require the isolated local test server.");
    const database = process.env.SITEOPS_SCRATCH_DB_URL;
    if (!database) throw new Error("Disposable database required.");
    if (!isDisposableTestDatabase(database))
      throw new Error("Refusing non-disposable database.");
    const sql = postgres(database, { max: 1, prepare: false });
    const admin = randomUUID(),
      owner = randomUUID(),
      other = randomUUID(),
      category = randomUUID();
    const source = randomUUID(),
      target = randomUUID(),
      foreign = randomUUID(),
      toolId = randomUUID();
    const tag = toolId.slice(0, 8),
      toolName = `Barrel ${tag}`;
    const authorize = async (id: string, role: string) => {
      const response = await fetch(
        `http://127.0.0.1:55440/__fixture/token?id=${id}&role=${role}`,
      );
      const { token } = await response.json();
      await context.setExtraHTTPHeaders({ Authorization: `Bearer ${token}` });
    };
    try {
      await sql`insert into user_profiles(user_id,role,full_name) values (${admin},'Admin','Test Admin'),(${owner},'Supervisor','Anil Test'),(${other},'Supervisor','Other Test')`;
      await sql`insert into tool_categories(category_id,name,code_prefix) values (${category},${`Containers ${tag}`},${tag})`;
      for (const [id, name, supervisor] of [
        [source, `Kollam ${tag}`, owner],
        [target, `Kochi ${tag}`, owner],
        [foreign, `Foreign ${tag}`, other],
      ])
        await sql`insert into sites(site_id,name,location,supervisor_id,created_by_user_id,updated_by_user_id) values (${id},${name},'Test only',${supervisor},${admin},${admin})`;
      await sql`insert into tools(tool_id,name,code,category_id,total_quantity,created_by_user_id,updated_by_user_id) values (${toolId},${toolName},${`TEST-${tag}`},${category},6,${admin},${admin})`;
      await sql`insert into tool_assignments(tool_id,site_id,quantity) values (${toolId},${source},2)`;
      await authorize(owner, "Supervisor");
      await use({
        source,
        target,
        foreign,
        toolId,
        toolName,
        asAdmin: () => authorize(admin, "Admin"),
      });
    } finally {
      await sql`delete from tools where tool_id=${toolId}`;
      await sql`delete from sites where site_id in (${source},${target},${foreign})`;
      await sql`delete from tool_categories where category_id=${category}`;
      await sql`delete from user_profiles where user_id in (${admin},${owner},${other})`;
      await sql.end();
    }
  },
});
export { expect };
