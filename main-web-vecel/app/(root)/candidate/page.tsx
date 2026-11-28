"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Award, BookOpen, CalendarClock, Clock, FileText, Loader2, Play, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { formatDuration, greeting, useApi, useQuery } from "@/lib/api";
import type { AttemptSummary, MyExam } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorNote, PageHeader, PageSkeleton, Segmented, StatCard, StatusPill } from "@/components/app/kit";
import { useProfile } from "@/components/app/role-gate";
import { JoinByCode } from "@/components/candidate/join-code";
import { ExamWindow, timeChip } from "@/components/candidate/exam-window";
import { cn } from "@/lib/utils";

type Filter = "upcoming" | "completed" | "all";

function examState(e: MyExam): "live" | "open" | "scheduled" | "done" | "closed" {
  if (e.attempt?.status === "in_progress") return "live";
  if (e.attempt) return "done";
  if (!e.open_error) return "open";
  if (e.starts_at && new Date(e.starts_at) > new Date()) return "scheduled";
  return "closed";
}

export default function CandidateHome() {
  const api = useApi();
  const router = useRouter();
  const profile = useProfile();
  const exams = useQuery<MyExam[]>("/api/my/exams", { refreshMs: 30000 });
  const attempts = useQuery<AttemptSummary[]>("/api/my/attempts");
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [starting, setStarting] = useState<string | null>(null);

  const list = useMemo(() => exams.data ?? [], [exams.data]);
  const featured = useMemo(
    () =>
      list.find((e) => examState(e) === "live") ??
      list.find((e) => examState(e) === "open") ??
      list.filter((e) => examState(e) === "scheduled").sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""))[0],
    [list]
  );
  const shown = list.filter((e) => {
    const s = examState(e);
    if (filter === "upcoming") return s === "live" || s === "open" || s === "scheduled";
    if (filter === "completed") return s === "done";
    return true;
  });

  const finished = (attempts.data ?? []).filter((a) => a.status !== "in_progress");
  const scored = finished.filter((a) => a.percentage !== null);
  const avg = scored.length ? Math.round(scored.reduce((s, a) => s + (a.percentage as number), 0) / scored.length) : null;
  const passed = finished.filter((a) => a.passed).length;

  async function start(e: MyExam) {
    if (e.attempt?.status === "in_progress") return router.push(`/exam/${e.attempt.id}`);
    setStarting(e.id);
    try {
      const r = await api<{ attempt_id: string }>(`/api/exams/${e.id}/start`, { method: "POST" });
      router.push(`/exam/${r.attempt_id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setStarting(null);
    }
  }

  if (exams.loading && !exams.data) return <PageSkeleton />;
  const first = profile?.name?.split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow={`[ ${new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} ]`}
        title={
          <>
            {greeting()}, <b>{first || "there"}</b>.
            <br className="hidden sm:block" /> Ready for your <b>next exam</b>?
          </>
        }
      />
      {exams.error && <ErrorNote message={exams.error} onRetry={exams.reload} />}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {featured ? (
          <FeaturedExam exam={featured} busy={starting === featured.id} onStart={() => start(featured)} />
        ) : (
          <div className="grainient-soft flex min-h-[300px] flex-col justify-end rounded-[32px] p-7">
            <div className="relative z-10">
              <p className="eyebrow mb-2">[ all clear ]</p>
              <h2 className="display text-2xl">
                No exams <b>waiting</b> for you right now.
              </h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Assigned exams show up here automatically. Got a code instead? Enter it on the right.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          <JoinByCode />
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Taken" value={finished.length} className="min-h-[112px] p-4" />
            <StatCard label="Average" value={avg !== null ? `${avg}%` : "—"} className="min-h-[112px] p-4" />
            <StatCard label="Passed" value={passed} tone="ink" className="min-h-[112px] p-4" />
          </div>
        </div>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">[ schedule ]</p>
            <h2 className="text-xl font-semibold tracking-tight">Your exams</h2>
          </div>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "upcoming", label: "Upcoming" },
              { value: "completed", label: "Completed" },
              { value: "all", label: "All" },
            ]}
          />
        </div>

        {shown.length === 0 ? (
          <EmptyState icon={CalendarClock} title={filter === "completed" ? "Nothing completed yet" : "Nothing scheduled"}>
            {filter === "completed"
              ? "Finished exams and their results will appear here."
              : "When your proctor assigns an exam to your class it shows up here."}
          </EmptyState>
        ) : (
          <ol className="space-y-3">
            {shown.map((e) => (
              <TimelineRow key={e.id} exam={e} busy={starting === e.id} onStart={() => start(e)} />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function FeaturedExam({ exam, busy, onStart }: { exam: MyExam; busy: boolean; onStart: () => void }) {
  const state = examState(exam);
  const live = state === "live";
  return (
    <div className="bronze flex min-h-[300px] flex-col justify-between rounded-[32px] p-6 sm:p-7">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-md">
          {live ? "In progress" : state === "scheduled" ? "Upcoming exam" : "Open now"}
        </span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur-md">
          <ShieldCheck className="h-5 w-5" />
        </span>
      </div>
      <div className="relative z-10">
        <h2 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">{exam.title}</h2>
        {exam.description && <p className="mt-2 line-clamp-2 max-w-md text-sm text-white/75">{exam.description}</p>}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> {exam.duration_minutes} min
          </span>
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> {exam.question_count} questions
          </span>
          {live && exam.attempt && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> {formatDuration(exam.attempt.remaining_seconds)} left
            </span>
          )}
          {state === "scheduled" && exam.starts_at && (
            <span className="flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" /> {new Date(exam.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )}
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Button
            variant="glass"
            size="lg"
            className="flex-1 justify-between pl-6 pr-2 sm:flex-none sm:min-w-[240px]"
            onClick={onStart}
            disabled={busy || state === "scheduled"}
          >
            {live ? "Resume exam" : state === "scheduled" ? "Opens soon" : "Start exam"}
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#171311]">
              {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({ exam, busy, onStart }: { exam: MyExam; busy: boolean; onStart: () => void }) {
  const state = examState(exam);
  const chip = timeChip(exam.starts_at);
  const a = exam.attempt;
  return (
    <li className="flex items-center gap-4">
      <div className="w-16 shrink-0 text-right">
        <p className="tabular text-sm font-semibold">{chip.top}</p>
        <p className="text-xs text-muted-foreground">{chip.bottom}</p>
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-[24px] border border-border/70 bg-card p-3 pl-4 sm:flex-nowrap",
          state === "live" && "border-primary"
        )}
      >
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted sm:flex">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{exam.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {exam.duration_minutes} min · {exam.question_count} questions
            {state === "closed" && exam.open_error ? ` · ${exam.open_error}` : ""}
          </p>
          <ExamWindow startsAt={null} endsAt={state === "open" ? exam.ends_at : null} />
        </div>
        {state === "done" && a ? (
          <div className="flex items-center gap-2">
            {a.percentage !== null && <span className="tabular text-sm font-semibold">{Math.round(a.percentage)}%</span>}
            <StatusPill status={a.status} />
            <Button asChild variant="ghost" size="icon-sm" aria-label="View result">
              <Link href={`/candidate/results/${a.id}`}>
                <Award />
              </Link>
            </Button>
          </div>
        ) : state === "live" || state === "open" ? (
          <Button size="sm" onClick={onStart} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Play />}
            {state === "live" ? "Resume" : "Start"}
          </Button>
        ) : (
          <StatusPill status={state === "scheduled" ? "draft" : "closed"} label={state === "scheduled" ? "Scheduled" : "Closed"} />
        )}
      </div>
    </li>
  );
}
