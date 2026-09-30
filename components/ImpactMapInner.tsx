"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import { ArrowUpRight, CalendarDays, Loader2, LocateFixed, MapPin, ShieldCheck, UserCheck } from "lucide-react";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  source: "photo" | "project";
  thumbUrl: string;
  trustScore: number | null;
  humanApproved: boolean;
  capturedAt: string | null;
  category: string | null;
  projectId: string;
  projectName: string;
}

const EMERALD = "#059669";

// Restyles Leaflet's popup shell (rounded card, no inner margin, round close button over the photo).
const POPUP_CLASS = [
  "[&_.leaflet-popup-content-wrapper]:overflow-hidden",
  "[&_.leaflet-popup-content-wrapper]:rounded-2xl",
  "[&_.leaflet-popup-content-wrapper]:p-0",
  "[&_.leaflet-popup-content-wrapper]:shadow-[0_16px_40px_-12px_rgba(16,24,40,0.35)]",
  "[&_.leaflet-popup-content]:m-0",
  "[&_a.leaflet-popup-close-button]:!right-2",
  "[&_a.leaflet-popup-close-button]:!top-2",
  "[&_a.leaflet-popup-close-button]:z-10",
  "[&_a.leaflet-popup-close-button]:!h-6",
  "[&_a.leaflet-popup-close-button]:!w-6",
  "[&_a.leaflet-popup-close-button]:!rounded-full",
  "[&_a.leaflet-popup-close-button]:!bg-white/90",
  "[&_a.leaflet-popup-close-button]:!text-zinc-700",
  "[&_a.leaflet-popup-close-button]:!leading-6",
  "[&_a.leaflet-popup-close-button]:shadow-sm",
].join(" ");

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 11);
      return;
    }
    const bounds: LatLngBoundsExpression = points.map((p) => [p.lat, p.lng]) as [number, number][];
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }, [map, points]);
  return null;
}

/** Leaflet map of verified evidence (client only; loaded via ImpactMap). */
export default function ImpactMapInner({ projectId, height = 420 }: { projectId?: string; height?: number }) {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/map${projectId ? `?projectId=${projectId}` : ""}`)
      .then((r) => r.json())
      .then((d) => setPoints(d.success ? d.points : []))
      .finally(() => setLoaded(true));
  }, [projectId]);

  // Counts for the overlay, straight from the loaded points.
  const photoCount = points.filter((p) => p.source === "photo").length;
  const siteCount = points.length - photoCount;
  const projectCount = new Set(points.map((p) => p.projectId)).size;
  const approvedCount = points.filter((p) => p.humanApproved).length;

  return (
    <div className="card relative isolate overflow-hidden" style={{ height }}>
      <MapContainer center={[20, 78]} zoom={3} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles-muted"
        />
        <FitBounds points={points} />
        {points.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={p.source === "photo" ? 8 : 7}
            pathOptions={{
              color: p.source === "photo" ? "#ffffff" : EMERALD,
              weight: 2,
              fillColor: EMERALD,
              fillOpacity: p.source === "photo" ? 0.95 : 0.25,
            }}
          >
            <Popup className={POPUP_CLASS}>
              <div className="w-56 font-sans">
                <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
                  <span className="photo-chip absolute bottom-2 left-2">
                    {p.humanApproved ? (
                      <UserCheck className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                    )}
                    {p.humanApproved ? "Approved by a reviewer" : "Verified"}
                  </span>
                </div>
                <div className="space-y-2.5 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-zinc-900">{p.projectName}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                      <CalendarDays className="h-3 w-3 shrink-0 text-sky-600" />
                      <span className="truncate">
                        {p.capturedAt ? p.capturedAt.slice(0, 10) : "No date"}
                        {p.trustScore != null && (
                          <>
                            {" · "}Trust score <span className="tabular-nums">{p.trustScore}</span>/100
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5 rounded-lg bg-zinc-50 px-2 py-1.5 text-[11px] leading-snug text-zinc-500">
                    {p.source === "photo" ? (
                      <LocateFixed className="mt-px h-3 w-3 shrink-0 text-sky-600" />
                    ) : (
                      <MapPin className="mt-px h-3 w-3 shrink-0 text-sky-600" />
                    )}
                    {p.source === "photo" ? "Placed at the photo's GPS location" : "Placed at the project site (photo has no GPS)"}
                  </div>
                  <a
                    href={`/verify/${p.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-600 text-xs font-medium !text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    View verification
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {!loaded && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-sm text-zinc-600 shadow-sm ring-1 ring-black/5 backdrop-blur">
            <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
            Loading verified photos
          </span>
        </div>
      )}

      {loaded && points.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-white/60 px-6">
          <div className="max-w-xs rounded-2xl bg-white p-5 text-center shadow-[0_16px_40px_-16px_rgba(16,24,40,0.3)] ring-1 ring-black/5">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-600/10">
              <MapPin className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-zinc-900">No verified photos with a location yet</p>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
              Photos appear here once they pass the checks and have GPS or a project site.
            </p>
          </div>
        </div>
      )}

      {loaded && points.length > 0 && (
        <>
          {/* Stats */}
          <div className="absolute right-3 top-3 z-[500] flex items-center gap-2.5 rounded-xl bg-white/90 py-2 pl-2 pr-3.5 shadow-[0_8px_24px_-12px_rgba(16,24,40,0.35)] ring-1 ring-black/5 backdrop-blur">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-600/10">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-semibold tabular-nums text-zinc-900">{points.length}</p>
              <p className="text-[11px] text-zinc-500">
                verified {points.length === 1 ? "photo" : "photos"}
                {!projectId && (
                  <>
                    {" · "}
                    <span className="tabular-nums">{projectCount}</span> {projectCount === 1 ? "project" : "projects"}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-[500] min-w-[11rem] space-y-1.5 rounded-xl bg-white/90 px-3 py-2.5 text-xs text-zinc-600 shadow-[0_8px_24px_-12px_rgba(16,24,40,0.35)] ring-1 ring-black/5 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600 ring-2 ring-white" />
              Photo location
              <span className="ml-auto pl-3 font-medium tabular-nums text-zinc-900">{photoCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-emerald-600 bg-emerald-600/25" />
              Project site
              <span className="ml-auto pl-3 font-medium tabular-nums text-zinc-900">{siteCount}</span>
            </div>
            {approvedCount > 0 && (
              <div className="flex items-center gap-2 border-t border-zinc-100 pt-1.5">
                <UserCheck className="h-3 w-3 text-emerald-600" />
                Approved by a reviewer
                <span className="ml-auto pl-3 font-medium tabular-nums text-zinc-900">{approvedCount}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
