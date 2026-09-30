"use client";

import { useEffect, useState } from "react";
import { Loader2, Copy, Check, ExternalLink, ChevronDown, Clapperboard, Sparkles, Info, QrCode } from "lucide-react";
import { SectionHeader, ErrorNote, cx } from "@/components/ui";

interface Reel {
  id: string;
  aspect: string;
  deliveryUrl: string;
  createdAt: string;
}

const FORMAT_LABEL: Record<string, string> = {
  "9:16": "Vertical",
  "1:1": "Square",
};

/** Cloudinary renders the spliced video on first request / eagerly; poll until it's ready. */
function ReelPlayer({ reel }: { reel: Reel }) {
  const [ready, setReady] = useState(false);
  const [waited, setWaited] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const poll = async () => {
      while (!cancelled && tries < 60) {
        tries++;
        const res = await fetch(reel.deliveryUrl, { method: "HEAD" }).catch(() => null);
        if (res?.ok) {
          if (!cancelled) setReady(true);
          return;
        }
        if (!cancelled) setWaited(tries * 5);
        await new Promise((r) => setTimeout(r, 5000));
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [reel.deliveryUrl]);

  const vertical = reel.aspect === "9:16";

  return (
    <div className={cx("w-full space-y-3", vertical ? "max-w-[240px]" : "max-w-[300px]")}>
      <div
        className={cx(
          vertical ? "aspect-[9/16]" : "aspect-square",
          "relative flex w-full items-center justify-center overflow-hidden rounded-2xl bg-zinc-950 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] ring-1 ring-black/10",
        )}
      >
        {ready ? (
          <video src={reel.deliveryUrl} controls playsInline className="h-full w-full bg-black object-contain" />
        ) : (
          <>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(139,92,246,0.25),transparent_65%)]" />
            <div className="relative flex flex-col items-center gap-3 p-4 text-center text-xs text-zinc-400">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
              </span>
              <span>
                <span className="block text-sm font-medium text-white">
                  Preparing video{waited ? <span className="tabular-nums text-zinc-400"> · {waited}s</span> : ""}
                </span>
                <span className="mt-0.5 block text-zinc-500">This can take a minute.</span>
              </span>
            </div>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-800">
          {FORMAT_LABEL[reel.aspect] ?? "Video"}
          <span className="badge badge-neutral tabular-nums">{reel.aspect}</span>
        </span>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(reel.deliveryUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="btn btn-ghost btn-sm"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </button>
          <a href={reel.deliveryUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </a>
        </div>
      </div>
    </div>
  );
}

export function ReelPanel({ comparisonId, reels: initial, hasMetric }: { comparisonId: string; reels: Reel[]; hasMetric: boolean }) {
  const [reels, setReels] = useState<Reel[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => setReels(initial), [initial]);

  const make = async (aspect: "9:16" | "1:1") => {
    try {
      setBusy(aspect);
      setError("");
      const res = await fetch(`/api/comparisons/${comparisonId}/reel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aspect }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to build reel");
      setReels((prev) => [data.reel, ...prev]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const latest = ["9:16", "1:1"].map((a) => reels.find((r) => r.aspect === a)).filter(Boolean) as Reel[];

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={Clapperboard}
        tone="violet"
        title={
          <span className="flex flex-wrap items-center gap-2">
            Short video
            <span className="badge badge-violet">
              <Sparkles className="h-3 w-3" /> Made automatically
            </span>
          </span>
        }
        description="A shareable clip of this before and after, ending with a QR code that links to the verification page."
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Create */}
          <div className="space-y-3 border-b border-zinc-100 bg-gradient-to-b from-violet-50/70 via-white to-white p-5 lg:border-b-0 lg:border-r">
            <p className="text-sm font-semibold text-zinc-900">Create a video</p>
            {(["9:16", "1:1"] as const).map((aspect) => {
              const vertical = aspect === "9:16";
              return (
                <button
                  key={aspect}
                  type="button"
                  onClick={() => make(aspect)}
                  disabled={busy !== null}
                  className="group flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-px hover:border-violet-300 hover:shadow-[0_8px_20px_-12px_rgba(109,40,217,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 disabled:pointer-events-none disabled:opacity-60"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-50 ring-1 ring-inset ring-violet-600/10 transition group-hover:bg-violet-100">
                    <span
                      className={cx(
                        "rounded-[4px] border-2 border-violet-500 bg-white",
                        vertical ? "h-8 w-[18px]" : "h-6 w-6",
                      )}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-zinc-900">
                      {vertical ? "Create vertical video" : "Create square video"}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      <span className="tabular-nums">{aspect}</span> · {vertical ? "best for phones" : "best for feeds"}
                    </span>
                  </span>
                  {busy === aspect && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-600" />}
                </button>
              );
            })}

            {!hasMetric && (
              <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-600/15">
                <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                Save a measurement first to include the measured change in the video.
              </p>
            )}
          </div>

          {/* Videos */}
          <div className="p-5">
            {latest.length > 0 ? (
              <div className="flex flex-wrap items-start gap-8">
                {latest.map((r) => (
                  <ReelPlayer key={r.id} reel={r} />
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-6 py-10 text-center">
                <div className="relative mb-4">
                  <div className="absolute inset-0 -m-3 rounded-full bg-violet-100/70 blur-xl" />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-[0_8px_24px_-10px_rgba(16,24,40,0.25)] ring-1 ring-zinc-200">
                    <Clapperboard className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-sm font-medium text-zinc-900">No videos yet</p>
                <p className="mt-1 text-sm text-zinc-500">Choose a format to create one.</p>
              </div>
            )}
          </div>
        </div>

        <details className="group border-t border-zinc-100">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <QrCode className="h-4 w-4 text-zinc-400" />
              What&apos;s in the video
            </span>
            <ChevronDown className="h-4 w-4 text-zinc-400 transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-4 text-xs leading-relaxed text-zinc-600">
            Title card, the before photo, the after photo, the measured change, field clips from the project, then a QR code to
            the verification page. The whole video is built by Cloudinary from a single URL, so no video editing is needed.
          </div>
        </details>
      </div>
    </section>
  );
}
