"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Clock,
  Copy,
  Download,
  ListChecks,
  Lock,
  MoreHorizontal,
  Pencil,
  Radio,
  Rocket,
  ShieldCheck,
  Trash2,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, saveBlob, useApi, useQuery } from "@/lib/api";
import type { AttemptSummary, Batch, ExamFull, ExamSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Chip, ErrorNote, PageSkeleton, Segmented, StatusPill } from "@/components/app/kit";
import { ConfirmDialog, CopyCode, slugify } from "@/components/proctor/common";
import { LiveGrid } from "@/components/proctor/live-grid";
import { ResultsTable } from "@/components/proctor/results-table";
import { AnalyticsPanel } from "@/components/proctor/analytics-panel";

interface Data {
  exam: ExamSummary;
  attempts: AttemptSummary[];
}

type Tab = "live" | "results" | "analytics";

export default function ExamMonitorPage() {
  const { examId } = useParams<{ examId: string }>();
  const api = useApi();
  const router = useRouter();
  const { data, error, loading, reload } = useQuery<Data>(`/api/exams/${examId}/attempts`, { refreshMs: 3000 });
  const batches = useQuery<Batch[]>("/api/batches");
  const [tab, setTab] = useState<Tab>("live");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const live = useMemo(() => data?.attempts.filter((a) => a.status === "in_progress") ?? [], [data]);
  const done = useMemo(() => data?.attempts.filter((a) => a.status !== "in_progress") ?? [], [data]);
  const batchName = useMemo(() => new Map((batches.data ?? []).map((b) => [b.id, b.name])), [batches.data]);

  if (error && !data) return <ErrorNote message={error} onRetry={reload} />;
  if (loading && !data) return <PageSkeleton />;
  if (!data) return null;
  const { exam } = data;

  async function setStatus(status: "published" | "closed" | "draft") {
    setBusy(true);
    try {
      await api(`/api/exams/${examId}/status`, { method: "POST", json: { status } });
      toast.success(status === "published" ? "Exam is live" : status === "closed" ? "Exam closed" : "Moved back to draft", {
        description: status === "published" ? "Share the access code or check your assigned batches." : undefined,
      });
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    try {
      const blob = await api<Blob>(`/api/exams/${examId}/results.csv`);
      saveBlob(blob, `${slugify(exam.title)}-results.csv`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function duplicate() {
    try {
      const copy = await api<ExamFull>(`/api/exams/${examId}/duplicate`, { method: "POST" });
      toast.success("Exam duplicated as a draft");
      router.push(`/proctor/exams/${copy.id}/edit`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove() {
    try {
      await api(`/api/exams/${examId}`, { method: "DELETE" });
      toast.success("Exam deleted");
      router.push("/proctor/exams");
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
        <Link href="/proctor/exams">
          <ArrowLeft /> Exams
        </Link>
      </Button>

      {/* ------------------------------------------------------------ header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusPill status={exam.status} />
            {exam.settings.verify_identity && (
              <Chip>
                <ShieldCheck className="h-3 w-3" /> Identity check
              </Chip>
            )}
            {exam.batch_ids.map((b) => (
              <Chip key={b} className="bg-muted text-muted-foreground">
                {batchName.get(b) ?? "Batch"}
              </Chip>
            ))}
          </div>
          <h1 className="display text-[28px] leading-[1.1] md:text-[36px]">
            <b>{exam.title}</b>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <ListChecks className="h-4 w-4" /> {exam.question_count} questions · {exam.total_points} pts
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> {exam.duration_minutes} min
            </span>
            {exam.starts_at && (
              <span className="flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" /> Opens {formatDate(exam.starts_at)}
              </span>
            )}
            {exam.ends_at && <span>Closes {formatDate(exam.ends_at)}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CopyCode code={exam.access_code} />
          {exam.status !== "published" ? (
            <Button onClick={() => setStatus("published")} disabled={busy}>
              <Rocket /> Publish
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setConfirmClose(true)} disabled={busy}>
              <Lock /> Close
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={`/proctor/exams/${exam.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
              <DropdownMenuItem className="rounded-xl" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" /> Export results (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl" onClick={duplicate}>
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              {exam.status === "closed" && (
                <DropdownMenuItem className="rounded-xl" onClick={() => setStatus("draft")}>
                  <Pencil className="mr-2 h-4 w-4" /> Move to draft
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-xl text-destructive focus:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete exam
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {exam.status === "draft" && (
        <div className="grainient-soft mb-6 rounded-[28px] p-5">
          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <b>This exam is a draft.</b> Publish it, then share code{" "}
              <span className="font-mono font-semibold tracking-widest">{exam.access_code}</span>
              {exam.batch_ids.length ? " — assigned batches will also see it on their dashboard." : "."}
            </p>
            <Button onClick={() => setStatus("published")} disabled={busy || !exam.question_count}>
              <Rocket /> Publish now
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ tabs */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "live", label: <><Radio className="h-4 w-4" /> Live <Badge n={live.length} /></> },
              { value: "results", label: <><Trophy className="h-4 w-4" /> Results <Badge n={done.length} /></> },
              { value: "analytics", label: <><BarChart3 className="h-4 w-4" /> Analytics</> },
            ]}
          />
        </div>
        {tab === "live" && live.length > 0 && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Updating every 3 seconds · sorted by risk
          </p>
        )}
        {tab === "results" && done.length > 0 && (
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download /> Export CSV
          </Button>
        )}
      </div>

      {tab === "live" && <LiveGrid attempts={live} questionCount={exam.question_count} onChange={reload} />}
      {tab === "results" && <ResultsTable attempts={done} totalPoints={exam.total_points} />}
      {tab === "analytics" && <AnalyticsPanel examId={exam.id} />}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this exam?"
        description="All attempts, answers and AI evidence for this exam are permanently deleted. This can't be undone."
        confirmLabel="Delete exam"
        destructive
        onConfirm={remove}
      />
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Close this exam?"
        description={
          live.length
            ? `${live.length} candidate${live.length === 1 ? " is" : "s are"} still taking it — they can finish, but nobody new can join.`
            : "Nobody new will be able to join. You can reopen it later."
        }
        confirmLabel="Close exam"
        onConfirm={() => setStatus("closed")}
      />
    </>
  );
}

function Badge({ n }: { n: number }) {
  return <span className="tabular text-xs opacity-60">{n}</span>;
}
