import { describe, expect, it } from "vitest";

import { PASSWORD_MAX, PASSWORD_MIN, isPasswordLongEnough, passwordSchema } from "./passwordPolicy";

describe("password policy", () => {
  it("is 10 to 72 characters (bcrypt hard-caps at 72 bytes)", () => {
    expect(PASSWORD_MIN).toBe(10);
    expect(PASSWORD_MAX).toBe(72);
  });

  it("rejects 9 characters", () => {
    expect(passwordSchema.safeParse("a".repeat(9)).success).toBe(false);
  });

  it("accepts 10 characters", () => {
    expect(passwordSchema.safeParse("a".repeat(10)).success).toBe(true);
  });

  it("rejects 73 characters", () => {
    expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);
  });

  it("gives the client the same length check as the server", () => {
    expect(isPasswordLongEnough("a".repeat(9))).toBe(false);
    expect(isPasswordLongEnough("a".repeat(10))).toBe(true);
  });
});
