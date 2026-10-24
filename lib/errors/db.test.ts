import { describe, expect, it } from "vitest";

import { CatalogChangedError } from "@/lib/catalog/lockCatalogMembers";
import { handleDbError } from "@/lib/errors/db";

describe("handleDbError", () => {
  it("turns a numeric overflow into a 400 instead of an unhandled 500", async () => {
    const res = handleDbError({ code: "22003", message: "numeric field overflow" }, "req_1");
    expect(res?.status).toBe(400);
    expect((await res!.json()).error.message).toBe("Value is too large");
  });

  it("leaves unknown errors for the caller to rethrow", () => {
    expect(handleDbError({ code: "XX000" }, "req_1")).toBeNull();
  });

  it("turns a CatalogChangedError into a 409 asking the user to pick the item again", async () => {
    const res = handleDbError(new CatalogChangedError("Work Stage", "Lintel Level"), "req_1");
    expect(res?.status).toBe(409);
    expect((await res!.json()).error.message).toMatch(/Work Stage "Lintel Level" was just renamed or removed/);
  });
});
