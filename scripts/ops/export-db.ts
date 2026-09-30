/**
 * Exports the database of the local Docker Compose stack and uploads it to Cloudinary
 * as a PRIVATE raw file (not downloadable without a signed link), ready for
 * .github/workflows/restore-db.yml to load onto the server.
 *
 *   npm run db:export
 *
 * Prints the public_id to paste into the "Restore database" workflow.
 */
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const compose = (...args: string[]) => execFileSync("docker", ["compose", ...args], { stdio: ["ignore", "pipe", "inherit"] }).toString().trim();

async function main() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const counts = compose(
    "exec", "-T", "db", "psql", "-U", "ecoevidence", "-d", "ecoevidence", "-tAc",
    `SELECT (SELECT count(*) FROM "Project") || ' projects, ' || (SELECT count(*) FROM "MediaAsset") || ' assets, ' || (SELECT count(*) FROM "LedgerEntry") || ' ledger entries'`
  );
  console.log(`Local database: ${counts}`);

  // Dump inside the container and copy the file out (binary-safe on every shell)
  const dir = mkdtempSync(path.join(tmpdir(), "db-export-"));
  const file = path.join(dir, "export.dump");
  try {
    compose("exec", "-T", "db", "pg_dump", "-U", "ecoevidence", "-d", "ecoevidence", "-Fc", "-f", "/tmp/export.dump");
    compose("cp", "db:/tmp/export.dump", file);
    compose("exec", "-T", "db", "rm", "-f", "/tmp/export.dump");

    const res = await cloudinary.uploader.upload(file, {
      resource_type: "raw",
      type: "private",
      public_id: `db-exports/export-${stamp}.dump`,
    });
    console.log(`Uploaded ${Math.round(res.bytes / 1024)} KB as a private file.`);
    console.log(`\npublic_id: ${res.public_id}`);
    console.log(`\nLoad it onto the server (replaces the live database; it is backed up first):`);
    console.log(`  gh workflow run restore-db.yml -f dump_public_id=${res.public_id} -f confirm=REPLACE`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
