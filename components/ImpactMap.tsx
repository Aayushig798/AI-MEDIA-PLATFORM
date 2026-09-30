"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Leaflet touches `window`, so it only renders in the browser.
export const ImpactMap = dynamic(() => import("./ImpactMapInner"), {
  ssr: false,
  loading: () => (
    <div className="card relative h-[420px] overflow-hidden">
      <div className="skeleton absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-sm text-zinc-600 shadow-sm ring-1 ring-black/5 backdrop-blur">
          <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
          Loading map
        </span>
      </div>
    </div>
  ),
});
