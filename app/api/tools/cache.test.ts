import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as catalog } from "./route";
import { GET as tool } from "./[id]/route";
import { GET as dashboard } from "./dashboard/route";
import { GET as globalHistory } from "./movements/route";
import { GET as toolHistory } from "./[id]/movements/route";
import { GET as categories } from "./categories/route";
const mocks=vi.hoisted(()=>({auth:vi.fn(),rateLimit:vi.fn(),listTools:vi.fn(),getTool:vi.fn(),dashboardAggregates:vi.fn(),listGlobalMovements:vi.fn(),listToolMovements:vi.fn(),listCategories:vi.fn()}));
vi.mock("@/lib/auth/guards",()=>({requireCapability:mocks.auth}));
vi.mock("@/lib/rateLimit/guard",()=>({applyRateLimit:mocks.rateLimit}));
vi.mock("@/lib/tools/query",()=>({...mocks,clearToolMovements:vi.fn()}));
vi.mock("@/lib/tools/categories",()=>({listCategories:mocks.listCategories,createCategory:vi.fn()}));
const id=crypto.randomUUID();
const context={params:Promise.resolve({id})};
const cases=[
 {name:"catalog",handler:()=>catalog(new NextRequest("http://localhost/api/tools")),read:mocks.listTools},
 {name:"single tool",handler:()=>tool(new NextRequest(`http://localhost/api/tools/${id}`),context),read:mocks.getTool},
 {name:"dashboard",handler:()=>dashboard(new NextRequest("http://localhost/api/tools/dashboard")),read:mocks.dashboardAggregates},
 {name:"global history",handler:()=>globalHistory(new NextRequest("http://localhost/api/tools/movements")),read:mocks.listGlobalMovements},
 {name:"tool history",handler:()=>toolHistory(new NextRequest(`http://localhost/api/tools/${id}/movements`),context),read:mocks.listToolMovements},
 {name:"categories",handler:()=>categories(new NextRequest("http://localhost/api/tools/categories")),read:mocks.listCategories},
];
beforeEach(()=>{
 vi.resetAllMocks();mocks.auth.mockResolvedValue({session:{user:{id,role:"Admin"}}});mocks.rateLimit.mockResolvedValue(null);
 for(const c of cases)c.read.mockResolvedValue([]);
 mocks.getTool.mockResolvedValue({toolId:id});mocks.dashboardAggregates.mockResolvedValue({totalQuantity:0});
});
describe.each(cases)("private global tools GET: $name",({handler,read})=>{
 it("does not cache successful reads",async()=>{
  const response=await handler();expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");
 });
 it("does not cache forbidden responses",async()=>{
  mocks.auth.mockResolvedValue({error:"FORBIDDEN",status:403});const response=await handler();
  expect(response.status).toBe(403);expect(response.headers.get("cache-control")).toBe("private, no-store");expect(read).not.toHaveBeenCalled();
 });
 it("does not cache unexpected errors caught by the API wrapper",async()=>{
  read.mockRejectedValue(new Error("database unavailable"));const response=await handler();
  expect(response.status).toBe(500);expect(response.headers.get("cache-control")).toBe("private, no-store");
 });
 it("does not cache rate limits returned before authentication",async()=>{
  mocks.rateLimit.mockResolvedValue(new Response("limited",{status:429}));const response=await handler();
  expect(response.status).toBe(429);expect(response.headers.get("cache-control")).toBe("private, no-store");expect(mocks.auth).not.toHaveBeenCalled();
 });
});
