"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Copy as CopyIcon, FileText, ListChecks, Pencil, Plus, Radio, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDate, useApi, useQuery } from "@/lib/api";
import type { Batch, ExamFull, ExamSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, EmptyState, ErrorNote, PageHeader, Segmented, Skeleton, StatusPill } from "@/components/app/kit";
import { CopyCode } from "@/components/proctor/common";

type Filter = "all" | "live" | "draft" | "closed";

export default function ExamsPage() {
  const api = useApi();
  const router = useRouter();
  const exams = useQuery<ExamSummary[]>("/api/exams", { refreshMs: 20000 });
  const batches = useQuery<Batch[]>("/api/batches");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const batchName = useMemo(() => new Map((batches.data ?? []).map((b) => [b.id, b.name])), [batches.data]);

  const counts = useMemo(() => {
    const list = exams.data ?? [];
    return {
      all: list.length,
      live: list.filter((e) => e.status === "published").length,
      draft: list.filter((e) => e.status === "draft").length,
      closed: list.filter((e) => e.status === "closed").length,
    };
  }, [exams.data]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (exams.data ?? []).filter((e) => {
      if (filter === "live" && e.status !== "published") return false;
      if (filter === "draft" && e.status !== "draft") return false;
      if (filter === "closed" && e.status !== "closed") return false;
      return !needle || e.title.toLowerCase().includes(needle) || e.access_code.toLowerCase().includes(needle);
    });
  }, [exams.data, filter, q]);

  async function duplicate(id: string) {
    setDuplicating(id);
    try {
      const copy = await api<ExamFull>(`/api/exams/${id}/duplicate`, { method: "POST" });
      toast.success("Exam duplicated as a draft");
      router.push(`/proctor/exams/${copy.id}/edit`);
    } catch (e) {
      toast.error((e as Error).message);
      setDuplicating(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="[ 02 ]  Exams"
        title={
          <>
            Build, publish and <b>monitor every exam.</b>
          </>
        }
        description="Share an access code, or assign exams to batches so students see them on their dashboard."
        actions={
          <Button asChild size="lg">
            <Link href="/proctor/exams/new">
              <Plus /> New exam
            </Link>
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: <>All <Count n={counts.all} /></> },
              { value: "live", label: <>Live <Count n={counts.live} /></> },
              { value: "draft", label: <>Drafts <Count n={counts.draft} /></> },
              { value: "closed", label: <>Closed <Count n={counts.closed} /></> },
            ]}
          />
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or code" className="rounded-full pl-10" aria-label="Search exams" />
        </div>
      </div>

      {exams.error && !exams.data && <ErrorNote message={exams.error} onRetry={exams.reload} />}

      {exams.loading && !exams.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[260px] rounded-[28px]" />
          ))}
        </div>
      ) : exams.data && exams.data.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No exams yet"
          action={
            <Button asChild>
              <Link href="/proctor/exams/new">
                <Plus /> Create your first exam
              </Link>
            </Button>
          }
        >
          Create an exam, publish it, and share the 6-character access code — or assign it to a batch.
        </EmptyState>
      ) : visible.length === 0 && exams.data ? (
        <EmptyState icon={Search} title="No matching exams">
          Try another filter or search term.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((e) => (
            <article
              key={e.id}
              className="group relative flex flex-col rounded-[28px] border border-border/70 bg-card p-5 transition-shadow hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)]"
            >
              <div className="flex items-start justify-between gap-3">
                <StatusPill status={e.status} />
                {!!e.live_count && (
                  <span className="flex items-center gap-1.5 rounded-full bg-lavender px-2.5 py-1 text-xs font-medium text-lavender-foreground">
                    <Radio className="h-3 w-3" /> {e.live_count} live
                  </span>
                )}
              </div>
              <Link
                href={`/proctor/exams/${e.id}`}
                className="mt-4 rounded-lg after:absolute after:inset-0 after:rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <h3 className="line-clamp-2 text-lg font-semibold leading-snug tracking-tight">{e.title}</h3>
              </Link>
              <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                {e.description || (e.starts_at ? `Opens ${formatDate(e.starts_at)}` : "No description")}
              </p>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <Meta icon={ListChecks} label="Questions" value={e.question_count} />
                <Meta icon={Clock} label="Minutes" value={e.duration_minutes} />
                <Meta icon={Users} label="Attempts" value={e.attempt_count ?? 0} />
              </dl>

              {e.batch_ids.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {e.batch_ids.slice(0, 3).map((b) => (
                    <Chip key={b}>{batchName.get(b) ?? "Batch"}</Chip>
                  ))}
                  {e.batch_ids.length > 3 && <Chip>+{e.batch_ids.length - 3}</Chip>}
                </div>
              )}

              <div className="relative z-10 mt-auto flex items-center gap-2 pt-5">
                <CopyCode code={e.access_code} size="sm" />
                <div className="ml-auto flex gap-1.5">
                  <Button asChild variant="outline" size="icon-sm" title="Edit" aria-label={`Edit ${e.title}`}>
                    <Link href={`/proctor/exams/${e.id}/edit`}>
                      <Pencil />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    title="Duplicate"
                    aria-label={`Duplicate ${e.title}`}
                    disabled={duplicating === e.id}
                    onClick={() => duplicate(e.id)}
                  >
                    <CopyIcon />
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/proctor/exams/${e.id}`}>Monitor</Link>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function Count({ n }: { n: number }) {
  return <span className="tabular text-xs opacity-60">{n}</span>;
}

function Meta({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-muted/60 px-3 py-2.5">
      <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </dt>
      <dd className="tabular mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}
