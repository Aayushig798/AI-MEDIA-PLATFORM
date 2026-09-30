import { CircleCheck, TriangleAlert, CircleX, CircleMinus, OctagonAlert } from "lucide-react";

export interface CheckResultView {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail" | "skipped" | "error";
  penalty: number;
  confidence: "high" | "medium" | "low";
  summary: string;
  details?: Record<string, any>;
}

// Rendered from server pages too (e.g. /verify), so this file stays hook-free and
// doesn't import the client-only primitives in ./ui.
const STATUS = {
  pass: { Icon: CircleCheck, chip: "bg-emerald-50 text-emerald-600 ring-emerald-600/10", label: "Passed" },
  warn: { Icon: TriangleAlert, chip: "bg-amber-50 text-amber-600 ring-amber-600/15", label: "Needs review" },
  fail: { Icon: CircleX, chip: "bg-red-50 text-red-600 ring-red-600/10", label: "Failed" },
  skipped: { Icon: CircleMinus, chip: "bg-zinc-100 text-zinc-400 ring-zinc-900/5", label: "Skipped" },
  error: { Icon: OctagonAlert, chip: "bg-zinc-100 text-zinc-500 ring-zinc-900/5", label: "Could not run" },
};

const CONFIDENCE_LEVEL = { high: 3, medium: 2, low: 1 };

type GroupKey = "attention" | "passed" | "other";

function groupOf(status: CheckResultView["status"]): GroupKey {
  if (status === "fail" || status === "warn") return "attention";
  if (status === "pass") return "passed";
  return "other";
}

const GROUP_TITLES: Record<GroupKey, string> = {
  attention: "Needs attention",
  passed: "Passed",
  other: "Didn't run",
};

function CheckRow({ c, compact }: { c: CheckResultView; compact: boolean }) {
  const { Icon, chip, label } = STATUS[c.status] ?? STATUS.error;
  const muted = c.status === "skipped" || c.status === "error";
  const level = CONFIDENCE_LEVEL[c.confidence] ?? 0;

  return (
    <li className={`flex items-start gap-3 ${compact ? "py-2.5" : "px-4 py-3.5 sm:px-5"}`}>
      <span
        className={`mt-px inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset ${chip}`}
        title={label}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-medium leading-6 ${muted ? "text-zinc-500" : "text-zinc-900"}`}>{c.label}</p>
          {c.penalty > 0 && (
            <span
              className="mt-0.5 shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-red-700 ring-1 ring-inset ring-red-600/15"
              title="Points taken off the trust score"
            >
              −{c.penalty}
            </span>
          )}
        </div>
        {c.status === "error" ? (
          // Raw service errors (quotas, billing, stack traces) aren't meant for readers; keep them on hover.
          <p className="text-[13px] leading-relaxed text-zinc-400" title={c.summary}>
            This check couldn&apos;t run this time, so it doesn&apos;t affect the score.
          </p>
        ) : (
          <p className={`text-[13px] leading-relaxed ${muted ? "text-zinc-400" : "text-zinc-600"}`}>{c.summary}</p>
        )}
        {!muted && level > 0 && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-zinc-400" title="How sure this check is">
            <span className="flex items-end gap-0.5" aria-hidden>
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full ${i <= level ? "bg-zinc-400" : "bg-zinc-200"}`}
                  style={{ height: 4 + i * 2 }}
                />
              ))}
            </span>
            <span className="capitalize">{c.confidence}</span> confidence
          </p>
        )}
      </div>
    </li>
  );
}

/** Plain-language breakdown of every verification check, grouped and worst first. */
export function CheckList({ checks, compact = false }: { checks: CheckResultView[]; compact?: boolean }) {
  const order = { fail: 0, warn: 1, pass: 2, error: 3, skipped: 4 };
  const sorted = [...checks].sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));

  const groups = (["attention", "passed", "other"] as GroupKey[])
    .map((key) => ({ key, items: sorted.filter((c) => groupOf(c.status) === key) }))
    .filter((g) => g.items.length > 0);
  const showHeadings = groups.length > 1;

  const dotFor = (key: GroupKey, items: CheckResultView[]) =>
    key === "attention"
      ? items.some((c) => c.status === "fail")
        ? "bg-red-500"
        : "bg-amber-500"
      : key === "passed"
        ? "bg-emerald-500"
        : "bg-zinc-300";

  if (compact) {
    return (
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.key}>
            {showHeadings && (
              <p className="flex items-center gap-2 pb-0.5 text-xs font-medium text-zinc-500">
                <span className={`h-1.5 w-1.5 rounded-full ${dotFor(g.key, g.items)}`} />
                {GROUP_TITLES[g.key]}
                <span className="tabular-nums text-zinc-400">{g.items.length}</span>
              </p>
            )}
            <ul className="divide-y divide-zinc-100">
              {g.items.map((c) => (
                <CheckRow key={c.id} c={c} compact />
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {groups.map((g, i) => (
        <div key={g.key} className={i > 0 ? "border-t border-zinc-100" : undefined}>
          {showHeadings && (
            <p className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/70 px-4 py-2 text-xs font-medium text-zinc-500 sm:px-5">
              <span className={`h-1.5 w-1.5 rounded-full ${dotFor(g.key, g.items)}`} />
              {GROUP_TITLES[g.key]}
              <span className="tabular-nums text-zinc-400">{g.items.length}</span>
            </p>
          )}
          <ul className="divide-y divide-zinc-100">
            {g.items.map((c) => (
              <CheckRow key={c.id} c={c} compact={false} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
