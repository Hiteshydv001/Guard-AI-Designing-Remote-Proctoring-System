"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Award,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  KeyRound,
  Loader2,
  ScanFace,
  ShieldCheck,
  Trash2,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, timeAgo, useApi, useQuery } from "@/lib/api";
import type { Batch, StudentDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  EmptyState,
  ErrorNote,
  MonoTag,
  PageHeader,
  PageSkeleton,
  RiskBadge,
  Section,
  StatCard,
  StatusPill,
} from "@/components/app/kit";
import { useStudentActions } from "@/components/students/student-actions";
import { BatchPicker } from "@/components/students/shared";

export default function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const router = useRouter();
  const api = useApi();
  const student = useQuery<StudentDetail>(`/api/students/${studentId}`);
  const batches = useQuery<Batch[]>("/api/batches");
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [savingBatches, setSavingBatches] = useState(false);

  const s = student.data;
  const actions = useStudentActions({
    batches: batches.data ?? [],
    onChanged: () => {
      student.reload();
      batches.reload();
    },
    onRemoved: () => router.push("/proctor/students"),
  });

  useEffect(() => {
    if (s) setBatchIds(s.batches.map((b) => b.id));
  }, [s]);

  const batchesDirty = !!s && [...batchIds].sort().join() !== s.batches.map((b) => b.id).sort().join();

  async function saveBatches() {
    setSavingBatches(true);
    try {
      await api(`/api/students/${studentId}`, { method: "PATCH", json: { batch_ids: batchIds } });
      toast.success("Batches updated");
      student.reload();
      batches.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingBatches(false);
    }
  }

  if (student.error && !s) {
    return (
      <>
        <BackLink />
        <ErrorNote message={student.error} onRetry={student.reload} />
      </>
    );
  }
  if (!s) return <PageSkeleton />;

  const finished = s.history.filter((a) => a.status !== "in_progress");
  const passed = finished.filter((a) => a.passed).length;

  return (
    <>
      <BackLink />
      <PageHeader
        eyebrow="[ 03 ]  Student"
        title={
          <span className="flex items-center gap-4">
            <Avatar name={s.name} src={s.photo_url} size={56} className="hidden sm:inline-flex" />
            <span>
              <b>{s.name || s.email}</b>
            </span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            {s.email}
            <MonoTag>{s.managed ? "Managed account" : "Linked account"}</MonoTag>
            {!s.active && <StatusPill status="terminated" label="Deactivated" />}
          </span>
        }
        actions={
          <>
            {s.managed && (
              <Button variant="outline" onClick={() => actions.open("reset", s)}>
                <KeyRound /> Reset password
              </Button>
            )}
            <Button variant="outline" onClick={() => actions.open("remove", s)}>
              <UserMinus /> Remove
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Face ID card */}
        <section className="surface overflow-hidden">
          <div className="relative aspect-[4/5] bg-muted">
            {s.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.photo_url} alt={`Reference photo of ${s.name || s.email}`} className="h-full w-full object-cover" />
            ) : (
              <div className="grainient flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-white">
                <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                  <ScanFace className="h-7 w-7" />
                </span>
                <p className="relative z-10 text-lg font-medium tracking-tight">No reference photo</p>
                <p className="relative z-10 text-sm text-white/80">Identity verification is skipped for this student.</p>
              </div>
            )}
            <span
              className={cn(
                "absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium backdrop-blur",
                s.has_reference ? "bg-black/55 text-white" : "bg-white/25 text-white"
              )}
            >
              {s.has_reference ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {s.has_reference ? "Face ID enrolled" : "Not enrolled"}
            </span>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => actions.open("photo", s)}>
                <Camera /> {s.has_reference ? "Replace photo" : "Add photo"}
              </Button>
              {s.has_reference && (
                <Button variant="outline" size="icon" aria-label="Remove reference photo" onClick={() => actions.open("remove-photo", s)}>
                  <Trash2 />
                </Button>
              )}
            </div>
            <ol className="space-y-3 text-sm">
              {[
                ["Before the exam", "Their webcam face is matched against this photo during the system check (3 tries)."],
                ["During the exam", "The face is re-checked every few seconds; a different person raises a high-severity flag."],
                ["You decide", "Mismatches come with snapshots. You can approve identity manually from the attempt review."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[11px]">
                    {i + 1}
                  </span>
                  <span>
                    <span className="font-medium">{t}.</span> <span className="text-muted-foreground">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="min-w-0 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard tone="ink" label="Exams taken" value={s.attempts} icon={FileText} hint={`${passed} passed`} />
            <StatCard
              label="Average score"
              value={s.average != null ? `${Math.round(s.average)}%` : "—"}
              icon={Award}
              tone="success"
            />
            <StatCard label="AI flags" value={s.flags} icon={AlertTriangle} tone="danger" hint="Across all attempts" />
            <StatCard label="Last active" value={<span className="text-xl">{s.last_active ? timeAgo(s.last_active) : "Never"}</span>} icon={Clock} />
          </div>

          <Section
            title="Batches"
            description="Exams assigned to these batches appear on the student's dashboard."
            actions={
              batchesDirty && (
                <Button size="sm" onClick={saveBatches} disabled={savingBatches}>
                  {savingBatches && <Loader2 className="animate-spin" />}
                  Save changes
                </Button>
              )
            }
          >
            <BatchPicker batches={batches.data ?? []} value={batchIds} onChange={setBatchIds} />
          </Section>

          <Section title="Exam history" description="Attempts on your exams" bodyClassName="px-3 pb-3 pt-1">
            {s.history.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No attempts yet" className="m-3">
                Their attempts on your exams will appear here.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border/60">
                {s.history.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/proctor/attempts/${a.id}`}
                      className="flex flex-wrap items-center gap-3 rounded-2xl px-3 py-3.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.exam_title || "Exam"}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(a.submitted_at || a.started_at)}</p>
                      </div>
                      <StatusPill status={a.status} />
                      <span className="tabular w-16 text-right text-sm font-semibold">
                        {a.percentage != null ? `${Math.round(a.percentage)}%` : "—"}
                      </span>
                      <RiskBadge score={a.risk_score} compact />
                      <ArrowUpRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {actions.dialogs}
    </>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
      <Link href="/proctor/students">
        <ArrowLeft /> Students
      </Link>
    </Button>
  );
}
