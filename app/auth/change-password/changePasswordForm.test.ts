import { describe, expect, it } from "vitest";

import { changePasswordCopy, validateChangePassword } from "./changePasswordForm";

describe("changePasswordCopy", () => {
  it("keeps the forced-change wording and offers no way back", () => {
    const copy = changePasswordCopy(true);
    expect(copy.heading).toBe("Set a new password");
    expect(copy.intro).toBe("You're using a temporary password. Choose a new one to continue.");
    expect(copy.currentLabel).toBe("Current / temporary password");
    expect(copy.canCancel).toBe(false);
  });

  it("uses voluntary wording with a way back to Profile", () => {
    const copy = changePasswordCopy(false);
    expect(copy.heading).toBe("Change password");
    expect(copy.intro).toBe("Choose a new password for your account.");
    expect(copy.currentLabel).toBe("Current password");
    expect(copy.canCancel).toBe(true);
  });
});

describe("validateChangePassword", () => {
  const ok = { current: "old-password-1", next: "new-password-1", confirm: "new-password-1" };

  it("accepts a valid change", () => {
    expect(validateChangePassword(ok)).toBeNull();
  });

  it("requires the current password", () => {
    expect(validateChangePassword({ ...ok, current: "" })).toBe("Enter your current password");
  });

  it("uses the shared 10-character minimum", () => {
    expect(validateChangePassword({ ...ok, next: "short-pw1", confirm: "short-pw1" })).toBe(
      "Password must be at least 10 characters",
    );
  });

  it("rejects a mismatched confirmation", () => {
    expect(validateChangePassword({ ...ok, confirm: "different-pw1" })).toBe("Passwords do not match");
  });

  it("rejects reusing the current password", () => {
    expect(validateChangePassword({ current: "same-password", next: "same-password", confirm: "same-password" })).toBe(
      "New password must be different from your current password",
    );
  });
});
