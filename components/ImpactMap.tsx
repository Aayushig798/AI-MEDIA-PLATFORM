"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Leaflet touches `window`, so it only renders in the browser.
export const ImpactMap = dynamic(() => import("./ImpactMapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] rounded-2xl border border-white/10 flex items-center justify-center text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
    </div>
  ),
});
