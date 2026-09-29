import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Optional GPT-4o-mini vision captioning for field media.
 * Generates a concise, evidence-focused single sentence caption.
 */
export async function generateImageCaption(secureUrl: string): Promise<string | null> {
  if (!openai || !process.env.OPENAI_API_KEY || !secureUrl || !secureUrl.startsWith("http")) {
    return null;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Briefly describe the physical environment, infrastructure condition, or field activity visible in this image in one factual sentence.",
            },
            {
              type: "image_url",
              image_url: { url: secureUrl, detail: "low" },
            },
          ],
        },
      ],
      max_tokens: 60,
    });

    return response.choices[0]?.message?.content?.trim() || null;
  } catch (err: any) {
    console.warn("[Captioning] Vision captioning request failed:", err.message);
    return null;
  }
}
