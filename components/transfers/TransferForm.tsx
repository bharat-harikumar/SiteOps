'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useNavRouter } from '@/lib/nav/useNavRouter';
import { ArrowRightLeft, MapPin, Truck, Package, Users, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { notifyError } from '@/lib/ui/toast';

import { UnitSelect, type UnitOption } from '@/components/logs/UnitSelect';
import { requestJson } from '@/lib/http/client';
import { useCatalogNames } from '@/lib/catalog/useCatalogNames';
import { filterToAllowedCanonical } from '@/lib/catalog/selectors';
import { labourDefaultTypes, materialDefaultTypes } from '@/lib/validation/schemas';
import { Select } from "@/components/ui/Select";

export type TransferSiteOption = {
  siteId: string;
  name: string;
  location?: string;
};

type Props = {
  sites: TransferSiteOption[];
  defaultFromSiteId?: string;
  onSuccess?: () => void;
};

type ResourceType = 'Labour' | 'Materials';

export function TransferForm({ sites, defaultFromSiteId, onSuccess }: Props) {
  const router = useNavRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Live catalog instead of hardcoded option lists, so transfers stay in sync
  // with the admin-managed Labour/Materials types. Transfers still write pg-enum
  // columns, so filter to enum-accepted values until the enum→varchar migration.
  const { names: labourCatalog, loading: labourLoading } = useCatalogNames('Labour');
  const { names: materialCatalog, loading: materialLoading } = useCatalogNames('Materials');
  const labourWorkTypes = filterToAllowedCanonical(labourCatalog, labourDefaultTypes);
  const materialTypes = filterToAllowedCanonical(materialCatalog, materialDefaultTypes);

  const [fromSiteId, setFromSiteId] = useState(defaultFromSiteId || '');
  const [toSiteId, setToSiteId] = useState('');
  const [resourceType, setResourceType] = useState<ResourceType>('Materials');
  const [workTypeEnum, setWorkTypeEnum] = useState<string>('');
  const [materialTypeEnum, setMaterialTypeEnum] = useState<string>('');
  const [unit, setUnit] = useState<UnitOption | null>(null);
  const [quantity, setQuantity] = useState('');
  const [remarks, setRemarks] = useState('');

  // Default the selection to the first catalog option once it loads, without
  // clobbering a choice the user already made.
  useEffect(() => {
    if (!workTypeEnum && labourWorkTypes.length) setWorkTypeEnum(labourWorkTypes[0]);
  }, [labourWorkTypes, workTypeEnum]);
  useEffect(() => {
    if (!materialTypeEnum && materialTypes.length) setMaterialTypeEnum(materialTypes[0]);
  }, [materialTypes, materialTypeEnum]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!fromSiteId || !toSiteId) {
      toast.error('Select both sites');
      return;
    }
    if (fromSiteId === toSiteId) {
      toast.error('Source and destination sites must differ');
      return;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Quantity must be positive');
      return;
    }

    if (resourceType === 'Labour' && !workTypeEnum) {
      toast.error('Select a work type');
      return;
    }
    if (resourceType === 'Materials' && !materialTypeEnum) {
      toast.error('Select a material type');
      return;
    }

    if (resourceType === 'Materials' && !unit) {
      toast.error('Select a unit for material transfers');
      return;
    }

    const payload: Record<string, unknown> = {
      fromSiteId,
      toSiteId,
      resourceType,
      quantity: qty,
      remarks: remarks || undefined,
    };

    if (resourceType === 'Labour') {
      payload.workTypeMode = 'default_enum';
      payload.workTypeEnum = workTypeEnum;
    } else {
      payload.materialTypeMode = 'default_enum';
      payload.materialTypeEnum = materialTypeEnum;
      // The guard above returns before this branch when no unit is picked.
      payload.unitMode = unit!.mode;
      if (unit!.mode === 'master') payload.unitMasterId = unit!.unitId;
      else payload.unitCustomId = unit!.unitId;
    }

    setIsLoading(true);
    const res = await requestJson<{ transferId: string }>('/api/transfers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setIsLoading(false);

    if (!res.ok) {
      notifyError(res);
      return;
    }

    toast.success('Transfer request submitted');
    if (onSuccess) onSuccess();
    else router.replace(`/app/sites/${fromSiteId}`);
  }

  return (
    <div className="max-w-2xl mx-auto pt-4 pb-20 px-4">
      <div className="mb-8">
        <h3 className="text-xl font-semibold tracking-tight text-white">Transfer resources</h3>
        <p className="text-sm text-slate-500 font-medium">Move labour or materials from one site to another</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="card-standard p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            <div className="space-y-2">
              <label htmlFor="transfer-from-site" className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 ml-1">
                From site
              </label>
              <div className="relative">
                <Select
                  id="transfer-from-site"
                  required
                  value={fromSiteId}
                  onChange={setFromSiteId}
                  triggerClassName="pl-10"
                  options={[
                    { value: "", label: "Select site" },
                    ...sites.map((s) => ({ value: s.siteId, label: s.name })),
                  ]}
                />
                <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div className="hidden md:flex absolute top-2/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-blue-500 text-slate-950 rounded-full items-center justify-center shadow-lg shadow-blue-500/20 border-4 border-slate-900">
              <ArrowRightLeft className="w-4 h-4" />
            </div>

            <div className="space-y-2">
              <label htmlFor="transfer-to-site" className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 ml-1">
                To site
              </label>
              <div className="relative">
                <Select
                  id="transfer-to-site"
                  required
                  value={toSiteId}
                  onChange={setToSiteId}
                  triggerClassName="pl-10"
                  options={[
                    { value: "", label: "Select site" },
                    ...sites.filter((s) => s.siteId !== fromSiteId).map((s) => ({ value: s.siteId, label: s.name })),
                  ]}
                />
                <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
              </div>
            </div>
          </div>

          <hr className="border-white/5" />

          <div className="space-y-3">
            {/* This labels a pair of toggle buttons, not a form control, so it
                is a group label rather than a <label htmlFor>. */}
            <p id="transfer-resource-type" className="text-xs font-semibold text-slate-500 ml-1">Resource Type</p>
            <div role="group" aria-labelledby="transfer-resource-type" className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setResourceType('Materials')}
                className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition text-xs font-semibold ${
                  resourceType === 'Materials' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-white/5 border-white/5 text-slate-500'
                }`}
              >
                <Package className="w-5 h-5" /> Material
              </button>
              <button
                type="button"
                onClick={() => setResourceType('Labour')}
                className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition text-xs font-semibold ${
                  resourceType === 'Labour' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-white/5 border-white/5 text-slate-500'
                }`}
              >
                <Users className="w-5 h-5" /> Workforce
              </button>
            </div>
          </div>

          {resourceType === 'Labour' ? (
            <div className="space-y-2">
              <label htmlFor="transfer-work-type" className="text-xs font-semibold text-slate-500 ml-1">Work Type</label>
              <Select
                id="transfer-work-type"
                value={workTypeEnum}
                onChange={setWorkTypeEnum}
                disabled={labourLoading}
                options={[
                  { value: "", label: labourLoading ? 'Loading…' : labourWorkTypes.length ? 'Select…' : 'No work types available' },
                  ...labourWorkTypes.map((v) => ({ value: v, label: v })),
                ]}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="transfer-material-type" className="text-xs font-semibold text-slate-500 ml-1">Material Type</label>
                <Select
                  id="transfer-material-type"
                  value={materialTypeEnum}
                  onChange={setMaterialTypeEnum}
                  disabled={materialLoading}
                  options={[
                    { value: "", label: materialLoading ? 'Loading…' : materialTypes.length ? 'Select…' : 'No material types available' },
                    ...materialTypes.map((v) => ({ value: v, label: v })),
                  ]}
                />
              </div>
              {/* UnitSelect renders its own label — no wrapper <label> here. */}
              <UnitSelect label="Unit" value={unit} onChange={setUnit} required />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2 md:col-span-1">
              <label htmlFor="transfer-quantity" className="text-xs font-semibold text-slate-500 ml-1">Quantity</label>
              <input id="transfer-quantity" type="number" inputMode="decimal" min="0" step="0.01" required value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input-standard" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label htmlFor="transfer-remarks" className="text-xs font-semibold text-slate-500 ml-1">Transfer Remarks</label>
              <textarea id="transfer-remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} className="input-standard min-h-[88px] resize-none" placeholder="Add loading/transport details..." />
            </div>
          </div>
        </section>

        <section className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            The transfer stays pending until an admin approves it
          </p>
        </section>

        <div className="pt-2">
          <button type="submit" disabled={isLoading} className="w-full btn-primary py-4">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Truck className="w-5 h-5 mr-2" />Request transfer</>}
          </button>
        </div>
      </form>
    </div>
  );
}
