"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Eye, EyeOff, Smartphone, Users, VideoOff } from "lucide-react";
import { formatDuration } from "@/lib/api";
import type { AttemptSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, ProgressBar, RiskBadge, riskLevel } from "@/components/app/kit";
import { AttemptActions } from "@/components/app/attempt-actions";
import { IdentityBadge, identityOf } from "./common";

export function LiveGrid({
  attempts,
  questionCount,
  onChange,
}: {
  attempts: AttemptSummary[];
  questionCount: number;
  onChange: () => void;
}) {
  if (!attempts.length) {
    return (
      <EmptyState icon={Users} title="No one is taking this exam right now">
        Candidates appear here with a live webcam view, AI readings and identity status as soon as they start.
      </EmptyState>
    );
  }
  const sorted = [...attempts].sort(
    (a, b) =>
      Number(identityOf(b).kind === "bad") - Number(identityOf(a).kind === "bad") ||
      b.risk_score - a.risk_score ||
      Number(b.online) - Number(a.online)
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((a) => (
        <LiveCard key={a.id} a={a} total={questionCount} onChange={onChange} />
      ))}
    </div>
  );
}

function LiveCard({ a, total, onChange }: { a: AttemptSummary; total: number; onChange: () => void }) {
  const name = a.candidate_name ?? "Candidate";
  const live = a.live;
  const risk = riskLevel(a.risk_score);
  const idBad = identityOf(a).kind === "bad";
  const objects = (live?.objects ?? []).filter((o) => o.label !== "person");

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[28px] border bg-card transition-shadow",
        idBad || risk === "high" ? "border-destructive/60 shadow-[0_0_0_3px_hsl(var(--destructive)/0.08)]" : "border-border/70"
      )}
    >
      <div className="relative m-2 aspect-video overflow-hidden rounded-[22px] bg-muted">
        {a.last_frame ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.last_frame} alt={`${name}'s webcam`} className={cn("h-full w-full object-cover", !a.online && "opacity-50 grayscale")} />
        ) : (
          <div className="grainient-soft flex h-full items-center justify-center">
            <VideoOff className="relative z-10 h-8 w-8 text-foreground/40" />
          </div>
        )}
        <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-2">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md",
              a.online ? "bg-black/55" : "bg-zinc-600/70"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", a.online ? "animate-pulse bg-[#3ee07a]" : "bg-white/60")} />
            {a.online ? "Live" : "Offline"}
          </span>
          <span className="tabular rounded-full bg-black/55 px-2.5 py-1 font-mono text-[11px] text-white backdrop-blur-md">
            {formatDuration(a.remaining_seconds)}
          </span>
        </div>
        <div className="absolute inset-x-2 bottom-2 flex flex-wrap items-end justify-between gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            {live && (
              <Reading
                icon={live.faces === 1 ? Users : AlertTriangle}
                bad={live.faces !== 1}
                label={live.faces === 0 ? "No face" : live.faces === 1 ? "1 face" : `${live.faces} faces`}
              />
            )}
            {live?.looking_away && <Reading icon={EyeOff} bad label="Looking away" />}
            {live && !live.looking_away && live.faces === 1 && <Reading icon={Eye} label="Focused" />}
            {objects.length > 0 && <Reading icon={Smartphone} bad label={objects.map((o) => o.label).join(", ")} />}
          </div>
          {a.violation_count > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-destructive px-2 py-1 text-[11px] font-medium text-destructive-foreground">
              <AlertTriangle className="h-3 w-3" /> {a.violation_count}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 px-4 pb-4 pt-2">
        <div className="flex items-center gap-3">
          <Avatar name={name} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium leading-tight">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{a.candidate_email}</p>
          </div>
          <RiskBadge score={a.risk_score} compact />
        </div>
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="tabular">
              {a.answered}/{total}
            </span>
          </div>
          <ProgressBar value={total ? (100 * a.answered) / total : 0} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IdentityBadge attempt={a} />
          <div className="ml-auto flex items-center gap-1.5">
            <AttemptActions attemptId={a.id} candidate={name} onDone={onChange} compact />
            <Button asChild variant="outline" size="icon-sm" aria-label={`Open ${name}'s attempt`} title="Details">
              <Link href={`/proctor/attempts/${a.id}`}>
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Reading({ icon: Icon, label, bad = false }: { icon: typeof Eye; label: string; bad?: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium backdrop-blur-md",
        bad ? "bg-destructive/90 text-white" : "bg-white/80 text-[#171311]"
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
