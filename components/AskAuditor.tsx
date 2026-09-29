"use client";

import { useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";

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

  const ask = async (q: string) => {
    if (!q.trim() || asking) return;
    setAsking(true);
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
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/5 space-y-3">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <Bot className="w-4 h-4 text-emerald-400" /> Ask the auditor
      </h3>
      <p className="text-[11px] text-slate-400">
        Ask anything about this photo. Cloudinary AI Vision answers from the image and the check results above; it is an
        assistant, not a verdict.
      </p>

      {thread.length > 0 && (
        <ul className="space-y-2">
          {thread.map((t, i) => (
            <li key={i} className="text-xs space-y-1">
              <p className="text-slate-300 font-semibold">Q: {t.q}</p>
              <p className={t.error ? "text-rose-300" : "text-slate-200"}>{t.a}</p>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          placeholder="e.g. Is there water stored behind the check dam?"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={asking || question.trim().length < 5}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-40"
        >
          {asking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Ask
        </button>
      </form>
      {thread.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-slate-300">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
