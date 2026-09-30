"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MoreHorizontal, X } from "lucide-react";

type IconType = ComponentType<{ className?: string }>;

/** Stops the page behind an open dialog from scrolling. */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

/** Joins class names, skipping falsy values. */
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Soft tinted square behind an icon. Tones map to meaning: emerald = evidence/verified, amber = attention, etc. */
export const TONES = {
  emerald: "bg-emerald-50 text-emerald-600 ring-emerald-600/10",
  sky: "bg-sky-50 text-sky-600 ring-sky-600/10",
  amber: "bg-amber-50 text-amber-600 ring-amber-600/15",
  red: "bg-red-50 text-red-600 ring-red-600/10",
  violet: "bg-violet-50 text-violet-600 ring-violet-600/10",
  zinc: "bg-zinc-100 text-zinc-600 ring-zinc-900/5",
} as const;
export type Tone = keyof typeof TONES;

export function IconChip({ icon: Icon, tone = "emerald", size = "md" }: { icon: IconType; tone?: Tone; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "h-7 w-7 rounded-md", md: "h-9 w-9 rounded-lg", lg: "h-11 w-11 rounded-xl" }[size];
  const ico = { sm: "h-3.5 w-3.5", md: "h-[18px] w-[18px]", lg: "h-5 w-5" }[size];
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center ring-1 ring-inset", box, TONES[tone])}>
      <Icon className={ico} />
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  eyebrow?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {back && (
        <Link
          href={back.href}
          className="group inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="min-w-0 space-y-1.5">
            {eyebrow && <p className="text-[13px] font-medium text-emerald-700">{eyebrow}</p>}
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-zinc-900">{title}</h1>
            {description && <div className="max-w-2xl text-[15px] leading-relaxed text-zinc-500">{description}</div>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  icon,
  tone = "zinc",
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: IconType;
  tone?: Tone;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <IconChip icon={icon} tone={tone} size="sm" />}
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h2>
          {description && <p className="text-[13px] text-zinc-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Loading({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div className={cx("flex items-center justify-center gap-2.5 py-20 text-sm text-zinc-500", className)}>
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-emerald-100" />
        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
      </span>
      {label}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: IconType;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-16 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="relative mb-5">
          <div className="absolute inset-0 -m-3 rounded-full bg-emerald-100/60 blur-xl" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-[0_8px_24px_-10px_rgba(16,24,40,0.25)] ring-1 ring-zinc-200">
            <Icon className="h-6 w-6" />
          </div>
        </div>
      )}
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  icon,
  tone = "emerald",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  icon?: IconType;
  tone?: Tone;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useBodyScrollLock(open);

  if (!open) return null;

  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-5xl" }[size];

  return (
    <div
      className="fixed inset-0 z-50 !mt-0 flex items-start justify-center overflow-y-auto bg-zinc-950/50 p-4 sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          "animate-fade-in relative my-auto w-full rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_64px_-16px_rgba(16,24,40,0.35)]",
          width,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
          <X className="h-4 w-4" />
        </button>
        {(title || description) && (
          <div className="flex items-start gap-3.5 px-6 pb-2 pr-12 pt-6">
            {icon && <IconChip icon={icon} tone={tone} />}
            <div className="space-y-1">
              {title && <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900">{title}</h2>}
              {description && <p className="text-sm leading-relaxed text-zinc-500">{description}</p>}
            </div>
          </div>
        )}
        {children && <div className="px-6 py-4">{children}</div>}
        {footer && (
          <div className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-zinc-100 bg-zinc-50/70 px-6 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  busy,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  error?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    </Modal>
  );
}

/** Segmented tabs. Items can carry an icon and a count. */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count?: number; icon?: IconType }[];
  className?: string;
}) {
  return (
    <div
      className={cx(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-zinc-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            aria-pressed={active}
            className={cx(
              "flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition",
              active ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {item.label}
            {item.count !== undefined && (
              <span
                className={cx(
                  "rounded-md px-1.5 text-xs tabular-nums",
                  active ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-500",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A "…" button that opens a small menu. Children are menu items (use the .menu-item class). */
export function Menu({
  children,
  label = "More options",
  align = "right",
  trigger,
  buttonClassName,
}: {
  children: ReactNode;
  label?: string;
  align?: "left" | "right";
  trigger?: ReactNode;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className={buttonClassName ?? (trigger ? "btn btn-secondary btn-sm" : "btn btn-secondary btn-icon")}
      >
        {trigger ?? <MoreHorizontal className="h-4 w-4" />}
      </button>
      {open && (
        <div
          className={cx("menu animate-fade-in absolute top-full mt-1.5", align === "right" ? "right-0" : "left-0")}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** KPI tile. Optional icon + tone, and an optional 0–100 progress bar. */
export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "emerald",
  progress,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: IconType;
  tone?: Tone;
  progress?: number;
  href?: string;
}) {
  const bar = {
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    violet: "bg-violet-500",
    zinc: "bg-zinc-500",
  }[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-zinc-500">{label}</p>
        {icon && <IconChip icon={icon} tone={tone} size="sm" />}
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-none tabular-nums tracking-tight text-zinc-900">{value}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div className={cx("h-full rounded-full transition-all", bar)} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {hint && <p className="mt-2 text-xs text-zinc-500">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="card-interactive block p-4">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-600/10">{children}</p>;
}

/** Circular progress ring, e.g. share of verified photos. */
export function Ring({
  value,
  size = 64,
  stroke = 7,
  tone = "emerald",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  children?: ReactNode;
}) {
  const color = { emerald: "#10b981", sky: "#0ea5e9", amber: "#f59e0b", red: "#ef4444", violet: "#8b5cf6", zinc: "#71717a" }[tone];
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f1f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
