import type { Metadata } from "next";
import { LocateFixed, MapPin, MousePointerClick, ShieldCheck } from "lucide-react";
import { ImpactMap } from "@/components/ImpactMap";

export const metadata: Metadata = {
  title: "Map | EcoEvidence",
  description: "Every verified photo of field impact, on a map, each linked to its independent verification.",
};

// Server component: icons are rendered here directly (component props can't cross into client components).
const NOTES = [
  {
    icon: ShieldCheck,
    chip: "bg-emerald-50 text-emerald-600 ring-emerald-600/10",
    title: "Verified photos only",
    text: "Photos that passed the checks or were approved by a reviewer.",
  },
  {
    icon: LocateFixed,
    chip: "bg-sky-50 text-sky-600 ring-sky-600/10",
    title: "Placed where they were taken",
    text: "At the photo's own GPS location when it has one.",
  },
  {
    icon: MapPin,
    chip: "bg-sky-50 text-sky-600 ring-sky-600/10",
    title: "Otherwise at the project site",
    text: "Shown as a lighter circle, so you can tell the two apart.",
  },
  {
    icon: MousePointerClick,
    chip: "bg-zinc-100 text-zinc-600 ring-zinc-900/5",
    title: "Select a point",
    text: "See the photo and open its full verification page.",
  },
];

export default function ImpactMapPage() {
  return (
    <div className="space-y-8">
      {/* Same layout as PageHeader */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-[13px] font-medium text-sky-700">Evidence on the ground</p>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-zinc-900">Map</h1>
            <div className="max-w-2xl text-[15px] leading-relaxed text-zinc-500">
              Verified photos, shown where they were taken. Select a point to open its verification.
            </div>
          </div>
        </div>
      </div>

      <ImpactMap height={620} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {NOTES.map(({ icon: Icon, chip, title, text }) => (
          <div key={title} className="card flex gap-3 p-4">
            <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${chip}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold text-zinc-900">{title}</p>
              <p className="text-[13px] leading-relaxed text-zinc-500">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
