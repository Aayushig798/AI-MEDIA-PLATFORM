/**
 * Self-test for the Gemini setup:  npm run ai:check
 * Reads GEMINI_API_KEY from .env, then tries a text call, a JSON call, an image
 * call and an embedding, and prints what worked. Never prints the key.
 */
try {
  process.loadEnvFile(".env");
} catch {
  // rely on the real environment
}

import { generate, embed, extractJson, llmConfigured, MODEL, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "../lib/ai/llm";

// A tiny public image (Cloudinary's demo sample) so the vision path is exercised too.
const SAMPLE_IMAGE = "https://res.cloudinary.com/demo/image/upload/w_400,c_limit,f_jpg/sample.jpg";

async function step(name: string, fn: () => Promise<string>) {
  const started = Date.now();
  try {
    const detail = await fn();
    console.log(`  PASS  ${name} (${Date.now() - started} ms) ${detail}`);
    return true;
  } catch (err: any) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    return false;
  }
}

async function main() {
  if (!llmConfigured()) {
    console.log("GEMINI_API_KEY is not set in .env. Get one at https://aistudio.google.com/apikey");
    process.exit(1);
  }
  console.log(`Model: ${MODEL}   Embeddings: ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS} dims)\n`);

  const results = [
    await step("text generation", async () => `-> "${(await generate({ text: "Reply with the single word: ready", maxOutputTokens: 200 })).trim().slice(0, 40)}"`),
    await step("JSON mode", async () => {
      const raw = await generate({ text: 'Reply ONLY with JSON: {"ok": true, "n": 3}', json: true, maxOutputTokens: 300 });
      return `-> ${JSON.stringify(extractJson(raw))}`;
    }),
    await step("image understanding", async () => {
      const raw = await generate({ text: "Describe this image in one short sentence.", images: [SAMPLE_IMAGE], maxOutputTokens: 300 });
      return `-> "${raw.trim().slice(0, 70)}"`;
    }),
    await step("embedding (query)", async () => {
      const v = await embed("riverbank erosion damage", "query");
      return `-> ${v.length} dims, norm ${Math.sqrt(v.reduce((s, x) => s + x * x, 0)).toFixed(3)}`;
    }),
    await step("embedding (document)", async () => {
      const v = await embed("Flooded riverbank with debris after heavy rain", "document");
      return `-> ${v.length} dims`;
    }),
  ];

  const failed = results.filter((r) => !r).length;
  console.log(
    failed === 0
      ? "\nAll checks passed."
      : `\n${failed} check(s) failed. If a model id was rejected, set GEMINI_MODEL / GEMINI_EMBEDDING_MODEL in .env (model list: https://ai.google.dev/gemini-api/docs/models).`
  );
  process.exit(failed === 0 ? 0 : 1);
}

main();
