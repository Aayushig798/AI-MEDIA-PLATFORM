import { chat, llmConfigured, VISION_MODEL } from "@/lib/ai/llm";

/**
 * Optional vision captioning for field media (Groq vision model).
 * Generates a concise, evidence-focused single sentence caption.
 */
export async function generateImageCaption(secureUrl: string): Promise<string | null> {
  if (!llmConfigured() || !secureUrl || !secureUrl.startsWith("http")) {
    return null;
  }

  try {
    const caption = await chat({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Briefly describe the physical environment, infrastructure condition, or field activity visible in this image in one factual sentence. Reply with the sentence only.",
            },
            { type: "image_url", image_url: { url: secureUrl } },
          ],
        },
      ],
      max_tokens: 80,
    });
    return caption.replace(/<think>[\s\S]*?<\/think>/g, "").trim() || null;
  } catch (err: any) {
    console.warn("[Captioning] Vision captioning request failed:", err.message);
    return null;
  }
}
