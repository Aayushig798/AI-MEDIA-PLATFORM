import type { ImpactType } from "@prisma/client";

const IMPACT_TYPES: ImpactType[] = ["GREENING", "WATER", "INFRASTRUCTURE", "COMMUNITY", "OTHER"];

export interface ProjectIntegrityFields {
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadiusM?: number;
  impactType?: ImpactType;
  claim?: string | null;
}

/** Validate the Integrity Engine inputs a project can carry (site, geofence, claim). */
export function parseProjectIntegrityFields(
  body: Record<string, any>
): { data: ProjectIntegrityFields } | { error: string } {
  const data: ProjectIntegrityFields = {};

  for (const key of ["latitude", "longitude"] as const) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === "") {
      data[key] = null;
      continue;
    }
    const n = Number(body[key]);
    const limit = key === "latitude" ? 90 : 180;
    if (!Number.isFinite(n) || Math.abs(n) > limit) return { error: `${key} must be a number within ±${limit}` };
    data[key] = n;
  }

  if (body.geofenceRadiusM !== undefined && body.geofenceRadiusM !== "") {
    const r = Number(body.geofenceRadiusM);
    if (!Number.isInteger(r) || r < 50 || r > 200_000) return { error: "geofenceRadiusM must be 50–200000 metres" };
    data.geofenceRadiusM = r;
  }

  if (body.impactType !== undefined) {
    if (!IMPACT_TYPES.includes(body.impactType)) return { error: `impactType must be one of ${IMPACT_TYPES.join(", ")}` };
    data.impactType = body.impactType;
  }

  if (body.claim !== undefined) data.claim = typeof body.claim === "string" && body.claim.trim() ? body.claim.trim() : null;

  return { data };
}
