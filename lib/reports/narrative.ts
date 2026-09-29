import type { ReportFacts } from "./facts";

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** Deterministic narrative: every number is copied straight from the facts. */
export function templateNarrative(f: ReportFacts): string {
  const a = f.assets;
  const paras: string[] = [];

  paras.push(
    `${f.project.name}${f.project.location ? ` (${f.project.location})` : ""} documented ${plural(a.total, "field asset")}` +
      `${a.capturedFrom ? ` captured between ${a.capturedFrom} and ${a.capturedTo}` : ""}: ${plural(a.images, "photo")} and ${plural(a.videos, "video")}.` +
      (f.project.claim ? ` The project claims: "${f.project.claim}".` : "")
  );

  const excluded = a.awaitingReview + a.flagged + a.unverified;
  paras.push(
    `${plural(a.verified, "asset")} passed the automated integrity checks or human review and ${a.verified === 1 ? "is" : "are"} cited as evidence. ` +
      `${plural(excluded, "asset")} ${excluded === 1 ? "was" : "were"} excluded: ${a.flagged} flagged, ${a.awaitingReview} awaiting review and ${a.unverified} not yet verified.`
  );

  for (const m of f.measured) {
    const label = m.metric === "GREEN_COVER" ? "green cover" : "water area";
    const sign = m.deltaPp > 0 ? "+" : "";
    let s = `${m.location ? `At ${m.location}, ` : ""}${label} in frame changed from ${m.beforePct}% on ${m.beforeDate} to ${m.afterPct}% on ${m.afterDate} (${sign}${m.deltaPp} percentage points), measured from pixels of the aligned photos.`;
    if (m.satellite) {
      s += ` Sentinel-2 ${String(m.satellite.index).toUpperCase()} at the site moved from ${m.satellite.before} to ${m.satellite.after}${m.satellite.agrees ? ", consistent with the photos" : ", which does not match the photos and needs a closer look"}.`;
    }
    paras.push(s);
  }

  paras.push(
    `Every cited photo and figure is traceable to its original file through the tamper-evident ledger (${plural(f.ledger.projectEntries, "entry", "entries")} for this project; chain ${f.ledger.chainIntact ? "intact" : "BROKEN"}). Scan any QR code to check it independently.`
  );
  return paras.join("\n\n");
}

/** Every number in the text, normalised ("1,200" -> "1200", "24.50" -> "24.5"). */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => String(Number(n.replace(/,/g, ""))));
}

/**
 * Grounding guard: returns numbers that appear in the narrative but nowhere in
 * the facts. Any hit means the text invented a statistic.
 */
export function ungroundedNumbers(narrative: string, facts: ReportFacts): string[] {
  // Ids, hashes and URLs are full of digits; they must not "allow" a statistic.
  const statsOnly = JSON.stringify(facts, (key, value) =>
    /(^id$|Id$|Url$|Hash$|PublicId$)/.test(key) ? undefined : value
  );
  const allowed = new Set(numbersIn(statsOnly));
  // Small counting words rendered as digits, and years/days from dates, are covered above;
  // allow 0–3 which appear in phrasing like "2 paragraphs" or "3 days".
  ["0", "1", "2", "3"].forEach((n) => allowed.add(n));
  return Array.from(new Set(numbersIn(narrative).filter((n) => !allowed.has(n))));
}

/**
 * Optional LLM polish (OpenAI, per the project README). The draft is rejected
 * if it introduces any number that isn't in the facts.
 */
export async function llmNarrative(facts: ReportFacts): Promise<{ text: string; model: string } | { rejected: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { rejected: "OPENAI_API_KEY not set" };
  const model = process.env.OPENAI_REPORT_MODEL || "gpt-4o-mini";

  const { cited, ...compact } = facts;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You write short impact reports for donors and auditors. Use ONLY the facts provided. Every number you write must appear verbatim in the facts; never estimate, round differently, or add statistics. Mention excluded (flagged/unverified) evidence honestly. 3 short paragraphs, plain prose, no headings, no bullet points.",
        },
        { role: "user", content: `Facts (JSON):\n${JSON.stringify({ ...compact, citedAssetCount: cited.length })}` },
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) return { rejected: json?.error?.message || `OpenAI HTTP ${res.status}` };

  const text: string = json.choices?.[0]?.message?.content?.trim() ?? "";
  const bad = ungroundedNumbers(text, facts);
  if (!text || bad.length > 0) {
    return { rejected: `LLM draft introduced numbers not in the facts (${bad.join(", ")}); used the template instead.` };
  }
  return { text, model };
}
