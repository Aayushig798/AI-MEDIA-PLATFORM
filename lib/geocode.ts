import { prisma } from "@/lib/db";

/**
 * Turn a place name ("Pune, Maharashtra, India") into coordinates with the
 * Open-Meteo geocoding API (free, no key). Field teams type project locations
 * as text and rarely enter latitude/longitude, so without this the weather and
 * satellite checks and the impact map would have nothing to work with.
 */
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

/** Region-sized places (district/state) are big, so auto-placed sites get a wide geofence. */
export const APPROXIMATE_GEOFENCE_M = 50_000;
const DEFAULT_GEOFENCE_M = 5000;

async function lookup(name: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const url = `${GEOCODE_URL}?${new URLSearchParams({ name, count: "1", language: "en", format: "json" })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const json = await res.json();
  const hit = json.results?.[0];
  if (!hit || typeof hit.latitude !== "number") return null;
  return { lat: hit.latitude, lng: hit.longitude, label: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", ") };
}

// Per-process memo, so a place that can't be found isn't looked up again on every map load
const MISS_TTL_MS = 6 * 60 * 60 * 1000;
const memo = new Map<string, { at: number; result: { lat: number; lng: number; label: string } | null }>();

/** Prefer the most specific reading: the whole string, then each comma-separated part. */
export async function geocodePlace(text: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const key = text.trim().toLowerCase();
  const hit = memo.get(key);
  if (hit && (hit.result || Date.now() - hit.at < MISS_TTL_MS)) return hit.result;

  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  const candidates = Array.from(new Set([text.trim(), ...parts])).slice(0, 4);
  // All readings in parallel (one lookup's latency, not four); still pick the most specific hit
  let failed = false;
  const results = await Promise.all(
    candidates.map((c) =>
      lookup(c).catch(() => {
        failed = true; // network hiccup: don't remember this as "not found"
        return null;
      })
    )
  );
  const result = results.find(Boolean) ?? null;
  if (result || !failed) memo.set(key, { at: Date.now(), result });
  return result;
}

/**
 * Fill a project's site coordinates from its location text, once. Coordinates a
 * person entered are never overwritten. Returns the coordinates in use, or null.
 */
export async function ensureProjectSite(project: {
  id: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number;
}): Promise<{ lat: number; lng: number } | null> {
  if (project.latitude != null && project.longitude != null) return { lat: project.latitude, lng: project.longitude };
  if (!project.location?.trim()) return null;

  const found = await geocodePlace(project.location);
  if (!found) return null;

  await prisma.project.update({
    where: { id: project.id },
    data: {
      latitude: found.lat,
      longitude: found.lng,
      // A place name is only approximate, so don't fail photos for being a few km from its centre
      ...(project.geofenceRadiusM === DEFAULT_GEOFENCE_M && { geofenceRadiusM: APPROXIMATE_GEOFENCE_M }),
    },
  });
  return { lat: found.lat, lng: found.lng };
}
