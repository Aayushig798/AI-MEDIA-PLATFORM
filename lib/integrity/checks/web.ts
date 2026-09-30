import { prisma as db } from "@/lib/db";
import { CHECK_LABELS, CheckResult, IntegrityContext, skipped } from "../types";

interface WebImage {
  url: string;
  score?: number;
}
interface WebPage {
  url: string;
  pageTitle?: string;
  fullMatchingImages?: WebImage[];
  partialMatchingImages?: WebImage[];
}
interface WebDetection {
  fullMatchingImages?: WebImage[];
  partialMatchingImages?: WebImage[];
  pagesWithMatchingImages?: WebPage[];
}

/**
 * Check 3: lifted from the internet, via Google Cloud Vision Web Detection
 * (1,000 free units/month, so it only runs on "Submit for verification").
 */
export async function checkWeb(ctx: IntegrityContext): Promise<CheckResult> {
  const key = process.env.GOOGLE_VISION_API_KEY;
  if (!key) return skipped("web", "Web search not configured (set GOOGLE_VISION_API_KEY).");

  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { source: { imageUri: ctx.analysisImageUrl } },
          features: [{ type: "WEB_DETECTION", maxResults: 20 }],
        },
      ],
    }),
  });
  const json = await res.json();
  const response = json?.responses?.[0];
  if (!res.ok || response?.error) {
    throw new Error(response?.error?.message || json?.error?.message || `Vision API HTTP ${res.status}`);
  }
  const web: WebDetection = response?.webDetection ?? {};

  // Ignore our own CDN: those are this very upload, not prior publication.
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const notOurs = (u: string) => !(cloud && u.includes(`res.cloudinary.com/${cloud}/`));
  const full = (web.fullMatchingImages ?? []).filter((i) => notOurs(i.url));
  const partial = (web.partialMatchingImages ?? []).filter((i) => notOurs(i.url));
  const pages = (web.pagesWithMatchingImages ?? []).filter((p) => notOurs(p.url));

  await db.webMatch.deleteMany({ where: { assetId: ctx.asset.id } });
  const rows = [
    ...full.map((i) => ({ assetId: ctx.asset.id, url: i.url, kind: "FULL" as const, score: i.score ?? null })),
    ...partial.map((i) => ({ assetId: ctx.asset.id, url: i.url, kind: "PARTIAL" as const, score: i.score ?? null })),
    ...pages.map((p) => ({ assetId: ctx.asset.id, url: p.url, kind: "PAGE" as const, pageTitle: p.pageTitle?.replace(/<[^>]+>/g, "") ?? null })),
  ];
  if (rows.length > 0) await db.webMatch.createMany({ data: rows });

  const details = {
    fullMatches: full.length,
    partialMatches: partial.length,
    pages: pages.slice(0, 5).map((p) => ({ url: p.url, title: p.pageTitle?.replace(/<[^>]+>/g, "") ?? null })),
  };

  if (full.length > 0) {
    return {
      id: "web",
      label: CHECK_LABELS.web,
      status: "fail",
      penalty: 40,
      confidence: "high",
      summary: `Exact copies found on the web (${full.length} image${full.length > 1 ? "s" : ""}, ${pages.length} page${pages.length === 1 ? "" : "s"}).`,
      details,
    };
  }
  if (partial.length > 0 || pages.length > 0) {
    return {
      id: "web",
      label: CHECK_LABELS.web,
      status: "warn",
      penalty: 20,
      confidence: "medium",
      summary: `Cropped or edited versions appear on ${Math.max(pages.length, partial.length)} web page(s).`,
      details,
    };
  }
  return {
    id: "web",
    label: CHECK_LABELS.web,
    status: "pass",
    penalty: 0,
    confidence: "medium",
    summary: "No copies found on the public web (private reuse can't be ruled out).",
    details,
  };
}
