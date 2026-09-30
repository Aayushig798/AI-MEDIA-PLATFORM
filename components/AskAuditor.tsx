"use client";

import { useState } from "react";
import { Loader2, MessageCircle, Send, Sparkles } from "lucide-react";
import { IconChip, cx } from "./ui";

const SUGGESTIONS = [
  "Is there standing water behind the structure?",
  "Are the saplings protected by tree guards?",
  "Does anything suggest this photo was edited?",
];

/** Public "Ask the auditor" box: questions about one piece of evidence, answered by AI Vision. */
export function AskAuditor({ assetId }: { assetId: string }) {
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<{ q: string; a: string; error?: boolean }[]>([]);
  const [asking, setAsking] = useState(false);
  // Presentational only: the question currently waiting for an answer.
  const [pending, setPending] = useState<string | null>(null);

  const ask = async (q: string) => {
    if (!q.trim() || asking) return;
    setAsking(true);
    setPending(q);
    try {
      const res = await fetch(`/api/verify/${assetId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      setThread((t) => [...t, data.success ? { q, a: data.answer } : { q, a: data.error, error: true }]);
      setQuestion("");
    } catch {
      setThread((t) => [...t, { q, a: "The auditor could not be reached.", error: true }]);
    } finally {
      setAsking(false);
      setPending(null);
    }
  };

  return (
    <section className="card overflow-hidden">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-zinc-100 bg-gradient-to-br from-violet-50 via-white to-white px-5 py-4">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(rgba(124,58,237,0.10)_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(to_left,black,transparent)]" />
        <div className="relative flex items-start gap-3">
          <IconChip icon={Sparkles} tone="violet" />
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold tracking-tight text-zinc-900">Ask about this photo</h3>
              <span className="badge badge-violet">AI assistant</span>
            </div>
            <p className="text-sm text-zinc-500">
              An AI answers using the image and the check results above. It is an assistant, not a verdict.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* Conversation */}
        {(thread.length > 0 || pending) && (
          <ul className="space-y-4" aria-live="polite">
            {thread.map((t, i) => (
              <li key={i} className="space-y-2">
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-900 px-3.5 py-2 text-sm leading-relaxed text-white">
                    {t.q}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <IconChip icon={Sparkles} tone={t.error ? "red" : "violet"} size="sm" />
                  <p
                    className={cx(
                      "max-w-[85%] rounded-2xl rounded-tl-md px-3.5 py-2 text-sm leading-relaxed ring-1 ring-inset",
                      t.error ? "bg-red-50 text-red-700 ring-red-600/10" : "bg-zinc-50 text-zinc-700 ring-zinc-200/70",
                    )}
                  >
                    {t.a || "Something went wrong. Try asking again."}
                  </p>
                </div>
              </li>
            ))}
            {pending && (
              <li className="space-y-2">
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-900/80 px-3.5 py-2 text-sm leading-relaxed text-white">
                    {pending}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <IconChip icon={Sparkles} tone="violet" size="sm" />
                  <span
                    className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md bg-zinc-50 px-3.5 py-3 ring-1 ring-inset ring-zinc-200/70"
                    aria-label="The auditor is looking at the photo"
                  >
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className="h-1.5 w-1.5 rounded-full bg-violet-400 motion-safe:animate-bounce"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </span>
                </div>
              </li>
            )}
          </ul>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-1.5 pl-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10"
        >
          <MessageCircle className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={300}
            placeholder="e.g. Is there water stored behind the check dam?"
            aria-label="Your question"
            className="h-8 min-w-0 flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
          {question.length > 240 && (
            <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{question.length}/300</span>
          )}
          <button
            type="submit"
            disabled={asking || question.trim().length < 5}
            className="btn btn-sm shrink-0 bg-violet-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(76,29,149,0.25)] hover:bg-violet-700"
          >
            {asking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Ask
          </button>
        </form>

        {/* Suggestions */}
        {thread.length === 0 && !pending && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-500">Try one of these</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-left text-xs text-zinc-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"
                >
                  <Sparkles className="h-3 w-3 shrink-0 text-violet-500" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
