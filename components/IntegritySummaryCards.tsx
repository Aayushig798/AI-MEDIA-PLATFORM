import Link from "next/link";
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, Ruler, Link2, Satellite } from "lucide-react";
import type { ProjectFacts } from "@/lib/reports/factAssembly";

/** Dashboard section: Integrity Engine verdicts, ledger status and measured change. */
export function IntegritySummaryCards({ facts, projectId }: { facts: ProjectFacts; projectId: string }) {
  const i = facts.integrity;
  const cards = i
    ? [
        { label: "Verified evidence", value: i.verified, Icon: ShieldCheck, cls: "text-emerald-300 border-emerald-500/30" },
        { label: "Awaiting review", value: i.awaitingReview, Icon: ShieldAlert, cls: "text-amber-300 border-amber-500/30" },
        { label: "Flagged (excluded)", value: i.flagged, Icon: ShieldX, cls: "text-rose-300 border-rose-500/30" },
        { label: "Not yet screened", value: i.unverified, Icon: ShieldQuestion, cls: "text-slate-300 border-white/10" },
      ]
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 glass-panel rounded-2xl p-5 border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Proof-of-Impact integrity</h3>
          {i?.averageTrustScore != null && (
            <span className="text-xs text-slate-400">
              Average Trust Score <span className="font-bold text-white">{i.averageTrustScore}</span>
            </span>
          )}
        </div>
        {i ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {cards.map(({ label, value, Icon, cls }) => (
              <div key={label} className={`rounded-xl border bg-slate-900/50 p-3 ${cls}`}>
                <Icon className="w-4 h-4 mb-1" />
                <p className="text-2xl font-black tabular-nums text-white">{value}</p>
                <p className="text-[11px]">{label}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Integrity data needs the PostgreSQL database.</p>
        )}
        {i && (i.humanApproved > 0 || i.humanRejected > 0) && (
          <p className="text-[11px] text-slate-400">
            Reviewers approved {i.humanApproved} and rejected {i.humanRejected} asset{i.humanRejected === 1 ? "" : "s"}.
          </p>
        )}
        {facts.ledger && (
          <p className={`text-[11px] flex items-center gap-1.5 ${facts.ledger.chainIntact ? "text-emerald-300" : "text-rose-300"}`}>
            <Link2 className="w-3.5 h-3.5" />
            {facts.ledger.projectEntries} ledger entries for this project · hash chain {facts.ledger.chainIntact ? "intact" : "BROKEN"}
            <Link href={`/ledger?projectId=${projectId}`} className="ml-1 underline text-slate-300">
              inspect
            </Link>
          </p>
        )}
      </div>

      <div className="lg:col-span-5 glass-panel rounded-2xl p-5 border border-white/5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Ruler className="w-4 h-4 text-emerald-400" /> Measured change
        </h3>
        {facts.measuredChanges.length === 0 ? (
          <p className="text-xs text-slate-500">
            No measurements yet. Open a saved before/after comparison and choose &ldquo;Measure &amp; reel&rdquo;.
          </p>
        ) : (
          <ul className="space-y-2">
            {facts.measuredChanges.map((m) => (
              <li key={m.comparisonId} className="rounded-xl border border-white/5 bg-slate-900/50 p-3">
                <Link href={`/projects/${projectId}/compare/${m.comparisonId}`} className="block">
                  <p className="text-xs text-slate-400">
                    {m.metric === "GREEN_COVER" ? "Green cover" : "Water area"}
                    {m.location ? ` · ${m.location}` : ""} · {m.beforeDate} → {m.afterDate}
                  </p>
                  <p className="text-lg font-black text-white tabular-nums">
                    {m.beforePct}% → {m.afterPct}%{" "}
                    <span className={m.deltaPp >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      ({m.deltaPp > 0 ? "+" : ""}
                      {m.deltaPp} pp)
                    </span>
                  </p>
                  {m.satellite && (
                    <p className={`text-[11px] flex items-center gap-1 ${m.satellite.agrees ? "text-violet-300" : "text-rose-300"}`}>
                      <Satellite className="w-3 h-3" /> Sentinel-2 {m.satellite.index.toUpperCase()} {m.satellite.before} → {m.satellite.after}
                      {m.satellite.agrees ? " agrees" : " disagrees"}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
