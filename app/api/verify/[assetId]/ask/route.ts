import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { getAnalysisImageUrl } from "@/lib/cloudinary-url";

export const maxDuration = 60;

const MAX_QUESTION = 300;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
// Public endpoint that spends AI Vision tokens: a small per-IP limit per instance.
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

/**
 * "Ask the auditor": a viewer's question about one piece of evidence, answered by
 * Cloudinary AI Vision looking at the photo, with the stored check results as context.
 */
export async function POST(req: NextRequest, { params }: { params: { assetId: string } }) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    if (rateLimited(ip)) {
      return NextResponse.json({ success: false, error: "Too many questions; try again in a minute." }, { status: 429 });
    }

    const { question } = await req.json().catch(() => ({}));
    if (typeof question !== "string" || question.trim().length < 5 || question.length > MAX_QUESTION) {
      return NextResponse.json({ success: false, error: `Ask a question of 5–${MAX_QUESTION} characters.` }, { status: 400 });
    }
    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ success: false, error: "The AI auditor is not configured." }, { status: 503 });
    }

    const asset = await prisma.mediaAsset.findUnique({
      where: { id: params.assetId },
      include: { integrity: true, project: { select: { name: true, claim: true } } },
    });
    if (!asset) return NextResponse.json({ success: false, error: "Asset not found" }, { status: 404 });

    const checks = ((asset.integrity?.checks as any[]) ?? [])
      .filter((c) => c.status !== "skipped")
      .map((c) => `- ${c.label}: ${c.status} (${c.summary})`)
      .join("\n");
    const context = [
      `Project: ${asset.project.name}.`,
      asset.claimText || asset.project.claim ? `Claim: ${asset.claimText || asset.project.claim}.` : "",
      asset.capturedAt ? `Claimed capture date: ${asset.capturedAt.toISOString().slice(0, 10)}.` : "",
      asset.integrity?.trustScore != null ? `Automated Trust Score: ${asset.integrity.trustScore}/100 (${asset.integrity.verdict}).` : "",
      checks ? `Automated check results:\n${checks}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt =
      `You are an impartial evidence auditor looking at a field photo submitted as proof of impact.\n${context}\n\n` +
      `Answer the viewer's question in at most 3 sentences, based only on what is visible in the image and the context above. ` +
      `If it cannot be determined from the image, say so plainly. Do not speculate about people's identities.\n\n` +
      `Question: ${question.trim()}`;

    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const auth = Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString("base64");
    const res = await fetch(`https://api.cloudinary.com/v2/analysis/${cloud}/analyze/ai_vision_general`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source: { uri: getAnalysisImageUrl(asset.secureUrl, asset.resourceType) },
        prompts: [prompt],
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = json?.error?.message || `AI Vision HTTP ${res.status}`;
      return NextResponse.json(
        {
          success: false,
          error: /subscription|add-?on/i.test(message)
            ? "The AI auditor needs the Cloudinary AI Vision add-on to be enabled."
            : message,
        },
        { status: 502 }
      );
    }

    const answer = json?.data?.analysis?.responses?.[0]?.value;
    return NextResponse.json({ success: true, answer: typeof answer === "string" ? answer.trim() : "No answer." });
  } catch (error: any) {
    console.error(`POST /api/verify/${params.assetId}/ask error:`, error);
    return NextResponse.json({ success: false, error: error.message || "The auditor could not answer." }, { status: 500 });
  }
}
