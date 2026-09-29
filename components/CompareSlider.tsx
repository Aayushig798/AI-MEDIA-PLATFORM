"use client";

import { useState } from "react";

/** Before/after slider over two identically framed Cloudinary derivatives. */
export function CompareSlider({
  beforeUrl,
  afterUrl,
  beforeLabel,
  afterLabel,
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  const [pos, setPos] = useState(50);

  return (
    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black select-none border border-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterUrl} alt={afterLabel} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={beforeUrl}
        alt={beforeLabel}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />
      <div className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.6)]" style={{ left: `${pos}%` }} />
      <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-[11px] font-bold bg-black/60 text-white">{beforeLabel}</span>
      <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[11px] font-bold bg-black/60 text-white">{afterLabel}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Before/after position"
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
      />
    </div>
  );
}
