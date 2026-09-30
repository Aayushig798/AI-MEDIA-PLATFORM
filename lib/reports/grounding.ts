/**
 * Grounding guard for report text: every number a narrative states must exist
 * in the structured facts it was generated from. Catches an LLM (or a human
 * edit) inventing a statistic.
 */

/** Every number in the text, normalised ("1,200" -> "1200", "24.50" -> "24.5"). */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => String(Number(n.replace(/,/g, ""))));
}

/** Numbers in `narrative` that appear nowhere in `facts` (ids, hashes and URLs don't count). */
export function ungroundedNumbers(narrative: string, facts: unknown): string[] {
  const statsOnly = JSON.stringify(facts, (key, value) =>
    /(^id$|Id$|Ids$|Url$|Hash$|PublicId$)/.test(key) ? undefined : value
  );
  const allowed = new Set(numbersIn(statsOnly));
  // Small counts used in ordinary phrasing ("one of 2 photos") are always fine.
  ["0", "1", "2", "3"].forEach((n) => allowed.add(n));
  // Dates like "Jun 10, 2025" are rendered from ISO facts; allow their day/year parts.
  for (const iso of statsOnly.match(/\d{4}-\d{2}-\d{2}/g) ?? []) {
    const [y, m, d] = iso.split("-");
    [y, String(Number(m)), String(Number(d))].forEach((n) => allowed.add(n));
  }
  return Array.from(new Set(numbersIn(narrative).filter((n) => !allowed.has(n))));
}
