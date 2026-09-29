import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, AlertOctagon } from "lucide-react";

export interface CheckResultView {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail" | "skipped" | "error";
  penalty: number;
  confidence: "high" | "medium" | "low";
  summary: string;
  details?: Record<string, any>;
}

const STATUS = {
  pass: { Icon: CheckCircle2, cls: "text-emerald-400" },
  warn: { Icon: AlertTriangle, cls: "text-amber-400" },
  fail: { Icon: XCircle, cls: "text-rose-400" },
  skipped: { Icon: MinusCircle, cls: "text-slate-500" },
  error: { Icon: AlertOctagon, cls: "text-slate-400" },
};

/** Plain-language breakdown of every Integrity Engine check, worst first. */
export function CheckList({ checks, compact = false }: { checks: CheckResultView[]; compact?: boolean }) {
  const order = { fail: 0, warn: 1, pass: 2, error: 3, skipped: 4 };
  const sorted = [...checks].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <ul className="space-y-2">
      {sorted.map((c) => {
        const { Icon, cls } = STATUS[c.status];
        return (
          <li
            key={c.id}
            className={`flex items-start gap-2.5 rounded-xl border border-white/5 bg-slate-900/50 ${compact ? "p-2" : "p-3"}`}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cls}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-xs font-semibold text-slate-200">{c.label}</span>
                {c.penalty > 0 && <span className="text-[10px] font-bold text-rose-300">−{c.penalty}</span>}
                {c.status !== "skipped" && c.status !== "error" && (
                  <span className="text-[10px] text-slate-500">{c.confidence} confidence</span>
                )}
              </div>
              <p className={`text-[11px] leading-relaxed ${c.status === "skipped" ? "text-slate-500" : "text-slate-300"}`}>
                {c.summary}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
