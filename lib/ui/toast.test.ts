import { beforeEach, describe, expect, it, vi } from "vitest";

const { error } = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error, success: vi.fn() } }));

import { notifyError } from "./toast";

const fail = (code: string, message: string) =>
  ({ ok: false, kind: "api_error", code, message, endpoint: "/x", method: "PATCH", status: 400 }) as const;

describe("notifyError", () => {
  beforeEach(() => error.mockReset());

  it("shows the server's short reason for a validation error", () => {
    notifyError(fail("VALIDATION_ERROR", 'Invalid Work Stage: "Lintel Level"'));
    expect(error).toHaveBeenCalledWith('Invalid Work Stage: "Lintel Level"');
  });

  it("never shows a status code or the client's fallback text", () => {
    notifyError(fail("VALIDATION_ERROR", "Request failed with status 400"));
    expect(error).toHaveBeenCalledWith("Please check the form and try again.");
  });

  it("keeps the explicit override", () => {
    notifyError(fail("VALIDATION_ERROR", "Anything"), "Custom");
    expect(error).toHaveBeenCalledWith("Custom");
  });
});
