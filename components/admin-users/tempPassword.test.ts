import { describe, expect, it } from "vitest";

import { PASSWORD_MIN } from "@/lib/auth/passwordPolicy";

import { TEMP_PASSWORD_ALPHABET, generateTempPassword } from "./tempPassword";

describe("generateTempPassword", () => {
  it("is 14 characters, above the policy minimum", () => {
    const pw = generateTempPassword();
    expect(pw).toHaveLength(14);
    expect(pw.length).toBeGreaterThanOrEqual(PASSWORD_MIN);
  });

  it("uses only characters that are easy to read aloud", () => {
    for (let i = 0; i < 50; i += 1) {
      for (const ch of generateTempPassword()) expect(TEMP_PASSWORD_ALPHABET).toContain(ch);
    }
    expect(TEMP_PASSWORD_ALPHABET).not.toMatch(/[0O1lI]/);
  });

  it("differs between calls", () => {
    expect(generateTempPassword()).not.toBe(generateTempPassword());
  });
});
