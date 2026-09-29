import { db } from "@/lib/db";
import { verifyFullChain } from "@/lib/ledger";

type Effective = "VERIFIED" | "REVIEW" | "FLAGGED" | "UNVERIFIED";

function effective(i: { status: string; verdict: string | null; reviewDecision: string | null } | null): Effective {
  if (!i || i.status !== "DONE") return "UNVERIFIED";
  if (i.reviewDecision === "APPROVED") return "VERIFIED";
  if (i.reviewDecision === "REJECTED") return "FLAGGED";
  return (i.verdict as Effective) ?? "UNVERIFIED";
}

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Structured project facts, computed with NO AI. Everything a report says must
 * come from here; only VERIFIED (or human-approved) assets are cited as evidence.
 */
export async function assembleFacts(projectId: string) {
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { assets: { include: { integrity: true }, orderBy: { capturedAt: "asc" } } },
  });

  const assets = project.assets.map((a) => ({ ...a, status: effective(a.integrity) }));
  const byVerdict: Record<Effective, number> = { VERIFIED: 0, REVIEW: 0, FLAGGED: 0, UNVERIFIED: 0 };
  const byCategory: Record<string, number> = {};
  for (const a of assets) {
    byVerdict[a.status]++;
    const cat = a.manualCategory ?? "Uncategorised";
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }
  const dated = assets.filter((a) => a.capturedAt).map((a) => a.capturedAt!.getTime());

  const cited = assets
    .filter((a) => a.status === "VERIFIED")
    .slice(0, 12)
    .map((a) => ({
      id: a.id,
      secureUrl: a.secureUrl,
      resourceType: a.resourceType,
      capturedAt: day(a.capturedAt),
      location: a.manualLocation,
      category: a.manualCategory,
      trustScore: a.integrity?.trustScore ?? null,
      humanApproved: a.integrity?.reviewDecision === "APPROVED",
    }));

  const comparisons = await db.comparison.findMany({
    where: { projectId },
    include: { metrics: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });
  const byId = Object.fromEntries(assets.map((a) => [a.id, a]));
  const measured = comparisons
    .filter((c) => c.metrics[0] && byId[c.beforeAssetId]?.status === "VERIFIED" && byId[c.afterAssetId]?.status === "VERIFIED")
    .map((c) => {
      const m = c.metrics[0];
      const sat = (m.satDelta ?? null) as { index?: string; before?: number; after?: number; agrees?: boolean } | null;
      return {
        comparisonId: c.id,
        beforeAssetId: c.beforeAssetId,
        afterAssetId: c.afterAssetId,
        beforeUrl: byId[c.beforeAssetId].secureUrl,
        afterUrl: byId[c.afterAssetId].secureUrl,
        beforeDate: day(byId[c.beforeAssetId].capturedAt),
        afterDate: day(byId[c.afterAssetId].capturedAt),
        location: byId[c.afterAssetId].manualLocation,
        metric: m.metric,
        beforePct: m.beforePct,
        afterPct: m.afterPct,
        deltaPp: m.deltaPp,
        method: m.method,
        maskPublicId: m.maskPublicId,
        satellite: sat?.before != null && sat?.after != null ? { index: sat.index, before: sat.before, after: sat.after, agrees: sat.agrees ?? null } : null,
      };
    });

  const [reels, ledgerEntries, chain] = await Promise.all([
    db.reel.count({ where: { projectId } }),
    db.ledgerEntry.count({ where: { projectId } }),
    verifyFullChain(),
  ]);

  return {
    project: {
      id: project.id,
      name: project.name,
      location: project.location,
      startDate: day(project.startDate),
      claim: project.claim,
      impactType: project.impactType,
    },
    assets: {
      total: assets.length,
      images: assets.filter((a) => a.resourceType === "image").length,
      videos: assets.filter((a) => a.resourceType === "video").length,
      verified: byVerdict.VERIFIED,
      awaitingReview: byVerdict.REVIEW,
      flagged: byVerdict.FLAGGED,
      unverified: byVerdict.UNVERIFIED,
      byCategory,
      capturedFrom: dated.length ? day(new Date(Math.min(...dated))) : null,
      capturedTo: dated.length ? day(new Date(Math.max(...dated))) : null,
    },
    cited,
    measured,
    reels,
    ledger: { projectEntries: ledgerEntries, chainIntact: chain.ok, headHash: chain.head },
  };
}

export type ReportFacts = Awaited<ReturnType<typeof assembleFacts>>;
