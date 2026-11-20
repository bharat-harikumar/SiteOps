"use client";

import { useState } from "react";

import { formatDeployed } from "@/components/operations/categoryView";
import type { LabourProgress } from "@/lib/db/queries/labourTargets";

type Props = { siteId: string; workType: string; initial: LabourProgress };

// "" → null (blank target); anything else is sent as a number and the API
// rejects non-integers / out-of-range values with a message shown inline.
const toPayload = (v: string) => (v.trim() === "" ? null : Number(v));
const toInput = (v: number | null) => (v == null ? "" : String(v));

// Masons/helpers deployed (person-days, all dates) against the planned target
// for one split-labour work type, with an inline editor for the target.
export default function ManpowerProgress({ siteId, workType, initial }: Props) {
  const [target, setTarget] = useState({ masonTarget: initial.masonTarget, helperTarget: initial.helperTarget });
  const [editing, setEditing] = useState(false);
  const [mason, setMason] = useState("");
  const [helper, setHelper] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTarget = target.masonTarget != null || target.helperTarget != null;

  function startEditing() {
    setMason(toInput(target.masonTarget));
    setHelper(toInput(target.helperTarget));
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${siteId}/labour-target`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workType, masonTarget: toPayload(mason), helperTarget: toPayload(helper) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? "Could not save the target. Try again.");
        return;
      }
      setTarget(json.data.target);
      setEditing(false);
    } catch {
      setError("Could not save the target. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-semibold text-slate-200">
            Masons deployed: {formatDeployed(initial.masons, target.masonTarget)}
          </p>
          <p className="text-sm font-semibold text-slate-200">
            Helpers deployed: {formatDeployed(initial.helpers, target.helperTarget)}
          </p>
          <p className="text-xs font-medium text-slate-500">counted per day, all dates</p>
        </div>
        {!editing ? (
          <button type="button" onClick={startEditing} className="btn-secondary min-h-11 px-4 text-xs">
            {hasTarget ? "Edit target" : "Set target"}
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-400">
              Mason target
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={mason}
                onChange={(e) => setMason(e.target.value)}
                className="input-standard mt-2 min-h-11 text-base"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-400">
              Helper target
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={helper}
                onChange={(e) => setHelper(e.target.value)}
                className="input-standard mt-2 min-h-11 text-base"
              />
            </label>
          </div>
          {error ? (
            <p role="alert" className="text-xs font-semibold text-red-400">{error}</p>
          ) : null}
          <div className="flex gap-3">
            <button type="button" onClick={save} disabled={saving} className="btn-primary min-h-11 px-5 text-xs">
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="btn-secondary min-h-11 px-5 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
