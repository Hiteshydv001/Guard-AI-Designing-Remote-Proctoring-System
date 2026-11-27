"use client";

/* Shared building blocks for the signed-in app. Import from "@/components/app/kit". */

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertOctagon, AlertTriangle, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/api";
import type { Severity } from "@/lib/types";

/* --------------------------------------------------------------------------- layout */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="display text-[28px] leading-[1.1] md:text-[34px]">{title}</h1>
        {description && <div className="mt-2 max-w-2xl text-[15px] text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("surface", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-2 pt-5">
          <div>
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={cn("p-6 pt-3", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "danger" | "success" | "ink";
  className?: string;
}) {
  const ink = tone === "ink";
  return (
    <div
      className={cn(
        "relative flex min-h-[132px] flex-col justify-between rounded-[28px] border p-5",
        ink ? "border-transparent bg-primary text-primary-foreground" : "border-border/70 bg-card",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm", ink ? "text-primary-foreground/70" : "text-muted-foreground")}>{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full",
              ink && "bg-primary-foreground/10",
              tone === "default" && "bg-muted",
              tone === "danger" && "bg-destructive/10 text-destructive",
              tone === "success" && "bg-success/10 text-success"
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div>
        <p className="tabular text-[32px] font-semibold leading-none tracking-tight">{value}</p>
        {hint && (
          <p className={cn("mt-2 text-xs", ink ? "text-primary-foreground/60" : "text-muted-foreground")}>{hint}</p>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed p-10 text-center", className)}>
      <span className="grainient-soft flex h-14 w-14 items-center justify-center rounded-full">
        <Icon className="relative z-10 h-6 w-6 text-foreground/80" />
      </span>
      <p className="font-semibold tracking-tight">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-muted-foreground", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-muted", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[132px] rounded-[28px]" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-[28px]" />
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-medium underline underline-offset-4">
          Retry
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------- identity */

const AVATAR_TONES = [
  "bg-[#efe3d6] text-[#6b4a33]",
  "bg-[#e3e7f7] text-[#3b4a87]",
  "bg-[#f6e0e7] text-[#8a3a58]",
  "bg-[#e1efe6] text-[#2f6146]",
  "bg-[#efe9d4] text-[#6f5c1c]",
  "bg-[#ebe2f5] text-[#5b3d86]",
];

export function Avatar({
  name,
  src,
  size = 36,
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const tone = AVATAR_TONES[Array.from(name || "?").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium", tone, className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
      aria-hidden={!!src}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: (string | null)[]; max?: number }) {
  const shown = names.slice(0, max);
  return (
    <div className="flex -space-x-2">
      {shown.map((n, i) => (
        <Avatar key={i} name={n} size={28} className="ring-2 ring-card" />
      ))}
      {names.length > max && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-card">
          +{names.length - max}
        </span>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------- status */

const PILL: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
  in_progress: "bg-lavender text-lavender-foreground",
  submitted: "bg-success/10 text-success",
  terminated: "bg-destructive/10 text-destructive",
  verified: "bg-success/10 text-success",
  approved: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  retry: "bg-warning/10 text-warning",
  skipped: "bg-muted text-muted-foreground",
  live: "bg-lavender text-lavender-foreground",
  invited: "bg-lavender text-lavender-foreground",
};

const PILL_LABEL: Record<string, string> = { in_progress: "In progress", published: "Live" };

export function StatusPill({ status, label, className }: { status: string; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize",
        PILL[status] ?? PILL.draft,
        className
      )}
    >
      {(status === "in_progress" || status === "live" || status === "published") && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {label ?? PILL_LABEL[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

const SEVERITY: Record<Severity, { icon: LucideIcon; cls: string; label: string }> = {
  high: { icon: AlertOctagon, cls: "bg-destructive/10 text-destructive", label: "High" },
  medium: { icon: AlertTriangle, cls: "bg-warning/10 text-warning", label: "Medium" },
  low: { icon: Info, cls: "bg-muted text-muted-foreground", label: "Low" },
};

/** Severity always ships with an icon + text label — never color alone. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity] ?? SEVERITY.low;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", s.cls)}>
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

export function riskLevel(score: number): "low" | "medium" | "high" {
  return score >= 30 ? "high" : score >= 10 ? "medium" : "low";
}

export function RiskBadge({ score, compact = false }: { score: number; compact?: boolean }) {
  const level = riskLevel(score);
  const cls = {
    high: "bg-destructive/10 text-destructive",
    medium: "bg-warning/10 text-warning",
    low: "bg-success/10 text-success",
  }[level];
  const label = { high: "High risk", medium: "Medium risk", low: "Low risk" }[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", cls)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {compact ? Math.round(score) : `${label} · ${Math.round(score)}`}
    </span>
  );
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-lavender px-2.5 py-1 text-xs font-medium text-lavender-foreground", className)}>
      {children}
    </span>
  );
}

export function MonoTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border border-border/80 px-1.5 py-0.5 font-mono text-[11px] tracking-wider", className)}>
      {children}
    </span>
  );
}

/* --------------------------------------------------------------------------- controls */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("inline-flex h-11 items-center gap-1 rounded-full border border-border/70 bg-card p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors",
            value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-2", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function ProgressBar({ value, className, tone = "ink" }: { value: number; className?: string; tone?: "ink" | "success" | "danger" }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          tone === "ink" && "bg-primary",
          tone === "success" && "bg-success",
          tone === "danger" && "bg-destructive"
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
