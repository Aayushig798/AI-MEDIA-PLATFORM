"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, Loader2, ChevronDown, History, Fingerprint, Link2, Info } from "lucide-react";
import { ChainVerifier } from "@/components/ChainVerifier";
import { PageHeader, SectionHeader, IconChip } from "@/components/ui";

const STEPS = [
  {
    icon: Fingerprint,
    tone: "emerald" as const,
    title: "Every event is written down",
    text: "Uploads, checks, reviews and reports are recorded as they happen, each with its own fingerprint.",
  },
  {
    icon: Link2,
    tone: "sky" as const,
    title: "Each entry is linked to the last",
    text: "Changing any past entry would break every entry after it. The check above recomputes them all in your browser.",
  },
  {
    icon: Lock,
    tone: "emerald" as const,
    title: "Seals lock it in",
    text: "“Seal new entries” combines everything since the last seal into one fingerprint you can publish, so even a full rewrite shows.",
  },
];

function LedgerExplorer() {
  const projectId = useSearchParams().get("projectId") ?? undefined;
  const [anchoring, setAnchoring] = useState(false);
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);

  const anchor = async () => {
    setAnchoring(true);
    const res = await fetch("/api/ledger/anchor", { method: "POST" });
    const data = await res.json();
    setMessage(
      data.anchor
        ? `Sealed entries #${data.anchor.fromSeq}–#${data.anchor.toSeq}. Seal fingerprint: ${data.anchor.root}. Publish this fingerprint (for example in a public repository) so that even a full rewrite of the history can be detected.`
        : data.message || data.error
    );
    setAnchoring(false);
    setVersion((v) => v + 1);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tamper-evident record"
        icon={History}
        title="Audit trail"
        description="A tamper-evident record of every upload, check and report."
        actions={
          <button
            type="button"
            onClick={anchor}
            disabled={anchoring}
            className="btn btn-primary"
            title="Locks in all entries added since the last seal with a single fingerprint you can publish, so no one can quietly rewrite them later."
          >
            {anchoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Seal new entries
          </button>
        }
      />

      {message && (
        <div className="card animate-fade-in flex items-start gap-3 p-4">
          <IconChip icon={Lock} tone="emerald" size="sm" />
          <p className="min-w-0 pt-1 text-sm leading-relaxed text-zinc-700 [overflow-wrap:anywhere]">{message}</p>
        </div>
      )}

      <ChainVerifier key={version} projectId={projectId} title={projectId ? "Entries for this project" : "All entries"} />

      <section className="space-y-4">
        <SectionHeader
          icon={Info}
          tone="zinc"
          title="How the audit trail works"
          description="Why you can trust that nothing here was changed after the fact."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="card relative overflow-hidden p-5">
              <span className="pointer-events-none absolute right-4 top-3 text-4xl font-semibold tabular-nums text-zinc-100">
                {i + 1}
              </span>
              <div className="relative space-y-3">
                <IconChip icon={step.icon} tone={step.tone} />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-900">{step.title}</p>
                  <p className="text-[13px] leading-relaxed text-zinc-500">{step.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <details className="card group overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-medium text-zinc-700 transition hover:text-zinc-900 [&::-webkit-details-marker]:hidden">
            Technical details
            <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" />
          </summary>
          <div className="space-y-2 border-t border-zinc-100 px-5 py-4 text-[13px] leading-relaxed text-zinc-600">
            <p>
              Entries can only be added, never changed. Each one stores a fingerprint (SHA-256 hash) of its own content and of the
              entry before it, so editing any past entry breaks every fingerprint after it. The check above recomputes them all in
              your browser.
            </p>
            <p>
              Sealing combines all new entries into one fingerprint (a Merkle root). Publishing it somewhere public makes even a
              complete rewrite of the history detectable.
            </p>
            <p>
              Edited copies of photos are labelled as either <span className="font-medium text-zinc-800">transcoded</span> (only
              size, format or quality changed, so still valid evidence) or{" "}
              <span className="font-medium text-zinc-800">edited</span> (illustrative only), following Cloudinary&apos;s Content
              Credentials vocabulary.
            </p>
          </div>
        </details>
      </section>
    </div>
  );
}

export default function LedgerPage() {
  return (
    <Suspense>
      <LedgerExplorer />
    </Suspense>
  );
}
