import { describe, expect, it, vi } from "vitest";

import {
  HIDE_VALUES_BOOT_SCRIPT,
  HIDE_VALUES_KEY,
  applyHideValues,
  readHideValues,
  setHideValues,
  subscribeHideValues,
  writeHideValues,
} from "./privacy";

const throwingStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

function memoryStorage(initial: string | null) {
  let value = initial;
  return {
    getItem: vi.fn((key: string) => (key === HIDE_VALUES_KEY ? value : null)),
    setItem: vi.fn((_key: string, next: string) => {
      value = next;
    }),
    removeItem: vi.fn(() => {
      value = null;
    }),
  };
}

describe("readHideValues", () => {
  it("is on only for the exact stored value '1'", () => {
    expect(readHideValues(memoryStorage("1"))).toBe(true);
    expect(readHideValues(memoryStorage(null))).toBe(false);
    expect(readHideValues(memoryStorage("0"))).toBe(false);
    expect(readHideValues(memoryStorage("true"))).toBe(false);
  });

  it("defaults to off when storage is missing or throws", () => {
    expect(readHideValues(undefined)).toBe(false);
    expect(readHideValues(null)).toBe(false);
    expect(readHideValues(throwingStorage)).toBe(false);
  });
});

describe("writeHideValues", () => {
  it("stores '1' under the key when on and removes the key when off", () => {
    const storage = memoryStorage(null);
    writeHideValues(storage, true);
    expect(storage.setItem).toHaveBeenCalledWith("siteops:hide-values", "1");
    writeHideValues(storage, false);
    expect(storage.removeItem).toHaveBeenCalledWith("siteops:hide-values");
    expect(readHideValues(storage)).toBe(false);
  });

  it("never throws when storage is blocked", () => {
    expect(() => writeHideValues(throwingStorage, true)).not.toThrow();
    expect(() => writeHideValues(undefined, true)).not.toThrow();
  });
});

describe("applyHideValues", () => {
  it("sets and clears data-privacy on the root element", () => {
    const root = { dataset: {} as DOMStringMap };
    applyHideValues(root, true);
    expect(root.dataset.privacy).toBe("on");
    applyHideValues(root, false);
    expect("privacy" in root.dataset).toBe(false);
  });
});

describe("HIDE_VALUES_BOOT_SCRIPT", () => {
  function runBoot(storage: unknown) {
    const documentElement = { dataset: {} as DOMStringMap };
    new Function("localStorage", "document", HIDE_VALUES_BOOT_SCRIPT)(storage, {
      documentElement,
    });
    return documentElement.dataset;
  }

  it("applies the stored preference before first paint", () => {
    expect(runBoot(memoryStorage("1")).privacy).toBe("on");
    expect(runBoot(memoryStorage(null)).privacy).toBeUndefined();
  });

  it("does not throw when storage access is blocked", () => {
    expect(() => runBoot(throwingStorage)).not.toThrow();
    expect(runBoot(throwingStorage).privacy).toBeUndefined();
  });
});

describe("setHideValues / subscribeHideValues", () => {
  it("persists, applies to the root and notifies subscribers until unsubscribed", () => {
    const storage = memoryStorage(null);
    const root = { dataset: {} as DOMStringMap };
    const listener = vi.fn();
    const unsubscribe = subscribeHideValues(listener);

    setHideValues(true, { storage, root });
    expect(readHideValues(storage)).toBe(true);
    expect(root.dataset.privacy).toBe("on");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setHideValues(false, { storage, root });
    expect(root.dataset.privacy).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
