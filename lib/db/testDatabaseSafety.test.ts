import { describe, expect, it } from "vitest";
import { isDisposableTestDatabase } from "./testDatabaseSafety";

describe("database write tests cannot reach client data", () => {
  it("permits only the named disposable loopback database", () => {
    expect(
      isDisposableTestDatabase(
        "postgres://test@127.0.0.1:55439/siteops_tools_test",
      ),
    ).toBe(true);
    expect(
      isDisposableTestDatabase(
        "postgres://test@localhost:55439/siteops_tools_test",
      ),
    ).toBe(true);
  });
  it.each([
    undefined,
    "",
    "not-a-url",
    "postgres://client@db.example.com/siteops_tools_test",
    "postgres://client@127.0.0.1/siteops",
    "postgres://client@localhost/postgres",
    "postgres://client@127.0.0.1/siteops_tools_test?host=production.example.com",
    "postgres://test@db.example.com,localhost@127.0.0.1/siteops_tools_test",
    "postgres://test@db.example.com%2Clocalhost@127.0.0.1/siteops_tools_test",
    "postgres://test@db.example.com@127.0.0.1/siteops_tools_test",
  ])("refuses a shared or ambiguous database: %s", (url) => {
    expect(isDisposableTestDatabase(url)).toBe(false);
  });
});
