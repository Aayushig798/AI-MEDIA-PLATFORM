import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import type { ComponentType, ReactNode } from "react";
import {
  CalendarDays,
  Camera,
  ChevronDown,
  CloudRain,
  Copy,
  ExternalLink,
  Fingerprint,
  FolderKanban,
  Globe,
  Leaf,
  Loader2,
  MapPin,
  QrCode,
  Satellite,
  ScanEye,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  Upload,
} from "lucide-react";
import { prisma as db } from "@/lib/db";
import { signedOriginalUrl } from "@/lib/cloudinary";
import { withTransformation, EVIDENCE_TRANSFORMATION, getThumbnailUrl } from "@/lib/cloudinary-url";
import { effectiveVerdict, VERDICT_LABELS } from "@/components/TrustBadge";
import { CheckList, CheckResultView } from "@/components/CheckList";
import { ChainVerifier } from "@/components/ChainVerifier";
import { AskAuditor } from "@/components/AskAuditor";
import { Ring } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify evidence | EcoEvidence",
  description: "Independent verification of a field photo: Trust Score, checks and tamper-evident ledger.",
};

type IconType = ComponentType<{ className?: string }>;

// Tinted icon squares. This is a server component, so the client-side IconChip/TONES can't be used here.
const CHIP = {
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-600/10",
  sky: "bg-sky-50 text-sky-600 ring-sky-600/10",
  amber: "bg-amber-50 text-amber-600 ring-amber-600/15",
  red: "bg-red-50 text-red-600 ring-red-600/10",
  violet: "bg-violet-50 text-violet-600 ring-violet-600/10",
  zinc: "bg-zinc-100 text-zinc-600 ring-zinc-900/5",
} as const;
type ChipTone = keyof typeof CHIP;

/** Look of the verdict panel for each outcome. */
const THEMES = {
  VERIFIED: {
    panel: "bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-[0_24px_48px_-24px_rgba(5,150,105,0.75)]",
    dots: "bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)]",
    glow: "bg-white/10",
    pill: "bg-white/15 text-white ring-white/25",
    heading: "text-white",
    body: "text-emerald-50/90",
    fine: "text-emerald-50/70",
    ring: "emerald",
    Icon: ShieldCheck,
  },
  REVIEW: {
    panel:
      "bg-gradient-to-br from-amber-50 via-white to-white text-zinc-900 ring-1 ring-amber-200/80 shadow-[0_16px_40px_-24px_rgba(217,119,6,0.45)]",
    dots: "bg-[radial-gradient(rgba(217,119,6,0.10)_1px,transparent_1px)]",
    glow: "bg-amber-200/40",
    pill: "bg-amber-100 text-amber-800 ring-amber-600/20",
    heading: "text-zinc-900",
    body: "text-zinc-700",
    fine: "text-zinc-500",
    ring: "amber",
    Icon: ShieldAlert,
  },
  FLAGGED: {
    panel:
      "bg-gradient-to-br from-red-50 via-white to-white text-zinc-900 ring-1 ring-red-200/80 shadow-[0_16px_40px_-24px_rgba(220,38,38,0.45)]",
    dots: "bg-[radial-gradient(rgba(220,38,38,0.08)_1px,transparent_1px)]",
    glow: "bg-red-200/40",
    pill: "bg-red-100 text-red-800 ring-red-600/20",
    heading: "text-zinc-900",
    body: "text-zinc-700",
    fine: "text-zinc-500",
    ring: "red",
    Icon: ShieldX,
  },
  NONE: {
    panel: "bg-gradient-to-br from-zinc-50 via-white to-white text-zinc-900 ring-1 ring-zinc-200",
    dots: "bg-[radial-gradient(rgba(24,24,27,0.06)_1px,transparent_1px)]",
    glow: "bg-zinc-200/40",
    pill: "bg-zinc-100 text-zinc-700 ring-zinc-500/15",
    heading: "text-zinc-900",
    body: "text-zinc-600",
    fine: "text-zinc-500",
    ring: "zinc",
    Icon: ShieldQuestion,
  },
} as const;

function appOrigin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  return process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || `${proto}://${host}`;
}

function formatDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function Chip({ icon: Icon, tone, size = "md" }: { icon: IconType; tone: ChipTone; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7 rounded-md" : "h-9 w-9 rounded-lg";
  const ico = size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ring-1 ring-inset ${box} ${CHIP[tone]}`}>
      <Icon className={ico} />
    </span>
  );
}

/** Section title with a tinted icon chip (server-side twin of SectionHeader). */
function SectionTitle({
  icon,
  tone,
  title,
  description,
  aside,
}: {
  icon: IconType;
  tone: ChipTone;
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <Chip icon={icon} tone={tone} size="sm" />
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h2>
          {description && <p className="text-[13px] text-zinc-500">{description}</p>}
        </div>
      </div>
      {aside}
    </div>
  );
}

/** Collapsible section used for the supporting detail on this page. */
function Disclosure({
  title,
  hint,
  icon,
  tone = "zinc",
  children,
}: {
  title: string;
  hint?: string;
  icon?: IconType;
  tone?: ChipTone;
  children: ReactNode;
}) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50/70 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          {icon && <Chip icon={icon} tone={tone} size="sm" />}
          <span className="min-w-0">
            {title}
            {hint && <span className="ml-2 font-normal text-zinc-500">{hint}</span>}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-2 px-4 pb-5 text-sm text-zinc-600 sm:px-5">{children}</div>
    </details>
  );
}

function Fact({ icon, tone, label, value, hint }: { icon: IconType; tone: ChipTone; label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex min-w-0 gap-3">
      <Chip icon={icon} tone={tone} />
      <div className="min-w-0">
        <dt className="text-[13px] text-zinc-500">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-zinc-900 [overflow-wrap:anywhere]">{value}</dd>
        {hint && <dd className="mt-0.5 text-xs leading-relaxed text-zinc-500">{hint}</dd>}
      </div>
    </div>
  );
}

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

  // One plain-language sentence for the verdict, plus the most important issue (if any).
  const done = integrity?.status === "DONE";
  const topIssue = checks.find((c) => c.status === "fail") ?? checks.find((c) => c.status === "warn");
  const summary = !done
    ? integrity?.status === "RUNNING"
      ? "This photo is being checked right now. Refresh in a minute."
      : "This photo hasn't been verified yet."
    : integrity?.reviewDecision === "APPROVED"
      ? "A reviewer looked at this photo and approved it as evidence."
      : integrity?.reviewDecision === "REJECTED"
        ? "A reviewer looked at this photo and rejected it as evidence."
        : verdict === "VERIFIED"
          ? "This photo passed our automatic checks for reuse, editing, place and date."
          : verdict === "FLAGGED"
            ? "Our checks found a problem with this photo, so it should not be relied on without further review."
            : "Some checks couldn't confirm this photo, so a person needs to review it.";

  const theme = THEMES[verdict ?? "NONE"];
  const running = integrity?.status === "RUNNING";
  const VerdictIcon = running ? Loader2 : theme.Icon;
  const verdictLabel = done
    ? integrity?.reviewDecision === "APPROVED"
      ? "Approved by a reviewer"
      : integrity?.reviewDecision === "REJECTED"
        ? "Rejected by a reviewer"
        : VERDICT_LABELS[verdict ?? "REVIEW"]
    : running
      ? "Checking now"
      : integrity?.status === "ERROR"
        ? "Check failed"
        : VERDICT_LABELS.UNVERIFIED;
  const score = done ? integrity?.trustScore ?? null : null;

  const claimText = asset.claimText || asset.project.claim || asset.manualNotes;
  const capturedLabel = formatDate(asset.capturedAt) ?? formatDate(integrity?.takenAt);
  const distanceHint =
    location?.distanceM != null ? (
      <>
        <span className="tabular-nums">{location.distanceM}</span> m from the project site (allowed:{" "}
        <span className="tabular-nums">{location.radiusM}</span> m)
      </>
    ) : null;

  const hasSupporting = Boolean(mapCenter || byId.weather || byId.satellite || byId.claim);

  // Check tallies for the section header and the small stacked bar.
  const tally = {
    pass: checks.filter((c) => c.status === "pass").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
  };
  const other = checks.length - tally.pass - tally.warn - tally.fail;
  const tallyText = [
    tally.pass && `${tally.pass} passed`,
    tally.warn && `${tally.warn} ${tally.warn === 1 ? "needs" : "need"} review`,
    tally.fail && `${tally.fail} failed`,
    other > 0 && `${other} not run`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Title */}
      <header className="space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-xs font-medium text-zinc-600 shadow-[0_1px_2px_rgba(16,24,40,0.05)] ring-1 ring-zinc-200">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <ShieldCheck className="h-3 w-3" />
          </span>
          Photo verification
        </span>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-zinc-900 sm:text-[32px]">{asset.project.name}</h1>
        {claimText && (
          <p className="max-w-3xl text-[15px] leading-relaxed text-zinc-500">
            What this photo is meant to show: <span className="text-zinc-800">{claimText}</span>
          </p>
        )}
      </header>

      {/* Photo on a dark stage */}
      <figure className="relative overflow-hidden rounded-3xl bg-zinc-950 shadow-[0_28px_60px_-28px_rgba(0,0,0,0.55)] ring-1 ring-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={evidence} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.5))]" />
        <div className="relative p-3 sm:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={evidence}
            alt={asset.manualNotes || "Field evidence"}
            className="mx-auto block h-auto max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)]"
          />
        </div>
        <figcaption className="relative flex flex-wrap items-center justify-between gap-2 px-4 pb-4 text-xs text-white/85 sm:px-6 sm:pb-5">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 ring-1 ring-white/15 backdrop-blur">
            <Camera className="h-3.5 w-3.5" />
            {capturedLabel ? `Taken ${capturedLabel}` : "Capture date unknown"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 ring-1 ring-white/15 backdrop-blur">
            Resized copy · nothing else changed
          </span>
        </figcaption>
      </figure>

      {/* Verdict */}
      <section className={`relative overflow-hidden rounded-2xl p-6 sm:p-8 ${theme.panel}`}>
        <div className={`pointer-events-none absolute inset-0 [background-size:18px_18px] ${theme.dots}`} />
        <div className={`pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full blur-3xl ${theme.glow}`} />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <div className="self-start rounded-full bg-white p-2 shadow-[0_12px_28px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/5 sm:self-center">
            <Ring value={score ?? 0} size={112} stroke={9} tone={theme.ring}>
              {score != null ? (
                <div className="text-center">
                  <p className="text-[32px] font-semibold leading-none tabular-nums tracking-tight text-zinc-900">{score}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">Trust score</p>
                </div>
              ) : (
                <VerdictIcon className={`h-9 w-9 text-zinc-400 ${running ? "animate-spin" : ""}`} />
              )}
            </Ring>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${theme.pill}`}>
              <VerdictIcon className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
              {verdictLabel}
            </span>
            <p className={`text-xl font-semibold leading-snug tracking-tight sm:text-2xl ${theme.heading}`}>{summary}</p>
            {done && !integrity?.reviewDecision && verdict !== "VERIFIED" && topIssue && (
              <p className={`text-sm leading-relaxed ${theme.body}`}>{topIssue.summary}</p>
            )}
            {done && integrity?.reviewNote && (
              <p className={`text-sm leading-relaxed ${theme.body}`}>
                Reviewer&apos;s note: &ldquo;{integrity.reviewNote}&rdquo;
              </p>
            )}
            {done && (
              <p className={`text-xs leading-relaxed ${theme.fine}`}>
                Checked {formatDate(integrity?.computedAt)}. The trust score helps reviewers decide what to look at first; it is
                not an accusation.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Key facts + QR */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <section className="card p-5 sm:p-6">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <Fact icon={CalendarDays} tone="sky" label="Captured" value={capturedLabel ?? "Unknown"} />
            <Fact
              icon={MapPin}
              tone="sky"
              label="Location"
              value={
                pin
                  ? `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`
                  : site
                    ? asset.project.location || "Project site"
                    : "Not available"
              }
              hint={
                pin ? (
                  <>
                    From the photo&apos;s GPS
                    {distanceHint && <span className="block">{distanceHint}</span>}
                  </>
                ) : site ? (
                  <>
                    Project site (the photo has no GPS)
                    {distanceHint && <span className="block">{distanceHint}</span>}
                  </>
                ) : (
                  distanceHint
                )
              }
            />
            <Fact
              icon={FolderKanban}
              tone="emerald"
              label="Project"
              value={asset.project.name}
              hint={asset.project.location || undefined}
            />
            <Fact icon={Upload} tone="emerald" label="Uploaded" value={formatDate(asset.createdAt) ?? "Unknown"} />
          </dl>
        </section>

        <aside className="card flex flex-row items-center gap-4 p-5 lg:flex-col lg:justify-center lg:text-center">
          <div className="shrink-0 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/qr?url=${encodeURIComponent(pageUrl)}`} alt="QR code for this page" className="h-24 w-24 lg:h-28 lg:w-28" />
          </div>
          <div className="space-y-1">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
              <QrCode className="h-4 w-4 text-emerald-600" />
              Open on a phone
            </p>
            <p className="text-xs leading-relaxed text-zinc-500">Scan to open this page on a phone, or share its link.</p>
          </div>
        </aside>
      </div>

      {/* Checks */}
      {checks.length > 0 && (
        <section className="space-y-4">
          <SectionTitle
            icon={ShieldCheck}
            tone="emerald"
            title="What we checked"
            description={tallyText}
            aside={
              <div className="flex h-1.5 w-40 overflow-hidden rounded-full bg-zinc-100" aria-hidden>
                <div className="bg-emerald-500" style={{ width: `${(tally.pass / checks.length) * 100}%` }} />
                <div className="bg-amber-500" style={{ width: `${(tally.warn / checks.length) * 100}%` }} />
                <div className="bg-red-500" style={{ width: `${(tally.fail / checks.length) * 100}%` }} />
              </div>
            }
          />
          <CheckList checks={checks} />
        </section>
      )}

      {/* Similar photos / found online */}
      {(asset.phashMatches.length > 0 || asset.webMatches.length > 0) && (
        <section className="space-y-4">
          <SectionTitle
            icon={Copy}
            tone="amber"
            title="Similar images"
            description="Other copies that look like this photo."
          />
          <div className="card divide-y divide-zinc-100">
            {asset.phashMatches.length > 0 && (
              <div className="space-y-3 p-5">
                <p className="text-sm text-zinc-600">Photos in the library that look almost the same as this one.</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {asset.phashMatches.map((m) => {
                    const other = matchAssets.find((a) => a.id === m.matchAssetId);
                    const pct = Math.round((1 - m.hamming / 64) * 100);
                    return (
                      <Link
                        key={m.id}
                        href={`/verify/${m.matchAssetId}`}
                        className="group relative block aspect-square overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-black/5"
                      >
                        {other && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={getThumbnailUrl(other.secureUrl, other.resourceType)}
                            alt="Similar photo"
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                          />
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                        <span className="photo-chip absolute left-2 top-2 tabular-nums">{pct}% alike</span>
                        <div className="absolute inset-x-2.5 bottom-2 min-w-0 text-white">
                          {other && <p className="truncate text-xs font-medium">{other.project.name}</p>}
                          <p className={`text-[11px] ${m.crossProject ? "font-medium text-red-200" : "text-white/80"}`}>
                            {m.crossProject ? "Other project" : "Same project"}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
            {asset.webMatches.length > 0 && (
              <div className="space-y-3 p-5">
                <p className="text-sm text-zinc-600">The same image was found on these web pages.</p>
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                  {asset.webMatches.map((w) => (
                    <li key={w.id} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                      <Globe className="h-4 w-4 shrink-0 text-sky-600" />
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="min-w-0 flex-1 truncate text-sm text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900"
                      >
                        {w.pageTitle || w.url}
                      </a>
                      <span className="badge badge-neutral shrink-0">{w.kind.toLowerCase()} match</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Supporting evidence */}
      {hasSupporting && (
        <section className="space-y-4">
          <SectionTitle
            icon={MapPin}
            tone="sky"
            title="Supporting evidence"
            description="Independent records we compared the photo against."
          />
          <div className="card divide-y divide-zinc-100 overflow-hidden">
            {mapCenter && (
              <Disclosure title="Location" hint={pin ? "Photo GPS" : "Project site"} icon={MapPin} tone="sky">
                <iframe
                  title="Map"
                  className="h-64 w-full rounded-xl border border-zinc-200"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCenter.lng - 0.03},${mapCenter.lat - 0.02},${mapCenter.lng + 0.03},${mapCenter.lat + 0.02}&layer=mapnik&marker=${mapCenter.lat},${mapCenter.lng}`}
                />
                <p className="text-[13px] text-zinc-500">
                  {pin ? `Photo GPS ${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}` : "No photo GPS; showing the project site."}
                  {location?.distanceM != null && ` · ${location.distanceM} m from site (allowed ${location.radiusM} m)`}
                </p>
              </Disclosure>
            )}

            {byId.weather && (
              <Disclosure title="Weather that day" icon={CloudRain} tone="sky">
                {weather?.days ? (
                  <>
                    <div className="flex h-24 items-end gap-2 rounded-xl bg-sky-50/50 px-3 pb-2 pt-3 ring-1 ring-inset ring-sky-600/10">
                      {weather.days.map((d: any) => (
                        <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                          <div
                            className="w-full rounded-t-md bg-sky-400/80"
                            style={{ height: `${Math.min(64, (d.precipitationMm ?? 0) * 3 + 2)}px` }}
                            title={`${d.precipitationMm ?? 0} mm`}
                          />
                          <span className="text-xs tabular-nums text-zinc-500">{d.date.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                    <p>{byId.weather.summary}</p>
                    <p className="text-xs text-zinc-500">
                      Daily rainfall from the Open-Meteo historical record at the{" "}
                      {weather.site?.source === "exif" ? "photo's GPS location" : "project site"}.
                    </p>
                  </>
                ) : (
                  <p>{byId.weather?.summary ?? "Not checked."}</p>
                )}
              </Disclosure>
            )}

            {byId.satellite && (
              <Disclosure title="Satellite view" icon={Satellite} tone="sky">
                {sat?.delta != null ? (
                  <>
                    <p className="text-lg font-semibold tabular-nums text-zinc-900">
                      {sat.before} → {sat.after}
                    </p>
                    <p>
                      {String(sat.index).toUpperCase()} from Sentinel-2 satellite images, {sat.beforeDate} to {sat.afterDate}.
                    </p>
                    <p className="text-xs text-zinc-500">Each satellite pixel covers 10 m, so this is a consistency check, not proof.</p>
                  </>
                ) : (
                  <p>{byId.satellite?.summary ?? "Not checked."}</p>
                )}
              </Disclosure>
            )}

            {byId.claim && (
              <Disclosure title="What the AI saw in the photo" icon={ScanEye} tone="violet">
                {claim?.answers?.length ? (
                  <ul className="space-y-2">
                    {claim.answers.map((a: any) => (
                      <li key={a.question} className="flex gap-2">
                        <span
                          className={`badge shrink-0 ${
                            a.answer === "yes" ? "badge-green" : a.answer === "no" ? "badge-red" : "badge-neutral"
                          }`}
                        >
                          {a.answer}
                        </span>
                        <span>{a.question.replace(/^Is there visible evidence in this image of: /, "")}</span>
                      </li>
                    ))}
                    {claim.description && (
                      <li className="rounded-lg bg-violet-50/60 px-3 py-2 text-zinc-600 ring-1 ring-inset ring-violet-600/10">
                        &ldquo;{claim.description}&rdquo;
                      </li>
                    )}
                  </ul>
                ) : (
                  <p>{byId.claim?.summary ?? "Not checked."}</p>
                )}
              </Disclosure>
            )}
          </div>
        </section>
      )}

      {/* Ask a question */}
      <AskAuditor assetId={asset.id} />

      {/* History */}
      <ChainVerifier assetId={asset.id} title="History" />

      {/* Technical details */}
      <div className="card overflow-hidden">
        <Disclosure title="Technical details" icon={Fingerprint} tone="zinc">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl bg-zinc-50 p-4 text-xs ring-1 ring-inset ring-zinc-900/5 sm:grid-cols-[auto_1fr]">
            <dt className="text-zinc-500">SHA-256</dt>
            <dd className="break-all font-mono text-zinc-700">{asset.sha256 ?? "—"}</dd>
            <dt className="text-zinc-500">Perceptual hash</dt>
            <dd className="break-all font-mono text-zinc-700">{asset.phash ?? "—"}</dd>
            <dt className="text-zinc-500">Claimed capture date</dt>
            <dd className="text-zinc-700">{asset.capturedAt?.toISOString().slice(0, 10) ?? "—"}</dd>
            <dt className="text-zinc-500">Camera date (EXIF)</dt>
            <dd className="text-zinc-700">{integrity?.takenAt?.toISOString().slice(0, 10) ?? "—"}</dd>
            {done && (
              <>
                <dt className="text-zinc-500">Checked at</dt>
                <dd className="text-zinc-700">{integrity?.computedAt?.toISOString().slice(0, 16).replace("T", " ")} UTC</dd>
              </>
            )}
          </dl>
          <p className="pt-2 text-xs text-zinc-500">
            The photo above is a resized copy (only fit, format and quality changed), so it shows exactly what the original
            does.{" "}
            <a
              href={original}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
            >
              View original file <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </Disclosure>
      </div>

      {/* Footer mark */}
      <footer className="flex flex-col items-center gap-2 pt-2 text-center">
        <div className="inline-flex items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] ring-1 ring-zinc-200">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_4px_12px_-4px_rgba(5,150,105,0.7)]">
            <Leaf className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-medium text-zinc-800">
            {verdict === "VERIFIED" ? "Verified" : "Checked"} by Eco<span className="text-emerald-600">Evidence</span>
          </span>
        </div>
        <p className="text-xs text-zinc-400">Independent checks and a tamper-evident record for every photo</p>
      </footer>
    </div>
  );
}
