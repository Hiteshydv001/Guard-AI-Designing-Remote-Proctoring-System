"use client";

import { BarChart3, CheckCircle2, Clock, Flag, Sigma, TrendingUp } from "lucide-react";
import { useQuery } from "@/lib/api";
import { violationLabel, type ExamAnalytics } from "@/lib/types";
import { BarList, ColumnChart } from "@/components/app/charts";
import { EmptyState, ErrorNote, Section, Skeleton, StatCard } from "@/components/app/kit";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);

export function AnalyticsPanel({ examId }: { examId: string }) {
  const { data, error, loading, reload } = useQuery<ExamAnalytics>(`/api/exams/${examId}/analytics`, { refreshMs: 30000 });

  if (error && !data) return <ErrorNote message={error} onRetry={reload} />;
  if (loading && !data)
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[132px] rounded-[28px]" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-[28px]" />
      </div>
    );
  if (!data) return null;

  const s = data.summary;
  if (!s.attempts) {
    return (
      <EmptyState icon={BarChart3} title="No data yet">
        Analytics appear once candidates start submitting.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard tone="ink" label="Average" value={pct(s.average)} icon={Sigma} hint={`${s.submitted + s.terminated} finished`} />
        <StatCard label="Median" value={pct(s.median)} icon={TrendingUp} hint={`Highest ${pct(s.highest)}`} />
        <StatCard label="Pass rate" value={pct(s.pass_rate)} icon={CheckCircle2} tone="success" hint={`Pass mark ${Math.round(s.pass_percentage)}%`} />
        <StatCard label="Avg time" value={s.avg_minutes != null ? `${Math.round(s.avg_minutes)}m` : "—"} icon={Clock} />
        <StatCard label="Flagged" value={s.flagged} icon={Flag} tone="danger" hint={`${s.terminated} ended early`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Score distribution" description="Finished attempts by percentage">
          <ColumnChart data={data.score_distribution} xKey="range" yKey="count" name="Candidates" />
        </Section>
        <Section title="What the AI flagged" description="Violations across all attempts">
          <BarList
            items={data.violations_by_type.map((v) => ({ label: violationLabel(v.type), value: v.count }))}
            empty="No violations recorded for this exam."
          />
        </Section>
      </div>

      <Section title="Question accuracy" description="Share of finished attempts that got each question right (written answers: average graded score)">
        <BarList
          max={100}
          format={(v) => `${Math.round(v)}%`}
          items={data.questions.map((q, i) => ({
            label: `${i + 1}. ${q.prompt}`,
            value: q.correct_rate ?? 0,
            hint:
              q.correct_rate == null
                ? "Not graded yet"
                : q.answered_rate != null
                  ? `${Math.round(q.answered_rate)}% answered`
                  : undefined,
          }))}
        />
      </Section>
    </div>
  );
}
