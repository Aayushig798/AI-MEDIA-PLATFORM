import Link from "next/link";
import { ChevronRight, Droplets, History, Leaf, Ruler, Satellite, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import type { ProjectFacts } from "@/lib/reports/factAssembly";
import { IconChip, Ring, SectionHeader, cx } from "@/components/ui";

/** Dashboard section: verification results, audit record status and measured change. */
export function IntegritySummaryCards({ facts, projectId }: { facts: ProjectFacts; projectId: string }) {
  const i = facts.integrity;
  const cards = i
    ? [
        { label: "Verified", value: i.verified, dot: "bg-emerald-500", hint: null },
        { label: "Needs review", value: i.awaitingReview, dot: "bg-amber-500", hint: null },
        { label: "Flagged", value: i.flagged, dot: "bg-red-500", hint: "Left out of reports" },
        { label: "Unverified", value: i.unverified, dot: "bg-zinc-300", hint: "Not checked yet" },
      ]
    : [];
  const total = cards.reduce((s, c) => s + c.value, 0);
  const verifiedPct = i && total > 0 ? Math.round((i.verified / total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <section className="card flex flex-col lg:col-span-7">
        <div className="p-5">
          <SectionHeader
            icon={ShieldCheck}
            tone="emerald"
            title="Verification"
            description="Results of the checks on this project's photos and videos."
            actions={
              i?.averageTrustScore != null ? (
                <span className="badge badge-neutral">
                  Average trust score <span className="font-semibold tabular-nums text-zinc-900">{i.averageTrustScore}/100</span>
                </span>
              ) : undefined
            }
          />
        </div>

        {i ? (
          <div className="flex flex-1 flex-col gap-6 px-5 pb-5 sm:flex-row sm:items-center">
            <div className="flex shrink-0 justify-center">
              <Ring value={verifiedPct} size={128} stroke={11} tone="emerald">
                <div className="text-center">
                  <p className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-zinc-900">{verifiedPct}%</p>
                  <p className="mt-1 text-xs text-zinc-500">verified</p>
                </div>
              </Ring>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              {total > 0 && (
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-100" aria-hidden>
                  {cards.map(({ label, value, dot }) =>
                    value > 0 ? (
                      <div
                        key={label}
                        className={cx("h-full border-r-2 border-white last:border-r-0", dot)}
                        style={{ width: `${(value / total) * 100}%` }}
                        title={`${label}: ${value}`}
                      />
                    ) : null,
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {cards.map(({ label, value, dot, hint }) => (
                  <div key={label} className="rounded-xl bg-zinc-50/80 px-3 py-2.5 ring-1 ring-inset ring-zinc-200/70">
                    <p className="flex items-center gap-1.5 text-[13px] text-zinc-500">
                      <span className={`h-2 w-2 rounded-full ${dot}`} />
                      {label}
                    </p>
                    <p className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-semibold tabular-nums tracking-tight text-zinc-900">{value}</span>
                      {total > 0 && (
                        <span className="text-xs tabular-nums text-zinc-400">{Math.round((value / total) * 100)}%</span>
                      )}
                    </p>
                    {hint && <p className="text-xs text-zinc-400">{hint}</p>}
                  </div>
                ))}
              </div>

              {(i.humanApproved > 0 || i.humanRejected > 0) && (
                <p className="flex items-center gap-2 text-xs text-zinc-500">
                  <Users className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  Reviewers approved {i.humanApproved} and rejected {i.humanRejected} item{i.humanRejected === 1 ? "" : "s"}.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="px-5 pb-5 text-sm text-zinc-500">Verification results are not available in this setup.</p>
        )}

        {facts.ledger && (
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-zinc-100 bg-zinc-50/60 px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <IconChip icon={facts.ledger.chainIntact ? History : ShieldAlert} tone={facts.ledger.chainIntact ? "emerald" : "red"} size="sm" />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-900">
                  Audit record
                  <span className={`badge ${facts.ledger.chainIntact ? "badge-green" : "badge-red"}`}>
                    {facts.ledger.chainIntact ? "No tampering found" : "Tampering detected"}
                  </span>
                </p>
                <p className="text-xs tabular-nums text-zinc-500">{facts.ledger.projectEntries} entries for this project</p>
              </div>
            </div>
            <Link href={`/ledger?projectId=${projectId}`} className="btn btn-secondary btn-sm">
              View record
            </Link>
          </div>
        )}
      </section>

      <section className="card flex flex-col lg:col-span-5">
        <div className="p-5">
          <SectionHeader
            icon={Ruler}
            tone="emerald"
            title="Measured change"
            description="Green cover or water area measured in each pair."
            actions={
              facts.measuredChanges.length > 0 ? (
                <span className="badge badge-neutral tabular-nums">{facts.measuredChanges.length}</span>
              ) : undefined
            }
          />
        </div>
        {facts.measuredChanges.length === 0 ? (
          <div className="mx-5 mb-5 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-5 py-8 text-center">
            <Ruler className="h-5 w-5 text-zinc-400" />
            <p className="mt-2 max-w-xs text-sm text-zinc-500">
              No measurements yet. Open a saved before-and-after comparison to measure the change.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
            {facts.measuredChanges.map((m) => {
              const green = m.metric === "GREEN_COVER";
              return (
                <li key={m.comparisonId} className="last:overflow-hidden last:rounded-b-2xl">
                  <Link
                    href={`/projects/${projectId}/compare/${m.comparisonId}`}
                    className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-50"
                  >
                    <IconChip icon={green ? Leaf : Droplets} tone={green ? "emerald" : "sky"} size="md" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-xs text-zinc-500">
                        {green ? "Green cover" : "Water area"}
                        {m.location ? ` · ${m.location}` : ""} · {m.beforeDate} → {m.afterDate}
                      </p>
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold tabular-nums text-zinc-900">
                        {m.beforePct}% → {m.afterPct}%
                        <span
                          className={cx(
                            "rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                            m.deltaPp >= 0
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
                              : "bg-red-50 text-red-700 ring-red-600/15",
                          )}
                        >
                          {m.deltaPp > 0 ? "+" : ""}
                          {m.deltaPp} points
                        </span>
                      </p>
                      {m.satellite && (
                        <p
                          className={`flex items-center gap-1 text-xs ${m.satellite.agrees ? "text-emerald-700" : "text-amber-700"}`}
                          title={`Sentinel-2 ${m.satellite.index.toUpperCase()} ${m.satellite.before} → ${m.satellite.after}`}
                        >
                          <Satellite className="h-3 w-3" />
                          {m.satellite.agrees ? "Satellite imagery agrees" : "Satellite imagery disagrees"}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
