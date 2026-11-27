"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, Lightbulb, X, XCircle } from "lucide-react";
import { formatDate, formatDuration, useQuery } from "@/lib/api";
import type { AttemptResult, ResultBreakdownItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ErrorNote, MonoTag, PageSkeleton, StatusPill } from "@/components/app/kit";
import { cn } from "@/lib/utils";

export default function ResultDetailPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { data: r, error, loading, reload } = useQuery<AttemptResult>(`/api/attempts/${attemptId}/result`);

  if (loading && !r) return <PageSkeleton />;
  if (error || !r) return <ErrorNote message={error ?? "Result not found"} onRetry={reload} />;

  const pct = r.percentage;
  const used = r.submitted_at ? (new Date(r.submitted_at).getTime() - new Date(r.started_at).getTime()) / 1000 : 0;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-4">
        <Link href="/candidate/results">
          <ArrowLeft /> All results
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <aside className="space-y-4">
          <div className={cn("rounded-[32px] p-7", r.passed ? "bronze" : "grainient-soft")}>
            <div className="relative z-10">
              <p className={cn("eyebrow", r.passed && "text-white/70")}>[ score ]</p>
              <h1 className={cn("mt-2 text-2xl font-semibold tracking-tight", r.passed ? "text-white" : "")}>{r.exam_title}</h1>
              <div className="mt-6 flex items-center gap-5">
                <ScoreRing pct={pct} light={!!r.passed} />
                <div>
                  <p className={cn("tabular text-3xl font-semibold", r.passed ? "text-white" : "")}>
                    {r.score !== null ? r.score : "—"}
                    <span className={cn("text-lg", r.passed ? "text-white/70" : "text-muted-foreground")}> / {r.max_score ?? "—"}</span>
                  </p>
                  <p className={cn("text-sm", r.passed ? "text-white/80" : "text-muted-foreground")}>
                    {r.passed === null ? "Score hidden by your proctor" : r.passed ? "You passed" : "Below the pass mark"}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <dl className="surface grid grid-cols-2 gap-4 p-5 text-sm">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-1">
                <StatusPill status={r.status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Time used</dt>
              <dd className="tabular mt-1 font-medium">{formatDuration(used)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Submitted</dt>
              <dd className="mt-1 font-medium">{formatDate(r.submitted_at)}</dd>
            </div>
            {r.termination_reason && (
              <div className="col-span-2 rounded-2xl bg-destructive/5 p-3 text-destructive">{r.termination_reason}</div>
            )}
          </dl>
        </aside>

        <section>
          <p className="eyebrow mb-2">[ breakdown ]</p>
          {!r.breakdown ? (
            <div className="surface p-6 text-sm text-muted-foreground">
              Your proctor hasn&apos;t enabled a question-by-question breakdown for this exam.
            </div>
          ) : (
            <ol className="space-y-3">
              {r.breakdown.map((q, i) => (
                <BreakdownItem key={q.id} q={q} index={i} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}

function ScoreRing({ pct, light }: { pct: number | null; light: boolean }) {
  const p = Math.max(0, Math.min(100, pct ?? 0));
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={pct === null ? "Score hidden" : `${Math.round(p)} percent`}>
      <circle cx="42" cy="42" r={r} fill="none" strokeWidth="7" className={light ? "stroke-white/20" : "stroke-foreground/10"} />
      <circle
        cx="42"
        cy="42"
        r={r}
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - p / 100)}
        transform="rotate(-90 42 42)"
        className={light ? "stroke-white" : "stroke-foreground"}
      />
      <text x="42" y="47" textAnchor="middle" className={cn("tabular text-[15px] font-semibold", light ? "fill-white" : "fill-foreground")}>
        {pct === null ? "—" : `${Math.round(p)}%`}
      </text>
    </svg>
  );
}

function BreakdownItem({ q, index }: { q: ResultBreakdownItem; index: number }) {
  const picked = Array.isArray(q.your_answer) ? q.your_answer : [];
  const full = q.earned !== null && q.earned >= q.points;
  const pending = q.type === "text" && q.earned === null;
  return (
    <li className="surface p-5">
      <div className="flex items-start gap-3">
        <MonoTag className="mt-0.5 shrink-0">{String(index + 1).padStart(2, "0")}</MonoTag>
        <p className="flex-1 whitespace-pre-wrap font-medium">{q.prompt}</p>
        <span
          className={cn(
            "tabular shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
            pending ? "bg-muted text-muted-foreground" : full ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}
        >
          {pending ? "Awaiting grading" : `${q.earned ?? 0} / ${q.points}`}
        </span>
      </div>

      {q.type === "text" ? (
        <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-muted p-3 text-sm">
          {typeof q.your_answer === "string" && q.your_answer ? q.your_answer : <em className="text-muted-foreground">No answer</em>}
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {q.options.map((opt, oi) => {
            const mine = picked.includes(oi);
            const right = q.correct?.includes(oi);
            return (
              <li
                key={oi}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                  right && "bg-success/10",
                  mine && q.correct && !right && "bg-destructive/10",
                  mine && !q.correct && "bg-muted"
                )}
              >
                {right ? (
                  <Check className="h-4 w-4 text-success" aria-label="Correct answer" />
                ) : mine && q.correct ? (
                  <X className="h-4 w-4 text-destructive" aria-label="Incorrect" />
                ) : (
                  <span className="h-4 w-4" />
                )}
                <span className="flex-1">{opt}</span>
                {mine && <span className="text-xs text-muted-foreground">Your answer</span>}
              </li>
            );
          })}
        </ul>
      )}

      {q.explanation && (
        <p className="mt-3 flex gap-2 rounded-2xl bg-lavender p-3 text-sm text-lavender-foreground">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" /> {q.explanation}
        </p>
      )}
      {!q.correct && q.type !== "text" && !pending && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {full ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5" />}
          Correct answers are hidden for this exam.
        </p>
      )}
    </li>
  );
}
