import type { ReactNode } from "react";
import { MapPin } from "lucide-react";

// "Reporting from <site>" — shown on both steps of the log flow (category
// picker and entry form) so users always know which site they're logging for.
// No hooks: renders from server and client components alike.
export function ReportingFromCard({
  site,
  action,
}: {
  site: { name: string; location: string } | null;
  action: ReactNode;
}) {
  return (
    <div
      className={`card-standard p-4 ${site ? "border-sky-500/10 bg-sky-500/5" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              site ? "bg-sky-500/10 border-sky-500/20" : "bg-white/5 border-white/5"
            }`}
          >
            <MapPin className={`w-5 h-5 ${site ? "text-sky-400" : "text-slate-500"}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Reporting From</p>
            {site ? (
              <>
                <p className="text-sm font-bold text-white truncate">
                  {site.name}
                </p>
                <p className="text-xs text-slate-500 italic truncate">
                  {site.location}
                </p>
              </>
            ) : (
              <p className="text-sm font-bold text-slate-300">No site selected</p>
            )}
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}
