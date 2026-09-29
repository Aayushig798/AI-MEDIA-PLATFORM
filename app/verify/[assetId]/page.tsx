import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, CloudRain, Satellite, Bot, Fingerprint, Globe, ExternalLink, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { signedOriginalUrl } from "@/lib/cloudinary";
import { withTransformation, EVIDENCE_TRANSFORMATION, getThumbnailUrl } from "@/lib/cloudinary-url";
import { TrustBadge, effectiveVerdict } from "@/components/TrustBadge";
import { CheckList, CheckResultView } from "@/components/CheckList";
import { ChainVerifier } from "@/components/ChainVerifier";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify evidence | EcoEvidence",
  description: "Independent verification of a field photo: Trust Score, checks and tamper-evident ledger.",
};

function appOrigin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  return process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || `${proto}://${host}`;
}

const RING = { VERIFIED: "text-emerald-400", REVIEW: "text-amber-400", FLAGGED: "text-rose-400" } as const;

export default async function VerifyPage({ params }: { params: { assetId: string } }) {
  const asset = await db.mediaAsset.findUnique({
    where: { id: params.assetId },
    include: {
      project: true,
      integrity: true,
      derived: { orderBy: { createdAt: "desc" } },
      phashMatches: { orderBy: { hamming: "asc" }, take: 4 },
      webMatches: { take: 6 },
    },
  });
  if (!asset) notFound();

  const integrity = asset.integrity;
  const checks = ((integrity?.checks as unknown) as CheckResultView[]) ?? [];
  const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
  const verdict = effectiveVerdict(integrity as any);
  const pageUrl = `${appOrigin()}/verify/${asset.id}`;

  const evidence =
    asset.derived.find((d) => d.class === "TRANSCODED")?.url ??
    withTransformation(asset.secureUrl, EVIDENCE_TRANSFORMATION, asset.resourceType === "video" ? "jpg" : undefined);
  const original = asset.secureUrl.includes("res.cloudinary.com")
    ? signedOriginalUrl(asset.cloudinaryPublicId, asset.resourceType, asset.format)
    : asset.secureUrl;

  const matchAssets = await db.mediaAsset.findMany({
    where: { id: { in: asset.phashMatches.map((m) => m.matchAssetId) } },
    select: { id: true, secureUrl: true, resourceType: true, project: { select: { name: true } } },
  });

  const weather = byId.weather?.details as any;
  const sat = byId.satellite?.details as any;
  const claim = byId.claim?.details as any;
  const location = byId.location?.details as any;
  const pin = location?.gps ?? (integrity?.gpsLat != null ? { lat: integrity.gpsLat, lng: integrity.gpsLng } : null);
  const site = asset.project.latitude != null ? { lat: asset.project.latitude, lng: asset.project.longitude! } : null;
  const mapCenter = pin ?? site;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Public evidence verification
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">{asset.project.name}</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Claim: {asset.claimText || asset.project.claim || asset.manualNotes || "No claim recorded"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/qr?url=${encodeURIComponent(pageUrl)}`} alt="QR code for this page" className="w-20 h-20 rounded-lg bg-white p-1" />
          <p className="text-[11px] text-slate-500 max-w-[9rem]">Scan to open this verification on any phone.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Evidence */}
        <div className="lg:col-span-7 space-y-3">
          <div className="glass-panel rounded-2xl p-3 border border-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={evidence} alt={asset.manualNotes || "Field evidence"} className="w-full max-h-[65vh] object-contain rounded-xl bg-black" />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-[11px] text-slate-400">
              <span>
                Shown via a <span className="text-emerald-300 font-semibold">transcoded</span> derivative (fit, format, quality only), so
                it depicts exactly what the original does.
              </span>
              <a href={original} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-300 hover:underline">
                <ExternalLink className="w-3 h-3" /> Original (signed URL)
              </a>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <p className="text-slate-500">SHA-256 <span className="block font-mono text-slate-300 break-all">{asset.sha256 ?? "—"}</span></p>
            <p className="text-slate-500">Cloudinary pHash <span className="block font-mono text-slate-300">{asset.phash ?? "—"}</span></p>
            <p className="text-slate-500">Claimed capture <span className="block text-slate-300">{asset.capturedAt?.toISOString().slice(0, 10) ?? "—"}</span></p>
            <p className="text-slate-500">Camera capture (EXIF) <span className="block text-slate-300">{integrity?.takenAt?.toISOString().slice(0, 10) ?? "—"}</span></p>
          </div>
        </div>

        {/* Score */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel rounded-2xl p-5 border border-white/5">
            {integrity?.status === "DONE" ? (
              <div className="flex items-center gap-4">
                <div className={`text-6xl font-black tabular-nums ${verdict ? RING[verdict] : "text-slate-300"}`}>{integrity.trustScore}</div>
                <div className="space-y-1">
                  <TrustBadge integrity={integrity as any} size="lg" />
                  <p className="text-[11px] text-slate-400">
                    Trust Score out of 100, computed {integrity.computedAt?.toISOString().slice(0, 16).replace("T", " ")} UTC. It is triage
                    for human reviewers, not an accusation.
                  </p>
                  {integrity.reviewDecision && (
                    <p className="text-[11px] text-slate-300">
                      Human reviewer {integrity.reviewDecision.toLowerCase()} this asset{integrity.reviewNote ? `: “${integrity.reviewNote}”` : "."}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">This asset has not been verified yet.</p>
            )}
          </div>
          {checks.length > 0 && <CheckList checks={checks} />}
        </div>
      </div>

      {/* Context cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-panel rounded-2xl p-4 border border-white/5 space-y-2">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-teal-400" /> Location</h3>
          {mapCenter ? (
            <>
              <iframe
                title="Map"
                className="w-full h-40 rounded-xl border border-white/10"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCenter.lng - 0.03},${mapCenter.lat - 0.02},${mapCenter.lng + 0.03},${mapCenter.lat + 0.02}&layer=mapnik&marker=${mapCenter.lat},${mapCenter.lng}`}
              />
              <p className="text-[11px] text-slate-400">
                {pin ? `Photo GPS ${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}` : "No photo GPS; showing the project site."}
                {location?.distanceM != null && ` · ${location.distanceM} m from site (geofence ${location.radiusM} m)`}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-slate-500">No location available.</p>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-white/5 space-y-2">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><CloudRain className="w-3.5 h-3.5 text-cyan-400" /> Weather that day</h3>
          {weather?.days ? (
            <>
              <div className="flex items-end gap-2 h-20">
                {weather.days.map((d: any) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-cyan-500/60 rounded-t" style={{ height: `${Math.min(64, (d.precipitationMm ?? 0) * 3 + 2)}px` }} />
                    <span className="text-[9px] text-slate-500">{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">{byId.weather.summary}</p>
              <p className="text-[10px] text-slate-600">Open-Meteo historical record at {weather.site?.source === "exif" ? "photo GPS" : "project site"}.</p>
            </>
          ) : (
            <p className="text-[11px] text-slate-500">{byId.weather?.summary ?? "Not checked."}</p>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-white/5 space-y-2">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><Satellite className="w-3.5 h-3.5 text-violet-400" /> Satellite (Sentinel-2)</h3>
          {sat?.delta != null ? (
            <>
              <p className="text-2xl font-black text-white tabular-nums">
                {sat.before} → {sat.after}
              </p>
              <p className="text-[11px] text-slate-400">
                {String(sat.index).toUpperCase()} {sat.beforeDate} → {sat.afterDate}. 10 m pixels: a consistency check, not proof.
              </p>
            </>
          ) : (
            <p className="text-[11px] text-slate-500">{byId.satellite?.summary ?? "Not checked."}</p>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-white/5 space-y-2">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><Bot className="w-3.5 h-3.5 text-emerald-400" /> AI auditor (Cloudinary AI Vision)</h3>
          {claim?.answers?.length ? (
            <ul className="space-y-1">
              {claim.answers.map((a: any) => (
                <li key={a.question} className="text-[11px] text-slate-300">
                  <span className={a.answer === "yes" ? "text-emerald-400" : a.answer === "no" ? "text-rose-400" : "text-slate-500"}>
                    {a.answer}
                  </span>{" "}
                  · {a.question.replace(/^Is there visible evidence in this image of: /, "")}
                </li>
              ))}
              {claim.description && <li className="text-[11px] text-slate-500 italic pt-1">“{claim.description}”</li>}
            </ul>
          ) : (
            <p className="text-[11px] text-slate-500">{byId.claim?.summary ?? "Not checked."}</p>
          )}
        </div>
      </div>

      {(asset.phashMatches.length > 0 || asset.webMatches.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {asset.phashMatches.length > 0 && (
            <div className="glass-panel rounded-2xl p-4 border border-white/5 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><Fingerprint className="w-3.5 h-3.5 text-rose-400" /> Visually matching photos in the library</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {asset.phashMatches.map((m) => {
                  const other = matchAssets.find((a) => a.id === m.matchAssetId);
                  return (
                    <Link key={m.id} href={`/verify/${m.matchAssetId}`} className="space-y-1 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {other && <img src={getThumbnailUrl(other.secureUrl, other.resourceType)} alt="match" className="w-full aspect-square object-cover rounded-lg border border-white/10 group-hover:border-rose-400/60" />}
                      <p className="text-[10px] text-slate-400">
                        {Math.round((1 - m.hamming / 64) * 100)}% · {m.crossProject ? <span className="text-rose-300">other project</span> : "same project"}
                      </p>
                      {other && <p className="text-[10px] text-slate-500 truncate">{other.project.name}</p>}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          {asset.webMatches.length > 0 && (
            <div className="glass-panel rounded-2xl p-4 border border-white/5 space-y-2">
              <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-rose-400" /> Found on the web</h3>
              <ul className="space-y-1">
                {asset.webMatches.map((w) => (
                  <li key={w.id} className="text-[11px] truncate">
                    <span className="text-slate-500 mr-1.5">{w.kind.toLowerCase()}</span>
                    <a href={w.url} target="_blank" rel="noopener noreferrer nofollow" className="text-cyan-300 hover:underline">
                      {w.pageTitle || w.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ChainVerifier assetId={asset.id} title="This asset's tamper-evident history" />
    </div>
  );
}
