"use client";

import Link from "next/link";
import { Award, ChevronRight } from "lucide-react";
import { formatDate, useQuery } from "@/lib/api";
import type { AttemptSummary } from "@/lib/types";
import { EmptyState, ErrorNote, PageHeader, PageSkeleton, StatCard, StatusPill } from "@/components/app/kit";
import { cn } from "@/lib/utils";

export default function ResultsPage() {
  const { data, error, loading, reload } = useQuery<AttemptSummary[]>("/api/my/attempts");
  if (loading && !data) return <PageSkeleton />;

  const finished = (data ?? []).filter((a) => a.status !== "in_progress");
  const scored = finished.filter((a) => a.percentage !== null);
  const avg = scored.length ? Math.round(scored.reduce((s, a) => s + (a.percentage as number), 0) / scored.length) : null;
  const best = scored.length ? Math.round(Math.max(...scored.map((a) => a.percentage as number))) : null;

  return (
    <>
      <PageHeader
        eyebrow="[ results ]"
        title={
          <>
            Your <b>results</b>, all in one place.
          </>
        }
        description="Scores for written answers may update after your proctor grades them."
      />
      {error && <ErrorNote message={error} onRetry={reload} />}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Exams taken" value={finished.length} />
        <StatCard label="Average" value={avg !== null ? `${avg}%` : "—"} />
        <StatCard label="Best" value={best !== null ? `${best}%` : "—"} />
        <StatCard label="Passed" value={finished.filter((a) => a.passed).length} tone="ink" />
      </div>

      {finished.length === 0 ? (
        <EmptyState icon={Award} title="No results yet">
          Once you submit an exam, your score shows up here.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {finished.map((a) => (
            <li key={a.id}>
              <Link
                href={`/candidate/results/${a.id}`}
                className="group flex items-center gap-4 rounded-[24px] border border-border/70 bg-card p-4 transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ScoreDot pct={a.percentage} passed={a.passed} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.exam_title}</p>
                  <p className="text-xs text-muted-foreground">Submitted {formatDate(a.submitted_at)}</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="tabular text-sm font-semibold">
                    {a.score !== null ? `${a.score} / ${a.max_score}` : "Hidden"}
                  </p>
                  <p className="text-xs text-muted-foreground">points</p>
                </div>
                {a.passed !== null && (
                  <StatusPill status={a.passed ? "submitted" : "terminated"} label={a.passed ? "Passed" : "Not passed"} />
                )}
                {a.status === "terminated" && <StatusPill status="terminated" label="Ended early" />}
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ScoreDot({ pct, passed }: { pct: number | null; passed: boolean | null }) {
  return (
    <span
      className={cn(
        "tabular flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        pct === null ? "bg-muted text-muted-foreground" : passed ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
      )}
    >
      {pct === null ? "—" : `${Math.round(pct)}`}
    </span>
  );
}
