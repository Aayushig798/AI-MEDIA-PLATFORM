/**
 * Standalone re-verification script for existing comparisons
 * Usage: node --env-file=.env.local scripts/data/reverify-comparisons.mjs
 * Or: npx dotenv-cli -e .env.local -- node scripts/data/reverify-comparisons.mjs
 */

async function run() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  console.log(`Triggering re-verification at ${baseUrl}/api/comparisons/reverify...`);

  try {
    const res = await fetch(`${baseUrl}/api/comparisons/reverify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();
    console.log("Re-verification response status:", res.status);
    console.log("Re-verification result:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to run re-verification script:", err);
    process.exit(1);
  }
}

run();
