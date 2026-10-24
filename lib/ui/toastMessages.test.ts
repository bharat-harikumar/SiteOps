import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "@/lib/errors/codes";
import { friendlyErrorMessage, GENERIC_ERROR_COPY } from "./toastMessages";

describe("friendlyErrorMessage", () => {
  it("maps known codes to friendly copy", () => {
    expect(friendlyErrorMessage(ERROR_CODES.FORBIDDEN)).toMatch(/permission/i);
    expect(friendlyErrorMessage(ERROR_CODES.RATE_LIMITED)).toMatch(/too many/i);
  });

  it("falls back to the generic message for unknown/absent codes", () => {
    expect(friendlyErrorMessage(undefined)).toBe(GENERIC_ERROR_COPY);
    expect(friendlyErrorMessage("SOME_INTERNAL_CODE")).toBe(GENERIC_ERROR_COPY);
  });

  it("never returns a raw backend string", () => {
    // A DB constraint message must not pass through.
    expect(friendlyErrorMessage('duplicate key value violates unique constraint')).toBe(
      GENERIC_ERROR_COPY,
    );
  });

  describe("with a server message", () => {
    it("shows the server's short reason for validation and conflict errors", () => {
      expect(friendlyErrorMessage(ERROR_CODES.VALIDATION_ERROR, 'Invalid Work Stage: "Lintel Level"')).toBe(
        'Invalid Work Stage: "Lintel Level"',
      );
      expect(friendlyErrorMessage(ERROR_CODES.CONFLICT, "Another item with this name already exists")).toBe(
        "Another item with this name already exists",
      );
    });

    it("falls back to the friendly copy when the message says nothing specific", () => {
      expect(friendlyErrorMessage(ERROR_CODES.VALIDATION_ERROR, "One or more fields are invalid")).toBe(
        "Please check the form and try again.",
      );
      expect(friendlyErrorMessage(ERROR_CODES.VALIDATION_ERROR, "Request failed with status 400")).toBe(
        "Please check the form and try again.",
      );
      expect(friendlyErrorMessage(ERROR_CODES.VALIDATION_ERROR, "")).toBe("Please check the form and try again.");
    });

    it("does not show a long message", () => {
      expect(friendlyErrorMessage(ERROR_CODES.VALIDATION_ERROR, "x".repeat(121))).toBe(
        "Please check the form and try again.",
      );
    });

    it("never shows the message of any other code (server faults, auth, not-found)", () => {
      expect(friendlyErrorMessage(ERROR_CODES.INTERNAL_ERROR, 'duplicate key value violates "x_pkey"')).toBe(
        "Something went wrong — please try again.",
      );
      expect(friendlyErrorMessage(ERROR_CODES.UNAUTHORIZED, "jwt expired")).toMatch(/session has expired/);
    });
  });
});
