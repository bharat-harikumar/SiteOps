import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

// Native <select>, date inputs, checkboxes and radios render the browser's own
// widgets: a white Android list over the dark app, the phone's own calendar.
// The shared replacements live in components/ui (Select, DatePicker, Checkbox,
// Radio, Toggle). This fence stops the native versions creeping back in.
function walkFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) continue;
    for (const name of readdirSync(next)) {
      if (name === ".next" || name === "node_modules" || name === ".git") continue;
      const abs = path.join(next, name);
      if (statSync(abs).isDirectory()) { stack.push(abs); continue; }
      if (!/\.tsx$/.test(name) || /\.test\.tsx$/.test(name)) continue;
      out.push(abs);
    }
  }
  return out;
}

// The shared components wrap the native checkbox/radio input on purpose (for
// its form semantics), restyled with appearance-none.
const ALLOWED = ["components/ui/Checkbox.tsx"];

const NATIVE = [
  { name: "<select>", pattern: /<select\b/ },
  { name: 'type="date"', pattern: /type=(["']date["']|\{[^}]*["']date["'])/ },
  { name: 'type="checkbox"', pattern: /type=["']checkbox["']/ },
  { name: 'type="radio"', pattern: /type=["']radio["']/ },
];

describe("native form controls", () => {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const files = ["app", "components"].flatMap((part) => {
    try { return walkFiles(path.join(repoRoot, part)); } catch { return []; }
  });

  test.each(NATIVE)("no $name outside components/ui", ({ pattern }) => {
    const offenders: string[] = [];
    for (const file of files) {
      const relative = path.relative(repoRoot, file);
      if (ALLOWED.includes(relative)) continue;
      readFileSync(file, "utf8").split("\n").forEach((line, index) => {
        if (line.trim().startsWith("//")) return;
        if (pattern.test(line)) offenders.push(`${relative}:${index + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
