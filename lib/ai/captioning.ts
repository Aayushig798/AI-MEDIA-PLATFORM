import { generate, llmConfigured } from "@/lib/ai/llm";

/**
 * Optional vision captioning for field media (Gemini).
 * Generates a concise, evidence-focused single sentence caption.
 */
export async function generateImageCaption(secureUrl: string): Promise<string | null> {
  if (!llmConfigured() || !secureUrl || !secureUrl.startsWith("http")) {
    return null;
  }

  try {
    const caption = await generate({
      text: "Briefly describe the physical environment, infrastructure condition, or field activity visible in this image in one factual sentence. Reply with the sentence only.",
      images: [secureUrl],
      maxOutputTokens: 200,
    });
    return caption.trim() || null;
  } catch (err: any) {
    console.warn("[Captioning] Vision captioning request failed:", err.message);
    return null;
  }
}
