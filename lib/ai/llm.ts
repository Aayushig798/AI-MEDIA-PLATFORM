import OpenAI from "openai";

/**
 * Chat and vision models run on Groq through its OpenAI-compatible API, using
 * the `openai` SDK with a different base URL.
 *
 * Groq's lineup changes often (e.g. Llama 4 Scout was shut down in July 2026),
 * so the model ids are configurable:
 *   GROQ_TEXT_MODEL   default llama-3.3-70b-versatile  (production, report narrative)
 *   GROQ_VISION_MODEL default qwen/qwen3.8-27b          (images + JSON mode, pair verification, captions)
 *
 * Groq has no embeddings endpoint; see lib/ai/embeddings.ts.
 */
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const TEXT_MODEL = process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile";
export const VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";

export function llmConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

let client: OpenAI | null = null;

export function getLlm(): OpenAI | null {
  if (!process.env.GROQ_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: GROQ_BASE_URL });
  return client;
}

type ChatParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

/**
 * Chat completion for reasoning-capable models (Qwen): switch thinking off so
 * the answer isn't preceded by reasoning that eats max_tokens or breaks JSON
 * mode. If the model rejects those parameters, retry without them.
 */
export async function chat(params: ChatParams): Promise<string> {
  const llm = getLlm();
  if (!llm) throw new Error("GROQ_API_KEY is not configured");

  const reasoningOff = { reasoning_effort: "none", reasoning_format: "hidden" };
  try {
    const res = await llm.chat.completions.create({ ...params, ...reasoningOff } as ChatParams);
    return res.choices[0]?.message?.content ?? "";
  } catch (err: any) {
    if (err?.status !== 400) throw err;
    const res = await llm.chat.completions.create(params);
    return res.choices[0]?.message?.content ?? "";
  }
}

/** Parse a JSON object from a model reply, tolerating <think> blocks and code fences. */
export function extractJson(raw: string): any {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```(?:json)?/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model reply was not valid JSON");
  }
}
