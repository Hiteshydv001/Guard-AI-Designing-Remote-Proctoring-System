"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Bot,
  Check,
  Clock,
  ImageOff,
  Loader2,
  MonitorSmartphone,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatDuration, useApi, useQuery } from "@/lib/api";
import { violationLabel, type Review, type ViolationOut } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Avatar,
  EmptyState,
  ErrorNote,
  PageSkeleton,
  RiskBadge,
  Section,
  SeverityBadge,
  StatCard,
  StatusPill,
} from "@/components/app/kit";
import { AttemptActions } from "@/components/app/attempt-actions";
import { IdentityBadge, formatOffset, identityOf } from "@/components/proctor/common";

type Filter = "all" | "ai" | "browser";

export default function ReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const api = useApi();
  const [poll, setPoll] = useState<number | undefined>(5000);
  const { data, error, loading, reload } = useQuery<Review>(`/api/attempts/${attemptId}/review`, { refreshMs: poll });
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [gradesTouched, setGradesTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [zoom, setZoom] = useState<ViolationOut | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const inProgress = data?.attempt.status === "in_progress";
  useEffect(() => {
    if (data) setPoll(inProgress ? 5000 : undefined);
  }, [data, inProgress]);

  useEffect(() => {
    if (data && !gradesTouched) {
      setGrades(Object.fromEntries(Object.entries(data.attempt.manual_scores ?? {}).map(([k, v]) => [k, String(v)])));
    }
  }, [data, gradesTouched]);

  const byType = useMemo(() => {
    const m = new Map<string, number>();
    data?.violations.forEach((v) => m.set(v.type, (m.get(v.type) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (error && !data) return <ErrorNote message={error} onRetry={reload} />;
  if (loading && !data) return <PageSkeleton />;
  if (!data) return null;

  const { attempt: a, exam, questions, violations } = data;
  const name = a.candidate_name ?? "Candidate";
  const started = new Date(a.started_at).getTime();
  const ended = a.submitted_at ? new Date(a.submitted_at).getTime() : Date.now();
  const hasText = questions.some((q) => q.type === "text");
  const identity = identityOf(a);
  const latestEvidence = [...violations].reverse().find((v) => v.snapshot_url)?.snapshot_url ?? null;
  const liveFrame = a.last_frame ?? latestEvidence;
  const shown = violations.filter((v) => filter === "all" || v.source === filter);

  async function saveGrades() {
    setSaving(true);
    try {
      const scores = Object.fromEntries(
        Object.entries(grades)
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, Number(v)])
      );
      await api(`/api/attempts/${attemptId}/grade`, { method: "POST", json: { scores } });
      toast.success("Grades saved");
      setGradesTouched(false);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    setApproving(true);
    try {
      await api(`/api/attempts/${attemptId}/approve-identity`, { method: "POST" });
      toast.success("Identity approved");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApproving(false);
    }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
        <Link href={`/proctor/exams/${exam.id}`}>
          <ArrowLeft /> {exam.title}
        </Link>
      </Button>

      {/* ------------------------------------------------------------ header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={name} src={a.reference_photo_url} size={60} />
          <div className="min-w-0">
            <p className="eyebrow mb-1">Attempt review</p>
            <h1 className="display text-[26px] leading-tight md:text-[32px]">
              <b>{name}</b>
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusPill status={a.status} />
              {a.online && <StatusPill status="live" label="Online" />}
              <span className="truncate">{a.candidate_email}</span>
            </div>
          </div>
        </div>
        {inProgress && (
          <div className="flex gap-2">
            <AttemptActions attemptId={a.id} candidate={name} onDone={reload} size="default" />
          </div>
        )}
      </div>

      {a.termination_reason && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>
            <span className="font-medium">Ended: </span>
            {a.termination_reason}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          tone="ink"
          label="Score"
          value={a.score != null ? `${a.score}/${a.max_score}` : inProgress ? "—" : "Pending"}
          icon={Award}
          hint={a.percentage != null ? `${Math.round(a.percentage)}% · ${a.passed ? "passed" : "failed"}` : `${a.answered} answered`}
        />
        <StatCard label="AI flags" value={a.violation_count} icon={AlertTriangle} tone="danger" hint={<RiskBadge score={a.risk_score} />} />
        <StatCard
          label="Time used"
          value={formatDuration((ended - started) / 1000)}
          icon={Clock}
          hint={inProgress ? `${formatDuration(a.remaining_seconds)} left` : formatDate(a.submitted_at)}
        />
        <StatCard
          label="Identity"
          value={identity.score != null ? `${Math.round(identity.score * 100)}%` : "—"}
          icon={ShieldCheck}
          tone={identity.kind === "bad" ? "danger" : identity.kind === "ok" ? "success" : "default"}
          hint={identity.label}
        />
      </div>

      {/* ------------------------------------------------------------ identity */}
      <Section
        className="mt-6"
        title="Identity verification"
        description="Reference photo registered by you vs. the latest camera frame"
        actions={
          (a.identity?.status === "failed" || identity.kind === "bad") && a.identity?.status !== "approved" ? (
            <Button onClick={approve} disabled={approving} size="sm">
              {approving ? <Loader2 className="animate-spin" /> : <Check />} Approve identity
            </Button>
          ) : (
            <IdentityBadge attempt={a} />
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Frame label="Reference photo" src={a.reference_photo_url} empty="No reference photo registered" icon={UserRound} />
          <Frame
            label={a.last_frame ? "Live camera" : "Latest evidence"}
            src={liveFrame}
            empty="No camera frames yet"
            icon={ImageOff}
          />
        </div>
        {!a.reference_photo_url && (
          <p className="mt-4 text-sm text-muted-foreground">
            Upload a photo from{" "}
            <Link href="/proctor/students" className="font-medium text-foreground underline underline-offset-4">
              Students
            </Link>{" "}
            to verify identity on future exams.
          </p>
        )}
      </Section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* ---------------------------------------------------------- evidence */}
        <Section
          className="lg:col-span-3"
          title="Evidence timeline"
          description={`${violations.length} event${violations.length === 1 ? "" : "s"} recorded`}
          actions={
            violations.length > 0 && (
              <div className="flex rounded-full border border-border/70 p-0.5 text-xs">
                {(["all", "ai", "browser"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "h-7 rounded-full px-3 font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f === "ai" ? "AI" : f}
                  </button>
                ))}
              </div>
            )
          }
        >
          {byType.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {byType.map(([t, n]) => (
                <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                  {violationLabel(t)} <span className="tabular text-muted-foreground">×{n}</span>
                </span>
              ))}
            </div>
          )}
          {violations.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No suspicious activity">
              The AI proctor didn&apos;t flag anything during this attempt.
            </EmptyState>
          ) : (
            <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-[55px] before:top-3 before:w-px before:bg-border sm:before:left-[63px]">
              {shown.map((v) => (
                <li key={v.id} className="relative flex gap-3">
                  <button
                    className="relative z-10 h-[72px] w-[100px] shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-[116px]"
                    onClick={() => v.snapshot_url && setZoom(v)}
                    disabled={!v.snapshot_url}
                    aria-label={v.snapshot_url ? `Open evidence for ${violationLabel(v.type)}` : "No snapshot"}
                  >
                    {v.snapshot_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.snapshot_url} alt="" className="h-full w-full object-cover transition-transform hover:scale-105" />
                    ) : (
                      <ImageOff className="m-auto h-5 w-5 text-muted-foreground/50" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1 rounded-2xl px-1 py-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-medium">{violationLabel(v.type)}</p>
                      <SeverityBadge severity={v.severity} />
                      <SourceChip source={v.source} />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{v.message}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {formatOffset((new Date(v.created_at).getTime() - started) / 1000)} into the exam
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Section>

        {/* ---------------------------------------------------------- answers */}
        <Section
          className="lg:col-span-2"
          title="Answers"
          description={hasText ? "Grade written answers, then save" : `${a.answered}/${questions.length} answered`}
          actions={
            hasText &&
            !inProgress && (
              <Button size="sm" onClick={saveGrades} disabled={saving || !gradesTouched}>
                {saving && <Loader2 className="animate-spin" />} Save grades
              </Button>
            )
          }
        >
          <div className="space-y-3">
            {questions.map((q, i) => {
              const given = a.answers?.[q.id];
              const picked = Array.isArray(given) ? given : [];
              const correct =
                q.type !== "text" && [...picked].sort().join(",") === [...(q.correct ?? [])].sort().join(",");
              const unanswered = q.type === "text" ? !(typeof given === "string" && given.trim()) : picked.length === 0;
              return (
                <div key={q.id} className="rounded-[20px] border border-border/70 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <p className="flex-1 text-sm font-medium">{q.prompt}</p>
                    {q.type !== "text" &&
                      (unanswered ? (
                        <span className="text-xs text-muted-foreground">Skipped</span>
                      ) : correct ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/10 text-success" title="Correct">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive" title="Incorrect">
                          <X className="h-3.5 w-3.5" />
                        </span>
                      ))}
                  </div>
                  {q.type === "text" ? (
                    <>
                      <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-muted/60 p-3 text-sm">
                        {typeof given === "string" && given.trim() ? given : <em className="text-muted-foreground">No answer</em>}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Points</span>
                        <Input
                          type="number"
                          min={0}
                          max={q.points}
                          step="0.5"
                          className="h-9 w-20 rounded-full text-center"
                          value={grades[q.id] ?? ""}
                          disabled={inProgress}
                          aria-label={`Points for question ${i + 1}`}
                          onChange={(e) => {
                            setGradesTouched(true);
                            setGrades((g) => ({ ...g, [q.id]: e.target.value }));
                          }}
                        />
                        <span className="text-muted-foreground">/ {q.points}</span>
                      </div>
                    </>
                  ) : (
                    <ul className="mt-3 space-y-1.5 text-sm">
                      {q.options.map((o, oi) => {
                        const isKey = q.correct?.includes(oi);
                        const isPicked = picked.includes(oi);
                        return (
                          <li
                            key={oi}
                            className={cn(
                              "flex items-center gap-2 rounded-xl px-3 py-2",
                              isKey && "bg-success/10 text-success",
                              isPicked && !isKey && "bg-destructive/10 text-destructive",
                              !isKey && !isPicked && "text-muted-foreground"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center border",
                                q.type === "single" ? "rounded-full" : "rounded",
                                isPicked ? "border-current bg-current" : "border-current opacity-50"
                              )}
                            >
                              {isPicked && <span className="h-1.5 w-1.5 rounded-full bg-card" />}
                            </span>
                            <span className="flex-1">{o}</span>
                            {isKey && <span className="text-[11px] font-medium">Correct</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-3xl p-3 sm:p-3">
          {zoom && (
            <>
              <DialogHeader className="px-3 pt-3">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
                  {violationLabel(zoom.type)} <SeverityBadge severity={zoom.severity} />
                </DialogTitle>
                <DialogDescription>
                  {zoom.message} · {formatOffset((new Date(zoom.created_at).getTime() - started) / 1000)} into the exam
                </DialogDescription>
              </DialogHeader>
              {zoom.snapshot_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={zoom.snapshot_url} alt="Evidence snapshot" className="w-full rounded-[20px]" />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Frame({ label, src, empty, icon: Icon }: { label: string; src: string | null; empty: string; icon: typeof ImageOff }) {
  return (
    <figure>
      <div className="aspect-[4/3] overflow-hidden rounded-[22px] border border-border/70 bg-muted">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="grainient-soft flex h-full flex-col items-center justify-center gap-2 text-sm text-foreground/60">
            <Icon className="relative z-10 h-6 w-6" />
            <span className="relative z-10">{empty}</span>
          </div>
        )}
      </div>
      <figcaption className="eyebrow mt-2 px-1">{label}</figcaption>
    </figure>
  );
}

function SourceChip({ source }: { source: "ai" | "browser" }) {
  const Icon = source === "ai" ? Bot : MonitorSmartphone;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/80 px-2 py-0.5 text-[11px] text-muted-foreground">
      <Icon className="h-3 w-3" />
      {source === "ai" ? "AI" : "Browser"}
    </span>
  );
}
