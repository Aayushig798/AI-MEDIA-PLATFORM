import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { generate, extractJson, llmConfigured, MODEL } from "@/lib/ai/llm";
import { c2paEnabled } from "@/lib/derivatives";
import { CHECK_LABELS, CheckResult, IntegrityContext, skipped } from "../types";

type YesNo = "yes" | "no" | "unknown";

export interface VisionResult {
  claimAnswers: { question: string; answer: YesNo }[];
  scene: { raining: boolean; wetGround: boolean; flooding: boolean; dryDusty: boolean };
  aiGenerated: YesNo;
  screenCapture: YesNo;
  description: string | null;
  tags: string[];
}

// Moderation-style questions (answers are yes/no/unknown). Max 10 per call,
// so claims get up to 4 and these fixed cues take the other 6.
const SCENE_QUESTIONS = {
  raining: "Is rain visibly falling in this image?",
  wetGround: "Is the ground visibly wet, muddy or covered in puddles?",
  flooding: "Is there flooding or standing floodwater in this image?",
  dryDusty: "Does the scene look dry and dusty, with parched soil?",
  aiGenerated: "Does this image look AI-generated, digitally composited or heavily manipulated?",
  screenCapture: "Is this a photo of a screen, a screenshot, or a photo of a printed photo?",
} as const;

const CATEGORY_QUESTIONS: Record<string, string> = {
  environmental: "Does this image show trees, saplings, vegetation or environmental restoration work?",
  infrastructure: "Does this image show a constructed structure such as a dam, well, pump, pipe, road or building?",
  community: "Does this image show people from a community taking part in an activity or meeting?",
  "disaster response": "Does this image show disaster damage or relief work?",
};

/** Turn a free-text impact claim into up to 4 yes/no questions an auditor would ask. */
export function buildClaimQuestions(claim: string | null, category: string | null): string[] {
  if (claim) {
    const clauses = claim
      .split(/[.;\n]|,\s*(?:and\s+)?|\s+and\s+/i)
      .map((c) => c.trim().replace(/^(we|they|the team)\s+/i, ""))
      .filter((c) => c.split(/\s+/).length >= 2)
      .slice(0, 4);
    if (clauses.length > 0) {
      return clauses.map((c) => `Is there visible evidence in this image of: ${c.charAt(0).toLowerCase()}${c.slice(1)}?`);
    }
  }
  const q = category ? CATEGORY_QUESTIONS[category.toLowerCase()] : undefined;
  return q ? [q] : [];
}

async function analyze(endpoint: string, body: Record<string, unknown>) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const auth = Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString("base64");
  const res = await fetch(`https://api.cloudinary.com/v2/analysis/${cloud}/analyze/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || json?.message || `Cloudinary AI Vision HTTP ${res.status}`);
  }
  return json;
}

function toYesNo(value: unknown): YesNo {
  const v = String(value ?? "").trim().toLowerCase();
  return v.startsWith("yes") ? "yes" : v.startsWith("no") ? "no" : "unknown";
}

const NL = String.fromCharCode(10);

function toBool(v: unknown): boolean {
  return v === true || String(v).toLowerCase() === "true" || String(v).toLowerCase() === "yes";
}

/**
 * The AI auditor, weather cues and provenance signals from ONE Gemini call that
 * looks at the photo (Gemini free tier). Preferred over Cloudinary AI Vision,
 * which needs a separate add-on subscription.
 */
async function runGeminiVision(ctx: IntegrityContext): Promise<VisionResult> {
  const claim = ctx.asset.claimText || ctx.asset.project.claim || ctx.asset.manualNotes;
  const claimQuestions = buildClaimQuestions(claim, ctx.asset.manualCategory);

  const claimBlock = claimQuestions.length
    ? claimQuestions.map((q, i) => `${i + 1}. ${q}`).join(NL)
    : "(none: return an empty array)";
  const prompt = [
    "You are auditing one field photo submitted as evidence of a sustainability/development project.",
    claim ? `The claim it should support: "${claim}".` : "",
    "Look carefully at the image and answer strictly from what is visible. Reply ONLY with a JSON object of this exact shape:",
    "{",
    '  "claimAnswers": [{"question": string, "answer": "yes"|"no"|"unknown"}],',
    '  "scene": {"raining": boolean, "wetGround": boolean, "flooding": boolean, "dryDusty": boolean},',
    '  "aiGenerated": "yes"|"no"|"unknown",',
    '  "screenCapture": "yes"|"no"|"unknown",',
    '  "description": string,',
    '  "tags": string[]',
    "}",
    "claimAnswers: answer each of these questions, in order, keeping the wording:",
    claimBlock,
    "scene: what weather/ground conditions are visible (raining now, wet or muddy ground, floodwater, dry dusty soil).",
    "aiGenerated: does it look AI-generated, composited or heavily manipulated? screenCapture: is it a photo of a screen, a screenshot, or a photo of a printed photo?",
    'description: one factual sentence. tags: up to 8 short lowercase tags of visible objects/activities. Use "unknown" rather than guessing.',
  ]
    .filter(Boolean)
    .join(NL);

  const raw = await generate({ text: prompt, images: [ctx.analysisImageUrl], json: true, maxOutputTokens: 1500, temperature: 0.1 });
  const j = extractJson(raw);

  const yn = (v: unknown): YesNo => (v === "yes" || v === "no" ? v : "unknown");
  const answered: any[] = Array.isArray(j.claimAnswers) ? j.claimAnswers : [];
  return {
    claimAnswers: claimQuestions.map((question, i) => ({ question, answer: yn(String(answered[i]?.answer ?? "").toLowerCase()) })),
    scene: {
      raining: toBool(j.scene?.raining),
      wetGround: toBool(j.scene?.wetGround),
      flooding: toBool(j.scene?.flooding),
      dryDusty: toBool(j.scene?.dryDusty),
    },
    aiGenerated: yn(String(j.aiGenerated ?? "").toLowerCase()),
    screenCapture: yn(String(j.screenCapture ?? "").toLowerCase()),
    description: typeof j.description === "string" && j.description.trim() ? j.description.trim() : null,
    tags: Array.isArray(j.tags) ? j.tags.map((t: unknown) => String(t).toLowerCase()).slice(0, 8) : [],
  };
}

/** Gemini first (free key), then Cloudinary AI Vision if that add-on is available. */
export async function runVision(ctx: IntegrityContext): Promise<VisionResult> {
  if (llmConfigured()) {
    try {
      return await runGeminiVision(ctx);
    } catch (err: any) {
      console.warn(`[vision] Gemini (${MODEL}) failed, trying Cloudinary AI Vision:`, err?.message || err);
      if (!isCloudinaryConfigured()) throw err;
      try {
        return await runCloudinaryVision(ctx);
      } catch {
        throw err; // report the Gemini error: it's the primary path
      }
    }
  }
  return runCloudinaryVision(ctx);
}

/** One moderation call (claims + scene cues) and one descriptive call, via Cloudinary AI Vision. */
async function runCloudinaryVision(ctx: IntegrityContext): Promise<VisionResult> {
  if (!isCloudinaryConfigured()) throw new Error("Cloudinary credentials not configured");

  const claim = ctx.asset.claimText || ctx.asset.project.claim || ctx.asset.manualNotes;
  const claimQuestions = buildClaimQuestions(claim, ctx.asset.manualCategory);
  const sceneKeys = Object.keys(SCENE_QUESTIONS) as (keyof typeof SCENE_QUESTIONS)[];
  const questions = [...claimQuestions, ...sceneKeys.map((k) => SCENE_QUESTIONS[k])];
  const source = { uri: ctx.analysisImageUrl };

  const [moderation, general] = await Promise.all([
    analyze("ai_vision_moderation", { source, rejection_questions: questions }),
    analyze("ai_vision_general", {
      source,
      prompts: [
        "In one sentence, describe what this field photo shows, focusing on visible work, structures, vegetation, water and people.",
        "List up to 8 short tags for the main objects and activities visible, comma-separated, nothing else.",
      ],
    }).catch((err) => {
      console.warn("[vision] descriptive prompt failed:", err.message);
      return null;
    }),
  ]);

  const answers: YesNo[] = (moderation?.data?.analysis?.responses ?? []).map((r: any) => toYesNo(r?.value));
  const answerFor = (i: number): YesNo => answers[i] ?? "unknown";
  const sceneAnswer = (k: keyof typeof SCENE_QUESTIONS) => answerFor(claimQuestions.length + sceneKeys.indexOf(k));

  const responses = general?.data?.analysis?.responses ?? [];
  const description = typeof responses[0]?.value === "string" ? responses[0].value.trim() : null;
  const tags =
    typeof responses[1]?.value === "string"
      ? responses[1].value
          .split(",")
          .map((t: string) => t.trim().toLowerCase().replace(/[.]$/, ""))
          .filter(Boolean)
          .slice(0, 8)
      : [];

  return {
    claimAnswers: claimQuestions.map((question, i) => ({ question, answer: answerFor(i) })),
    scene: {
      raining: sceneAnswer("raining") === "yes",
      wetGround: sceneAnswer("wetGround") === "yes",
      flooding: sceneAnswer("flooding") === "yes",
      dryDusty: sceneAnswer("dryDusty") === "yes",
    },
    aiGenerated: sceneAnswer("aiGenerated"),
    screenCapture: sceneAnswer("screenCapture"),
    description,
    tags,
  };
}

/** Check 7: AI auditor — does the photo show what the claim says? */
export function checkClaim(ctx: IntegrityContext): CheckResult {
  if (!ctx.vision) {
    return skipped("claim", ctx.visionError ? `AI Vision unavailable: ${ctx.visionError}` : "AI Vision did not run.");
  }
  const { claimAnswers, description, tags } = ctx.vision;
  const details = { answers: claimAnswers, description, tags };
  if (claimAnswers.length === 0) {
    return skipped("claim", "No claim, notes or category to check the photo against.", details);
  }

  const yes = claimAnswers.filter((a) => a.answer === "yes").length;
  const no = claimAnswers.filter((a) => a.answer === "no").length;
  const base = { id: "claim" as const, label: CHECK_LABELS.claim, details };

  if (yes === 0 && no > 0) {
    return { ...base, status: "fail", penalty: 20, confidence: "medium", summary: "AI auditor sees none of the claimed work in this photo." };
  }
  if (no > 0) {
    return {
      ...base,
      status: "warn",
      penalty: 10,
      confidence: "medium",
      summary: `AI auditor confirms ${yes} of ${claimAnswers.length} claimed elements; ${no} not visible.`,
    };
  }
  if (yes === 0) {
    return { ...base, status: "warn", penalty: 5, confidence: "low", summary: "AI auditor could not tell whether the claimed work is visible." };
  }
  return {
    ...base,
    status: "pass",
    penalty: 0,
    confidence: "medium",
    summary: `AI auditor confirms ${yes} of ${claimAnswers.length} claimed element${claimAnswers.length > 1 ? "s" : ""} visible.`,
  };
}

/** Check 8: signs of generation, compositing or re-photographing. Deliberately low weight. */
export function checkProvenance(ctx: IntegrityContext): CheckResult {
  const details = { c2pa: c2paEnabled() ? "fl_c2pa signing enabled on evidence derivatives" : "Content Credentials beta not enabled" };
  if (!ctx.vision) {
    return skipped("provenance", ctx.visionError ? `AI Vision unavailable: ${ctx.visionError}` : "AI Vision did not run.", details);
  }
  const base = { id: "provenance" as const, label: CHECK_LABELS.provenance, details: { ...details, aiGenerated: ctx.vision.aiGenerated, screenCapture: ctx.vision.screenCapture } };

  if (ctx.vision.screenCapture === "yes") {
    return { ...base, status: "fail", penalty: 15, confidence: "medium", summary: "Looks like a photo of a screen or print, a common way to recycle old images." };
  }
  if (ctx.vision.aiGenerated === "yes") {
    return { ...base, status: "warn", penalty: 10, confidence: "low", summary: "AI Vision thinks this may be generated or composited (weak signal; needs a human look)." };
  }
  return { ...base, status: "pass", penalty: 0, confidence: "low", summary: "No visible signs of generation, compositing or re-photographing." };
}
