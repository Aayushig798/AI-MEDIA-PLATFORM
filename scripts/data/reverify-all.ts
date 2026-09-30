/**
 * Re-run the Integrity Engine on every asset:  npm run integrity:reverify
 *
 * Use after new checks were switched on (e.g. adding GEMINI_API_KEY), so photos that
 * were scored earlier with most checks skipped get a fresh, complete score.
 *   npm run integrity:reverify              all assets
 *   npm run integrity:reverify -- <projectId>   one project only
 *
 * Runs against the DATABASE_URL in .env (shows the host, never credentials).
 */
try {
  process.loadEnvFile(".env");
} catch {
  // rely on the real environment
}

import { prisma } from "../../lib/db";
import { runIntegrity } from "../../lib/integrity/run";

const PAUSE_MS = 1500; // stay under the free-tier request rate of the AI and weather services

async function main() {
  const projectId = process.argv[2];
  try {
    const u = new URL(process.env.DATABASE_URL || "");
    console.log(`Database: ${u.hostname}${u.pathname}`);
  } catch {
    console.log("DATABASE_URL is missing or invalid");
    process.exit(1);
  }

  const assets = await prisma.mediaAsset.findMany({
    where: projectId ? { projectId } : {},
    select: { id: true, manualNotes: true, project: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Re-verifying ${assets.length} asset(s)${projectId ? ` in ${projectId}` : ""}\n`);

  let done = 0;
  const tally: Record<string, number> = {};
  for (const a of assets) {
    const started = Date.now();
    const r = await runIntegrity(a.id, "reverify-script");
    done++;
    const verdict = r.status === "DONE" ? String(r.verdict) : r.status;
    tally[verdict] = (tally[verdict] ?? 0) + 1;
    const skipped = ((r.checks as any[]) ?? []).filter((c) => c.status === "skipped").length;
    console.log(
      `[${done}/${assets.length}] ${a.project.name.slice(0, 28).padEnd(28)} trust ${String(r.trustScore ?? "-").padStart(3)} ${verdict.padEnd(8)} ` +
        `(${skipped} check${skipped === 1 ? "" : "s"} skipped, ${Date.now() - started} ms)`
    );
    await new Promise((res) => setTimeout(res, PAUSE_MS));
  }

  console.log("\nSummary:", Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(" · ") || "nothing to do");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
