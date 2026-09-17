import { describe, expect, it } from "vitest";

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
});
