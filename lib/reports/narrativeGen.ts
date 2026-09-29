import OpenAI from "openai";
import { ProjectFacts } from "./factAssembly";
import { ungroundedNumbers } from "./grounding";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Fallback narrative generator strictly grounded in the assembled facts.
 * Guaranteed never to invent dates, metrics, or entities.
 */
function buildDeterministicFactNarrative(facts: ProjectFacts): string {
  const categorySummary = Object.entries(facts.categoryBreakdown)
    .map(([cat, count]) => `${count} in ${cat}`)
    .join(", ");

  const dateSpanText = facts.dateRange
    ? `spanning from ${new Date(facts.dateRange.from).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} to ${new Date(facts.dateRange.to).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : "with captured dates yet to be scheduled";

  const locationText = facts.locations.length > 0
    ? `Field monitoring was recorded across key locations including ${facts.locations.join(", ")}.`
    : facts.projectLocation
    ? `Field monitoring was centralized in ${facts.projectLocation}.`
    : "Field monitoring was conducted across active project sites.";

  const comparisonText = facts.totalComparisons > 0
    ? `The project tracks ${facts.totalComparisons} comparative before/after observation pair(s), of which ${facts.verifiedComparisonsCount} have undergone multi-factor AI verification. ${
        facts.comparisons
          .map((c) => (c.changeSummary ? `Documented observations noted: ${c.changeSummary}.` : ""))
          .filter(Boolean)
          .join(" ")
      }`
    : "No before/after comparison pairs have been finalized for this project yet.";

  return [
    `This sustainability impact report summarizes evidence for "${facts.projectName}". To date, the repository contains ${facts.totalAssets} documented media asset(s) (${facts.imageCount} image(s), ${facts.videoCount} video(s)). Assets have been classified into primary domain categories: ${categorySummary || "pending category classification"}.`,
    `${locationText} The chronological observation window represents active field monitoring ${dateSpanText}.${integrityText(facts)}`,
    ...measuredText(facts),
    `${comparisonText} ${facts.notes.length > 0 ? `Field notes record: "${facts.notes.slice(0, 3).join('; ')}".` : ""}`,
  ].join("\n\n");
}

function integrityText(facts: ProjectFacts): string {
  const i = facts.integrity;
  let text = "";
  if (i) {
    text += ` Every asset is screened by the Proof-of-Impact Integrity Engine: ${i.verified} verified or approved by a reviewer, ${i.awaitingReview} awaiting human review, ${i.flagged} flagged as recycled, lifted or inconsistent, and ${i.unverified} not yet screened. Flagged assets are excluded from the cited evidence.`;
  }
  if (facts.ledger) {
    text += ` Each upload, check, review and report is recorded in a hash-chained ledger (${facts.ledger.projectEntries} entries for this project, chain ${facts.ledger.chainIntact ? "intact" : "BROKEN"}), so any later edit is detectable.`;
  }
  return text;
}

function measuredText(facts: ProjectFacts): string[] {
  return facts.measuredChanges.map((m) => {
    const label = m.metric === "GREEN_COVER" ? "green cover" : "open-water area";
    const sign = m.deltaPp > 0 ? "+" : "";
    let s = `${m.location ? `At ${m.location}, ` : ""}${label} measured from aligned photos changed from ${m.beforePct}% (${m.beforeDate ?? "undated"}) to ${m.afterPct}% (${m.afterDate ?? "undated"}), ${sign}${m.deltaPp} percentage points.`;
    if (m.satellite) {
      s += ` Sentinel-2 ${m.satellite.index.toUpperCase()} at the site moved from ${m.satellite.before} to ${m.satellite.after}${m.satellite.agrees ? ", consistent with the photos" : ", which needs a closer look"}.`;
    }
    return s;
  });
}

/**
 * Generates an executive narrative strictly grounded in assembled project facts.
 * Uses GPT-4o-mini when OPENAI_API_KEY is available; falls back to an exact,
 * fact-grounded template if unavailable.
 */
export async function generateNarrative(facts: ProjectFacts): Promise<string> {
  if (openai && process.env.OPENAI_API_KEY) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You write concise sustainability impact-report narratives. " +
              "Use ONLY the facts provided in the user message. " +
              "Never invent statistics, dates, or details not present in the facts. " +
              "Write 2-3 paragraphs suitable for a stakeholder report.",
          },
          { role: "user", content: JSON.stringify(facts) },
        ],
        temperature: 0.2,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      // Grounding guard: reject any draft that states a number not in the facts.
      const invented = content ? ungroundedNumbers(content, facts) : [];
      if (content && invented.length === 0) return content;
      if (invented.length > 0) {
        console.warn(`[NarrativeGen] LLM draft rejected; numbers not in facts: ${invented.join(", ")}`);
      }
    } catch (err: any) {
      console.warn(
        "[NarrativeGen] OpenAI generation failed; falling back to deterministic grounded narrative:",
        err.message || err
      );
    }
  }

  return buildDeterministicFactNarrative(facts);
}
