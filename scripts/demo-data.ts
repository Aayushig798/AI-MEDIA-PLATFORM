/**
 * Loads a full demo into a running instance through its own API, the same way a
 * user would: creates 5 projects, uploads real field photos to Cloudinary,
 * registers them (AI tagging), runs the Integrity Engine on every photo, saves a
 * before/after comparison, writes a report per project and seals the ledger.
 *
 *   npm run demo:data                                  # http://localhost:3000
 *   DEMO_BASE_URL=https://your-domain npm run demo:data
 *
 * Photos are CC-licensed Wikimedia Commons originals (camera EXIF and GPS
 * intact); each asset's notes credit the photographer. Two uploads are staged
 * fraud: a byte-identical photo reused in another project, and a resized copy
 * only the perceptual hash can link. Safe to re-run: it resumes, reusing
 * projects and photos already there and re-checking any that failed.
 */
import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "crypto";

const BASE = (process.env.DEMO_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const UA = { "User-Agent": "ecoevidence-demo-data/1.0 (hackathon demo loader)" };

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

type ImpactType = "GREENING" | "WATER" | "INFRASTRUCTURE" | "COMMUNITY" | "OTHER";
interface Photo {
  key: string;
  file: string; // Wikimedia Commons file title
  location: string;
  notes: string;
  /** Upload a smaller re-encoded copy instead of the original (pHash-only fraud) */
  resized?: boolean;
  /** Re-upload the exact bytes of an earlier photo (byte-identical fraud) */
  copyOf?: string;
}
interface DemoProject {
  name: string;
  description: string;
  location: string;
  startDate: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusM?: number;
  impactType: ImpactType;
  claim: string;
  photos: Photo[];
}

const MANGROVE = (n: string) =>
  `File:PXL 20250518 070423311.MP Hingalganj mangrove plantation Sundarbans and People and River Icchamati ${n}.jpg`;

const PROJECTS: DemoProject[] = [
  {
    name: "Mangrove Belt, Hingalganj (Sundarbans)",
    description: "Community-planted mangrove belt on the Icchamati river embankment, a natural buffer against storm surge and erosion.",
    location: "Hingalganj, North 24 Parganas, West Bengal, India",
    startDate: "2024-07-01",
    latitude: 22.4628,
    longitude: 88.9945,
    geofenceRadiusM: 3000,
    impactType: "GREENING",
    claim: "Community members planted mangroves along the Icchamati river embankment, and the planted belt is now established",
    photos: [
      { key: "mangrove_canopy", file: MANGROVE("22"), location: "Embankment plantation, Hingalganj", notes: "Established mangrove stand on the protected embankment." },
      { key: "mangrove_flowers", file: MANGROVE("17"), location: "Embankment plantation, Hingalganj", notes: "Close-up: planted mangrove in flower, a sign the stand is maturing." },
      { key: "mangrove_grass", file: MANGROVE("13"), location: "Riverbank, Hingalganj", notes: "Stabilised grass and sapling strip along the river edge." },
      { key: "mangrove_bank", file: MANGROVE("18"), location: "Riverbank, Hingalganj", notes: "Vegetated embankment where the river bends toward the village." },
      { key: "mangrove_village", file: MANGROVE("07"), location: "Village ghat, Hingalganj", notes: "Village landing the embankment protects; fishing boats moored below." },
    ],
  },
  {
    name: "Johad Revival, Hamirpur (Alwar)",
    description: "Reviving traditional johads, earthen ponds that catch monsoon runoff and recharge village wells.",
    location: "Hamirpur, Alwar, Rajasthan, India",
    startDate: "2021-06-01",
    latitude: 27.186,
    longitude: 76.19,
    geofenceRadiusM: 5000,
    impactType: "WATER",
    claim: "Revived village johads (traditional earthen rainwater-harvesting ponds) that hold monsoon runoff",
    photos: [
      { key: "johad_nahar", file: "File:Nahar nala ka johad hamirpur.jpg", location: "Nahar nala johad, Hamirpur", notes: "Johad embankment with water still held in March, months after the monsoon." },
      { key: "johad_bharthri", file: "File:Bharthri wala johad hamirpur.jpg", location: "Bharthri wala johad, Hamirpur", notes: "Catchment of the Bharthri wala johad below the hills." },
      { key: "johad_bharthari_dry", file: "File:Bharthari wala johad hamirpur.jpg", location: "Bharthri wala johad, Hamirpur", notes: "Dry johad bed in the pre-monsoon season." },
      { key: "johad_lameda", file: "File:Lameda ka johad hamirpur.jpg", location: "Lameda johad, Hamirpur", notes: "Villagers at the Lameda johad catchment, with young trees planted around it." },
    ],
  },
  {
    name: "Check Dam, Panchlai (Valsad)",
    description: "Masonry check dam on the Par river that holds a reservoir for irrigation and groundwater recharge.",
    // No coordinates on purpose: the app locates the site from the place name
    location: "Panchlai, Pardi, Valsad, Gujarat, India",
    startDate: "2010-03-01",
    impactType: "WATER",
    claim: "Built a masonry check dam across the river, with a reservoir held behind it",
    photos: [
      { key: "checkdam_reservoir", file: "File:Water Reservoir,Panchlai Check Dam, Pardi, Valsad - panoramio.jpg", location: "Panchlai check dam", notes: "Reservoir held behind the check dam after the monsoon." },
      { key: "checkdam_weir", file: "File:Panchlai Check Dam, Panchlai, Pardi - panoramio.jpg", location: "Panchlai check dam", notes: "Full-width view of the weir spilling excess flow." },
      { key: "checkdam_spill", file: "File:Check Dam at Panchlai, Pardi, Valsad - panoramio.jpg", location: "Panchlai check dam", notes: "Water overtopping the dam crest: the structure is holding." },
      { key: "checkdam_wall", file: "File:Panchlai Check Dam, Pardi, Valsad - panoramio (1).jpg", location: "Panchlai check dam, left bank", notes: "Masonry wing wall and apron on the left bank." },
      // STAGED FRAUD: the Hamirpur johad photo, byte-identical, resubmitted as check-dam evidence
      { key: "fraud_recycled_johad", file: "File:Nahar nala ka johad hamirpur.jpg", copyOf: "johad_nahar", location: "Panchlai check dam, upstream", notes: "Upstream reservoir after the first monsoon rains." },
    ],
  },
  {
    name: "Miyawaki Mini-Forest, Edappally (Kochi)",
    description: "Dense native mini-forest planted with the Miyawaki method on a small urban plot.",
    location: "Edappally, Kochi, Kerala, India",
    startDate: "2021-06-05",
    latitude: 10.0261,
    longitude: 76.3083,
    geofenceRadiusM: 2000,
    impactType: "GREENING",
    claim: "Planted a dense Miyawaki mini-forest of native species on a small urban plot",
    photos: [
      { key: "miyawaki_01", file: "File:Miyawaki forest at Edappally Eranakulam 01.jpg", location: "Miyawaki plot, Edappally", notes: "The mini-forest two years after planting, seen from the road." },
      { key: "miyawaki_02", file: "File:Miyawaki forest at Edappally Eranakulam 02.jpg", location: "Miyawaki plot, Edappally", notes: "Multi-layer native canopy inside the fenced plot." },
      { key: "miyawaki_03", file: "File:Miyawaki forest at Edappally Eranakulam 03.jpg", location: "Miyawaki plot, Edappally", notes: "Labelled native saplings along the plot edge." },
      { key: "miyawaki_04", file: "File:Miyawaki forest at Edappally Eranakulam 04.jpg", location: "Miyawaki plot, Edappally", notes: "Young trees already taller than the fence posts." },
      // STAGED FRAUD: the Sundarbans mangrove photo, resized and re-encoded (not byte-identical)
      { key: "fraud_resized_mangrove", file: MANGROVE("22"), resized: true, location: "Miyawaki plot, Edappally", notes: "Canopy closing over the plot eighteen months after planting." },
    ],
  },
  {
    name: "Village Water Supply, Otho Abwao (Kenya)",
    description: "Pumped drinking-water system with storage tanks and public tap stands, built with Engineers Without Borders volunteers.",
    location: "Otho Abwao, Homa Bay County, Kenya",
    startDate: "2008-09-01",
    geofenceRadiusM: 20000,
    impactType: "INFRASTRUCTURE",
    claim: "Installed a pumped drinking-water system with storage tanks and public tap stands for the village",
    photos: [
      { key: "kenya_trench", file: "File:Daniel Oerther working with students to route drinking water distribution system in Otho Abwao Kenya.jpg", location: "Distribution line, Otho Abwao", notes: "Laying the distribution pipe to the tap stands." },
      { key: "kenya_inspect", file: "File:Daniel Oerther inspecting water storage tanks in Otho Abwao Kenya.jpg", location: "Storage tanks, Otho Abwao", notes: "Inspecting the new storage tanks before commissioning." },
      { key: "kenya_tanks", file: "File:Pumped water flowing into the storage tanks in Otho Abwao Kenya.jpg", location: "Storage tanks, Otho Abwao", notes: "First pumped water flowing into the storage tanks." },
      { key: "kenya_children", file: "File:School children amazed by flowing water from pipe stand in Otho Abwao Kenya.jpg", location: "School tap stand, Otho Abwao", notes: "School children at the new tap stand on commissioning day." },
      { key: "kenya_stand_2011", file: "File:Daniel Oerther posing next to a water stand in Otho Abwao Kenya.jpg", location: "Tap stand, Otho Abwao", notes: "Two years on: the tap stand still in daily use." },
    ],
  },
];

/** Before/after pairs saved like a user picking two photos (verification decides "verified") */
const COMPARISONS: { before: string; after: string; notes: string }[] = [
  { before: "kenya_children", after: "kenya_stand_2011", notes: "Tap stand on commissioning day (2009) and still in use two years later (2011)." },
];

async function api(path: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method || (init?.body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

const commonsInfo = new Map<
  string,
  { url: string; thumb: string; artist: string; license: string; takenAt: string | null }
>();
async function loadCommonsInfo(titles: string[]) {
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const q = new URLSearchParams({
      action: "query", format: "json", prop: "imageinfo", iiprop: "url|extmetadata|metadata",
      iiextmetadatafilter: "LicenseShortName|Artist", iiurlwidth: "1920", titles: batch.join("|"),
    });
    const j: any = await (await fetch(`https://commons.wikimedia.org/w/api.php?${q}`, { headers: UA })).json();
    const normalized = new Map<string, string>((j.query?.normalized || []).map((n: any) => [n.to, n.from]));
    for (const p of Object.values<any>(j.query?.pages || {})) {
      const info = p.imageinfo?.[0];
      if (!info) throw new Error(`Wikimedia file not found: ${p.title}`);
      const exifDate = (info.metadata || []).find((m: any) => m.name === "DateTimeOriginal")?.value;
      const url = info.url.split("?")[0];
      let thumb = info.thumburl.split("?")[0];
      // Images narrower than 1920 px get the original back as their "thumbnail"
      if (!thumb.includes("/thumb/")) {
        const path = url.split("/wikipedia/commons/")[1]; // "8/8c/Name.jpg"
        const name = path.split("/").pop();
        thumb = `https://thumb.wikimedia.org/wikipedia/commons/thumb/${path}/960px-${name}`;
      }
      commonsInfo.set(normalized.get(p.title) || p.title, {
        url,
        thumb,
        artist: String(info.extmetadata?.Artist?.value || "unknown").replace(/<[^>]+>/g, "").trim(),
        license: info.extmetadata?.LicenseShortName?.value || "see Wikimedia Commons",
        // "2011:09:11 13:20:53" -> "2011-09-11T13:20:53"
        takenAt: typeof exifDate === "string" ? exifDate.replace(/^(\d{4}):(\d{2}):(\d{2}) /, "$1-$2-$3T") : null,
      });
    }
  }
}

async function uploadToCloudinary(sourceUrl: string, projectId: string) {
  // Same options the app signs for browser uploads, minus the webhook
  const options: Record<string, unknown> = {
    folder: `impact-platform/${projectId}/${randomUUID()}`,
    categorization: "google_tagging",
    auto_tagging: 0.6,
    image_metadata: true,
    phash: true,
  };
  try {
    return await cloudinary.uploader.upload(sourceUrl, options);
  } catch (err: any) {
    const msg = String(err?.message || err?.error?.message || err);
    if (!/categorization|tagging|add-?on/i.test(msg)) throw new Error(msg);
    console.warn(`    auto-tagging add-on unavailable (${msg}); uploading without it`);
    delete options.categorization;
    delete options.auto_tagging;
    return cloudinary.uploader.upload(sourceUrl, options);
  }
}

/**
 * Upload a Commons photo, preferring the original (camera EXIF and GPS intact).
 * Wikimedia throttles original-file downloads (HTTP 429), and a busy shared IP can
 * hit that quickly; then the 1920 px thumbnail is used and, since thumbnails carry
 * no EXIF, the photo's capture date is sent as the date the uploader entered.
 */
async function uploadCommonsPhoto(info: NonNullable<ReturnType<typeof commonsInfo.get>>, resized: boolean, projectId: string) {
  if (!resized) {
    try {
      return { up: await uploadToCloudinary(info.url, projectId), claimedDate: null };
    } catch (err: any) {
      if (!/429|Too Many/i.test(err.message)) throw err;
      console.warn("    original is rate-limited by Wikimedia; using the 1920 px copy");
    }
  }
  return { up: await uploadToCloudinary(info.thumb, projectId), claimedDate: resized ? null : info.takenAt };
}

async function main() {
  if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("CLOUDINARY_* keys missing: run with `npm run demo:data` so .env is loaded");
  }
  console.log(`Loading demo data into ${BASE}`);
  await loadCommonsInfo(Array.from(new Set(PROJECTS.flatMap((p) => p.photos.map((ph) => ph.file)))));

  const existing = await api("/api/projects");
  if (!existing.ok) throw new Error(`Can't reach ${BASE}/api/projects (${existing.status}); is the app running?`);
  const existingByName = new Map<string, any>((existing.json.projects || []).map((p: any) => [p.name, p]));

  const assetIdByKey = new Map<string, string>();
  const projectIdByKey = new Map<string, string>();
  const secureUrlByKey = new Map<string, string>();
  const results: { project: string; photo: string; verdict: string; trust: number | null }[] = [];
  const projects: { id: string; name: string }[] = [];

  const verify = async (projectName: string, key: string, assetId: string) => {
    const v = await api(`/api/assets/${assetId}/verify`, { body: {} });
    const verdict = v.json.integrity?.verdict ?? `error: ${String(v.json.error ?? v.status).split("\n").slice(-1)[0]}`;
    const trust = v.json.integrity?.trustScore ?? null;
    results.push({ project: projectName, photo: key, verdict, trust });
    console.log(`    ${key.padEnd(24)} ${String(verdict).padEnd(10)} trust ${trust ?? "-"}`);
  };

  for (const p of PROJECTS) {
    const { photos, ...fields } = p;
    // Re-runs resume: reuse the project and any photo already registered (matched by its notes)
    let projectId: string = existingByName.get(p.name)?.id;
    let existingAssets: any[] = [];
    if (projectId) {
      existingAssets = (await api(`/api/assets?projectId=${projectId}`)).json.assets || [];
      console.log(`= ${p.name} (${projectId}): exists, filling in anything missing`);
    } else {
      const created = await api("/api/projects", { body: fields });
      if (!created.ok) throw new Error(`create project "${p.name}" failed: ${created.json.error}`);
      projectId = created.json.project.id;
      console.log(`+ ${p.name} (${projectId})`);
    }
    projects.push({ id: projectId, name: p.name });

    for (const ph of photos) {
      const already = existingAssets.find((a) => a.manualNotes?.startsWith(ph.notes));
      if (already) {
        assetIdByKey.set(ph.key, already.id);
        projectIdByKey.set(ph.key, projectId);
        secureUrlByKey.set(ph.key, already.secureUrl);
        if (already.integrity?.status === "DONE") {
          results.push({ project: p.name, photo: ph.key, verdict: already.integrity.verdict, trust: already.integrity.trustScore });
        } else {
          await verify(p.name, ph.key, already.id); // failed or never checked: run it again
        }
        continue;
      }
      const info = commonsInfo.get(ph.file)!;
      // A byte-identical copy comes straight from the earlier upload in Cloudinary
      const copied = ph.copyOf ? secureUrlByKey.get(ph.copyOf) : undefined;
      if (ph.copyOf && !copied) throw new Error(`${ph.key}: ${ph.copyOf} must be uploaded first`);
      const { up, claimedDate }: { up: any; claimedDate: string | null } = copied
        ? { up: await uploadToCloudinary(copied, projectId), claimedDate: null }
        : await uploadCommonsPhoto(info, Boolean(ph.resized), projectId);
      const credit = `Photo: ${info.artist}, Wikimedia Commons (${info.license}).`;
      const reg = await api("/api/assets", {
        body: {
          projectId,
          cloudinaryPublicId: up.public_id,
          secureUrl: up.secure_url,
          resourceType: up.resource_type || "image",
          format: up.format,
          bytes: up.bytes,
          width: up.width,
          height: up.height,
          manualCategory: null,
          categorySource: "ai",
          manualLocation: ph.location,
          manualNotes: `${ph.notes} ${credit}`,
          capturedAt: claimedDate, // null: taken from the photo's own EXIF
          info: up,
          filename: ph.file.replace(/^File:/, ""),
        },
      });
      if (!reg.ok) throw new Error(`register ${ph.key} failed: ${reg.json.error}`);
      const assetId = reg.json.asset.id as string;
      assetIdByKey.set(ph.key, assetId);
      projectIdByKey.set(ph.key, projectId);
      secureUrlByKey.set(ph.key, up.secure_url);

      // Integrity Engine: duplicates, pHash, web, EXIF, weather, satellite, AI auditor
      await verify(p.name, ph.key, assetId);
    }
  }

  for (const c of COMPARISONS) {
    const before = assetIdByKey.get(c.before);
    const after = assetIdByKey.get(c.after);
    if (!before || !after) continue;
    const projectId = projectIdByKey.get(c.before);
    const saved = (await api(`/api/comparisons?projectId=${projectId}`)).json.comparisons || [];
    if (saved.some((s: any) => [s.beforeAssetId, s.afterAssetId].sort().join() === [before, after].sort().join())) continue;
    const body = { projectId, beforeAssetId: before, afterAssetId: after, notes: c.notes };
    let res = await api("/api/comparisons", { body });
    if (res.json.needsConfirmation) {
      // What "Save anyway" does in the UI: keep it, marked unverified, with the reason
      console.log(`  comparison ${c.before} -> ${c.after}: ${res.json.reason}`);
      res = await api("/api/comparisons", { body: { ...body, saveAnyway: true, warningReason: res.json.reason } });
    }
    console.log(`  comparison ${c.before} -> ${c.after}: ${res.ok ? (res.json.comparison?.verified ? "saved, verified" : "saved, unverified") : `failed: ${res.json.error}`}`);
  }

  for (const p of projects) {
    const reports = (await api(`/api/projects/${p.id}/reports`)).json.reports || [];
    if (reports.length > 0) continue;
    const r = await api(`/api/projects/${p.id}/reports`, { body: {} });
    console.log(`  report for ${p.name}: ${r.ok ? "generated" : `failed: ${r.json.error}`}`);
  }

  const anchor = await api("/api/ledger/anchor", { body: {} });
  console.log(`  ledger anchor: ${anchor.json.anchor ? `sealed entries #${anchor.json.anchor.fromSeq}-#${anchor.json.anchor.toSeq}` : anchor.json.message || anchor.json.error}`);

  console.log("\nVerdicts:");
  for (const r of results) console.log(`  ${r.project.slice(0, 34).padEnd(34)} ${r.photo.padEnd(24)} ${String(r.verdict).padEnd(10)} ${r.trust ?? "-"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
