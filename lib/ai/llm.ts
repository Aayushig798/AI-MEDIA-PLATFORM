/**
 * Text, vision and embeddings via the Gemini API (Google AI Studio key).
 * Uses the native REST API with `fetch`; there is no SDK dependency.
 *
 * Model ids change often, so they're configurable:
 *   GEMINI_MODEL            default gemini-3.5-flash-lite  (report narrative, pair verification, captions)
 *   GEMINI_EMBEDDING_MODEL  default gemini-embedding-001   (semantic search, 1536 dimensions)
 * Run `npm run ai:check` to confirm your key works with these models.
 */
const API = "https://generativelanguage.googleapis.com/v1beta";

export const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
/** Must match the pgvector column: vector(1536). */
export const EMBEDDING_DIMENSIONS = 1536;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function llmConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

class GeminiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function post(path: string, body: unknown): Promise<any> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not configured", 0);
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    // Key in a header, not the URL, so it never lands in access logs
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new GeminiError(json?.error?.message || `Gemini API HTTP ${res.status}`, res.status);
  return json;
}

/** Gemini takes images inline (base64), so fetch the image ourselves. */
async function inlineImage(url: string): Promise<{ inlineData: { mimeType: string; data: string } }> {
  // Ask for a format Gemini accepts (Cloudinary f_auto would otherwise pick AVIF for some clients)
  const res = await fetch(url, { headers: { Accept: "image/jpeg,image/png,image/webp,*/*;q=0.1" } });
  if (!res.ok) throw new Error(`Could not fetch image (${res.status}): ${url.slice(0, 80)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error("Image too large to send inline (over 4 MB)");
  const mimeType = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(mimeType)) throw new Error(`Unsupported image type for Gemini: ${mimeType}`);
  return { inlineData: { mimeType, data: buf.toString("base64") } };
}

export interface GenerateOptions {
  system?: string;
  text: string;
  /** Public image URLs, sent inline after the text */
  images?: string[];
  /** Ask for a JSON object reply */
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Generate text. Thinking is minimised (it costs tokens and can crowd out the
 * answer); the setting differs across model generations, so try the newer form
 * first and fall back to the older one, then to no setting at all.
 */
export async function generate(opts: GenerateOptions): Promise<string> {
  const parts: any[] = [{ text: opts.text }];
  for (const url of opts.images ?? []) parts.push(await inlineImage(url));

  const base = {
    ...(opts.system && { systemInstruction: { parts: [{ text: opts.system }] } }),
    contents: [{ role: "user", parts }],
  };
  const generationConfig = {
    temperature: opts.temperature ?? 0.2,
    // Thinking tokens count against this limit, so leave headroom
    maxOutputTokens: opts.maxOutputTokens ?? 2048,
    ...(opts.json && { responseMimeType: "application/json" }),
  };

  const attempts: (Record<string, unknown> | null)[] = [
    { thinkingLevel: "minimal" }, // Gemini 3.x
    { thinkingBudget: 0 }, // Gemini 2.5
    null, // model doesn't accept either
  ];
  let lastErr: unknown;
  for (const thinkingConfig of attempts) {
    try {
      const json = await post(`models/${MODEL}:generateContent`, {
        ...base,
        generationConfig: { ...generationConfig, ...(thinkingConfig && { thinkingConfig }) },
      });
      const candidate = json.candidates?.[0];
      const text = (candidate?.content?.parts ?? [])
        .filter((p: any) => typeof p.text === "string" && !p.thought)
        .map((p: any) => p.text)
        .join("");
      if (!text && json.promptFeedback?.blockReason) throw new Error(`Blocked by Gemini: ${json.promptFeedback.blockReason}`);
      return text;
    } catch (err) {
      lastErr = err;
      // Only a rejected parameter (HTTP 400) is worth retrying with the next form
      if (!(err instanceof GeminiError) || err.status !== 400) throw err;
    }
  }
  throw lastErr;
}

/** Parse a JSON object from a model reply, tolerating code fences and stray text. */
export function extractJson(raw: string): any {
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model reply was not valid JSON");
  }
}

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm > 0 ? v.map((x) => x / norm) : v;
}

/**
 * 1536-dimension embedding for pgvector cosine search. Reduced-dimension
 * vectors aren't unit length, so normalise them ourselves.
 * `kind` picks the retrieval task type (used by gemini-embedding-001).
 */
export async function embed(text: string, kind: "document" | "query"): Promise<number[]> {
  const json = await post(`models/${EMBEDDING_MODEL}:embedContent`, {
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIMENSIONS,
    // gemini-embedding-2 has no task types; it ignores/rejects them, so only send for 001
    ...(EMBEDDING_MODEL.includes("001") && { taskType: kind === "query" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT" }),
  });
  const values: number[] | undefined = json.embedding?.values;
  if (!values || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding returned ${values?.length ?? 0} dimensions, expected ${EMBEDDING_DIMENSIONS}`);
  }
  return normalize(values);
}
