import { Map as MapIcon } from "lucide-react";
import type { Metadata } from "next";
import { ImpactMap } from "@/components/ImpactMap";

export const metadata: Metadata = {
  title: "Impact map | EcoEvidence",
  description: "Every verified photo of field impact, on a map, each linked to its independent verification.",
};

export default function ImpactMapPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
          <MapIcon className="w-4 h-4" /> Living impact map
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Verified evidence, where it happened</h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Only photos that passed the Integrity Engine (or a human reviewer) appear here. Click a point to open its public
          verification page: Trust Score, weather, satellite and tamper-evident history.
        </p>
      </div>
      <ImpactMap height={620} />
    </div>
  );
}
