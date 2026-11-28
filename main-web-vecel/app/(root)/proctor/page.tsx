"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Plus, Radio, Sparkles, Users } from "lucide-react";
import { formatDate, greeting, timeAgo, useQuery } from "@/lib/api";
import { violationLabel, type Overview } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ActivityChart, BarList } from "@/components/app/charts";
import {
  Avatar,
  EmptyState,
  ErrorNote,
  MonoTag,
  PageHeader,
  PageSkeleton,
  Section,
  SeverityBadge,
  StatCard,
  StatusPill,
} from "@/components/app/kit";
import { useProfile } from "@/components/app/role-gate";

export default function ProctorOverview() {
  const profile = useProfile();
  const { data, error, loading, reload } = useQuery<Overview>("/api/proctor/overview", { refreshMs: 15000 });
  const first = profile?.name?.split(" ")[0];

  if (loading && !data) return <PageSkeleton />;

  return (
    <>
      <PageHeader
        eyebrow={`[ 01 ]  ${greeting()}`}
        title={
          <>
            {first ? <b>{first},</b> : <b>Welcome,</b>} here&apos;s what&apos;s happening <b>across your exams.</b>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/proctor/students">
                <Users /> Students
              </Link>
            </Button>
            <Button asChild>
              <Link href="/proctor/exams/new">
                <Plus /> New exam
              </Link>
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-6">
          <ErrorNote message={error} onRetry={reload} />
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              tone="ink"
              label="Live right now"
              value={data.online_now}
              icon={Radio}
              hint={`${data.active_attempts} attempt${data.active_attempts === 1 ? "" : "s"} in progress`}
            />
            <StatCard label="Students" value={data.student_count} icon={Users} hint={`${data.published_count}/${data.exam_count} exams live`} />
            <StatCard
              label="Average score"
              value={data.average_score != null ? `${Math.round(data.average_score)}%` : "—"}
              icon={CheckCircle2}
              tone="success"
              hint={`${data.completed_attempts} completed attempt${data.completed_attempts === 1 ? "" : "s"}`}
            />
            <StatCard label="AI alerts · 24h" value={data.alerts_24h} icon={AlertTriangle} tone="danger" hint="Flags raised by the proctoring engine" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Activity" description="Attempts started and AI flags, last 14 days" className="lg:col-span-2">
              <ActivityChart data={data.activity} />
            </Section>
            <Section title="What the AI flagged" description="Last 14 days, by type">
              <BarList
                items={data.violations_by_type.slice(0, 6).map((v) => ({ label: violationLabel(v.type), value: v.count }))}
                empty="Nothing flagged yet — clean exams so far."
              />
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-2">
              <LiveExams data={data} />
              <Upcoming data={data} />
            </div>

            <Section
              title="Latest AI alerts"
              description="Auto-refreshes every 15 seconds"
              className="lg:col-span-3"
              bodyClassName="px-3 pb-3 pt-1"
            >
              {data.recent_violations.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="No alerts yet" className="m-3">
                  Flags raised by the AI proctor — with snapshot evidence — will appear here.
                </EmptyState>
              ) : (
                <ul className="divide-y divide-border/60">
                  {data.recent_violations.map((v) => (
                    <li key={v.id}>
                      <Link
                        href={`/proctor/attempts/${v.attempt_id}`}
                        className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Avatar name={v.candidate_name} size={38} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {violationLabel(v.type)}
                            <span className="font-normal text-muted-foreground"> · {v.candidate_name ?? "Candidate"}</span>
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {v.exam_title} · {timeAgo(v.created_at)}
                          </p>
                        </div>
                        <SeverityBadge severity={v.severity} />
                        <ArrowUpRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          {!data.ml.ready && (
            <div className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
              <Sparkles className="h-4 w-4 text-warning" />
              <span>
                The AI engine is {data.ml.error ? "unavailable" : "starting"}.
                {data.ml.error && <span className="text-muted-foreground"> {data.ml.error}</span>}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function LiveExams({ data }: { data: Overview }) {
  return (
    <section className="bronze rounded-[28px] p-6">
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/70">Live now</p>
          <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            {data.online_now} online
          </span>
        </div>
        {data.live_exams.length === 0 ? (
          <div className="py-6">
            <p className="text-2xl font-medium tracking-tight">No exams running.</p>
            <p className="mt-1 text-sm text-white/70">When candidates start, you can watch them live here.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {data.live_exams.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/proctor/exams/${e.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="text-xs text-white/70">
                      {e.live_count} taking it · {e.duration_minutes} min
                    </p>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#3d2719]">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Upcoming({ data }: { data: Overview }) {
  return (
    <Section title="Upcoming" description="Scheduled exams that haven't opened yet" bodyClassName="px-3 pb-3 pt-1">
      {data.upcoming.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">Nothing scheduled. Set an opening time on an exam to see it here.</p>
      ) : (
        <ul className="space-y-1">
          {data.upcoming.map((e) => (
            <li key={e.id}>
              <Link
                href={`/proctor/exams/${e.id}`}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <CalendarClock className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(e.starts_at)}</p>
                </div>
                <MonoTag>{e.access_code}</MonoTag>
                <StatusPill status={e.status} className="hidden sm:inline-flex" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
