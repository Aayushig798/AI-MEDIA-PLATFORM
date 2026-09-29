"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";

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

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10" style={{ height }}>
      <MapContainer center={[20, 78]} zoom={3} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {points.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={p.source === "photo" ? 9 : 7}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: p.source === "photo" ? "#10b981" : "#0ea5e9",
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <div style={{ width: 180 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbUrl} alt="" style={{ width: "100%", borderRadius: 6, marginBottom: 6 }} />
                <div style={{ fontWeight: 700, fontSize: 12 }}>{p.projectName}</div>
                <div style={{ fontSize: 11, color: "#475569" }}>
                  Trust {p.trustScore ?? "–"}
                  {p.humanApproved ? " · human-approved" : ""} · {p.capturedAt ? p.capturedAt.slice(0, 10) : "undated"}
                </div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                  {p.source === "photo" ? "Placed at the photo's GPS" : "Placed at the project site (no photo GPS)"}
                </div>
                <a href={`/verify/${p.id}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700 }}>
                  Open verification →
                </a>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {loaded && points.length === 0 && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-slate-950/70 text-xs text-slate-300 pointer-events-none">
          No verified evidence with a location yet.
        </div>
      )}
      <div className="absolute bottom-2 left-2 z-[500] flex gap-3 rounded-lg bg-slate-950/80 px-2.5 py-1.5 text-[10px] text-slate-300">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> photo GPS
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" /> project site
        </span>
      </div>
    </div>
  );
}
