"use client";

import { useEffect } from "react";

import { dedupeUnitOptionsByName, displayUnitName } from "@/lib/catalog/units";
import { useApiResult } from "@/lib/http/useApiQuery";
import { notifyError } from "@/lib/ui/toast";
import { Select } from "@/components/ui/Select";

export type UnitOption = {
  unitId: string;
  label: string;
  mode: "master" | "custom";
  name: string;
};

type MasterUnit = {
  unitId: string;
  code: string;
  label: string;
  isActive: boolean;
};

type CustomUnit = {
  unitId: string;
  name: string;
  symbol: string | null;
  isActive: boolean;
};

type Props = {
  label: string;
  value: UnitOption | null;
  onChange: (value: UnitOption | null) => void;
  required?: boolean;
  allowedNames?: string[];
};

export function UnitSelect({ label, value, onChange, required, allowedNames }: Props) {
  // Unit catalogs change rarely — cache + dedupe so reopening the form is instant.
  const { data: masterRes } = useApiResult<MasterUnit[]>("/api/catalog/units/master");
  const { data: customRes } = useApiResult<CustomUnit[]>("/api/catalog/units/custom");
  const loading = !masterRes || !customRes;
  const masterUnits = masterRes?.ok ? masterRes.data.filter((unit) => unit.isActive) : [];
  const customUnits = customRes?.ok ? customRes.data.filter((unit) => unit.isActive) : [];

  useEffect(() => {
    if (masterRes && !masterRes.ok) notifyError(masterRes);
  }, [masterRes]);
  useEffect(() => {
    if (customRes && !customRes.ok) notifyError(customRes);
  }, [customRes]);

  const options: UnitOption[] = dedupeUnitOptionsByName([
    ...masterUnits.map((unit) => ({
      unitId: unit.unitId,
      label: displayUnitName(unit.label),
      mode: "master" as const,
      name: displayUnitName(unit.label),
    })),
    ...(allowedNames?.length ? [] : customUnits.map((unit) => ({
      unitId: unit.unitId,
      label: displayUnitName(unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name),
      mode: "custom" as const,
      name: displayUnitName(unit.name),
    }))),
  ].filter((unit) => !allowedNames?.length || allowedNames.includes(unit.name)));

  useEffect(() => {
    if (!value || !allowedNames?.length) return;
    if (!allowedNames.includes(value.name)) onChange(null);
  }, [allowedNames, onChange, value]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-slate-400">
        {label}
        {required && " *"}
      </label>
      <Select
        value={value ? `${value.mode}:${value.unitId}` : ""}
        onChange={(next) => {
          const nextValue = options.find(
            (option) => `${option.mode}:${option.unitId}` === next,
          ) ?? null;
          onChange(nextValue);
        }}
        required={required}
        disabled={loading}
        label={label}
        aria-label={label}
        options={[
          { value: "", label: loading ? "Loading…" : "Select…" },
          ...options.map((option) => ({
            value: `${option.mode}:${option.unitId}`,
            label: option.label,
          })),
        ]}
      />
    </div>
  );
}
