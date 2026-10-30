import { describe, expect, it } from "vitest";
import {
  quantityError,
  movementOutcome,
  movementSentence,
} from "./movementFormState";

describe("quantity entry", () => {
  it.each(["", "1.5", "-1", "1e2", "NaN", "Infinity", " 2"])(
    "preserves and rejects invalid input %s",
    (raw) => {
      expect(quantityError(raw, 10)).toBeTruthy();
    },
  );
  it("accepts the exact available quantity", () =>
    expect(quantityError("2", 2)).toBeNull());
  it("explains an oversized quantity", () =>
    expect(quantityError("5", 2)).toBe("Only 2 available."));
  it("rejects zero", () =>
    expect(quantityError("0", 10)).toBe("Enter at least 1."));
  it("permits zero opening stock only when explicitly requested", () => {
    expect(quantityError("0", 10, true)).toBeNull();
  });
});

describe("truthful movement feedback", () => {
  it("never treats a legacy HTTP 200 conflict as a saved movement", () => {
    expect(movementOutcome({ ok: true, data: { status: "conflict" } })).toBe(
      "review",
    );
  });
  it("reports a network failure as an uncertain result", () => {
    expect(
      movementOutcome({
        ok: false,
        kind: "network_error",
        endpoint: "/x",
        method: "POST",
        message: "Failed",
      }),
    ).toBe("unknown");
  });
  it("does not suggest replaying a server error with an uncertain commit", () => {
    expect(
      movementOutcome({
        ok: false,
        kind: "api_error",
        status: 500,
        endpoint: "/x",
        method: "POST",
        message: "Failed",
      }),
    ).toBe("unknown");
  });
  it("identifies a version conflict for review", () => {
    expect(
      movementOutcome({
        ok: false,
        kind: "api_error",
        status: 409,
        endpoint: "/x",
        method: "POST",
        message: "Changed",
      }),
    ).toBe("review");
  });
  it("reports only confirmed status ok as success", () =>
    expect(movementOutcome({ ok: true, data: { status: "ok" } })).toBe(
      "saved",
    ));
  it("names the actual source and destination", () => {
    expect(movementSentence("return", "Barrel", 1, "Kollam", "Godown")).toBe(
      "Return 1 × Barrel from Kollam to Godown.",
    );
  });
});
