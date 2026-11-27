"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Camera,
  FileSpreadsheet,
  Layers,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  ScanFace,
  Search,
  ShieldCheck,
  Trash2,
  UserMinus,
  KeyRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { timeAgo, useApi, useQuery } from "@/lib/api";
import type { Batch, Invite, Student } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarStack, EmptyState, ErrorNote, MonoTag, PageHeader, Segmented, Skeleton } from "@/components/app/kit";
import { AddStudentDialog } from "@/components/students/add-student-dialog";
import { ImportDialog } from "@/components/students/import-dialog";
import { BatchFormDialog, BatchSheet } from "@/components/students/batch-dialogs";
import { useStudentActions } from "@/components/students/student-actions";
import { BatchChips, ConfirmDialog } from "@/components/students/shared";

type Tab = "students" | "batches" | "invites";

export default function StudentsPage() {
  const students = useQuery<Student[]>("/api/students");
  const batches = useQuery<Batch[]>("/api/batches");
  const invites = useQuery<Invite[]>("/api/invites");
  const [tab, setTab] = useState<Tab>("students");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const refreshAll = () => {
    students.reload();
    batches.reload();
    invites.reload();
  };

  const counts = {
    students: students.data?.length,
    batches: batches.data?.length,
    invites: invites.data?.length,
  };

  return (
    <>
      <PageHeader
        eyebrow="[ 03 ]  Students"
        title={
          <>
            Your roster, batches and <b>Face ID in one place.</b>
          </>
        }
        description="Create student accounts, group them into batches, and register a reference photo so every exam verifies who's taking it."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet /> Import CSV
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus /> Add student
            </Button>
          </>
        }
      />

      <div className="no-scrollbar -mx-1 mb-6 overflow-x-auto px-1">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "students", label: <>Students <Count n={counts.students} /></> },
            { value: "batches", label: <>Batches <Count n={counts.batches} /></> },
            { value: "invites", label: <>Invites <Count n={counts.invites} /></> },
          ]}
        />
      </div>

      {tab === "students" && (
        <StudentsTab
          students={students}
          batches={batches.data ?? []}
          onAdd={() => setAddOpen(true)}
          onImport={() => setImportOpen(true)}
          onChanged={refreshAll}
        />
      )}
      {tab === "batches" && <BatchesTab batches={batches} roster={students.data} onChanged={refreshAll} />}
      {tab === "invites" && <InvitesTab invites={invites} batches={batches.data ?? []} />}

      <AddStudentDialog open={addOpen} onOpenChange={setAddOpen} batches={batches.data ?? []} onCreated={refreshAll} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} batches={batches.data ?? []} onImported={refreshAll} />
    </>
  );
}

function Count({ n }: { n?: number }) {
  if (n === undefined) return null;
  return <span className="tabular text-[11px] opacity-60">{n}</span>;
}

/* =========================================================================== students */

type QueryState<T> = ReturnType<typeof useQuery<T>>;

function StudentsTab({
  students,
  batches,
  onAdd,
  onImport,
  onChanged,
}: {
  students: QueryState<Student[]>;
  batches: Batch[];
  onAdd: () => void;
  onImport: () => void;
  onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  const [batchFilter, setBatchFilter] = useState<string | null>(null);
  const [faceFilter, setFaceFilter] = useState(false);
  const actions = useStudentActions({ batches, onChanged });

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (students.data ?? []).filter((s) => {
      if (batchFilter && !s.batches.some((b) => b.id === batchFilter)) return false;
      if (faceFilter && s.has_reference) return false;
      return !needle || (s.name || "").toLowerCase().includes(needle) || (s.email || "").toLowerCase().includes(needle);
    });
  }, [students.data, q, batchFilter, faceFilter]);

  const missingFace = (students.data ?? []).filter((s) => !s.has_reference).length;

  if (students.error && !students.data) return <ErrorNote message={students.error} onRetry={students.reload} />;

  if (students.loading && !students.data) {
    return (
      <div className="surface space-y-1 p-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (students.data && students.data.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No students on your roster yet"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={onImport}>
              <FileSpreadsheet /> Import CSV
            </Button>
            <Button onClick={onAdd}>
              <Plus /> Add student
            </Button>
          </div>
        }
      >
        Create accounts for your class, send email invites, or link students who already signed up.
      </EmptyState>
    );
  }

  return (
    <>
      {missingFace > 0 && (
        <button
          onClick={() => setFaceFilter((f) => !f)}
          className="grainient-soft mb-4 flex w-full items-center gap-3 rounded-[24px] px-5 py-4 text-left"
        >
          <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card">
            <ScanFace className="h-5 w-5" />
          </span>
          <span className="relative z-10 min-w-0 flex-1 text-sm">
            <span className="font-semibold">
              {missingFace} student{missingFace === 1 ? "" : "s"} without a reference photo.
            </span>{" "}
            <span className="text-foreground/70">Identity verification is skipped for them during exams.</span>
          </span>
          <span className="relative z-10 shrink-0 rounded-full bg-card px-3 py-1.5 text-xs font-medium">
            {faceFilter ? "Show all" : "Show them"}
          </span>
        </button>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-80">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email"
            className="rounded-full pl-10"
            aria-label="Search students"
          />
        </div>
        {batches.length > 0 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            <FilterChip active={!batchFilter} onClick={() => setBatchFilter(null)}>
              All batches
            </FilterChip>
            {batches.map((b) => (
              <FilterChip key={b.id} active={batchFilter === b.id} onClick={() => setBatchFilter(batchFilter === b.id ? null : b.id)}>
                {b.name}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Search} title="No matching students">
          Try another search or filter.
        </EmptyState>
      ) : (
        <>
          {/* Desktop table */}
          <div className="surface hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3.5 font-medium">Student</th>
                  <th className="px-3 py-3.5 font-medium">Batches</th>
                  <th className="px-3 py-3.5 font-medium">Face ID</th>
                  <th className="px-3 py-3.5 text-right font-medium">Exams</th>
                  <th className="px-3 py-3.5 text-right font-medium">Average</th>
                  <th className="px-3 py-3.5 text-right font-medium">Flags</th>
                  <th className="px-3 py-3.5 font-medium">Last active</th>
                  <th className="w-12 px-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visible.map((s) => (
                  <tr key={s.id} className="group transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link href={`/proctor/students/${s.id}`} className="flex items-center gap-3 focus-visible:outline-none">
                        <Avatar name={s.name} src={s.photo_url} size={38} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate font-medium group-hover:underline group-hover:underline-offset-4">
                            {s.name || s.email}
                          </p>
                          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                            {s.email}
                            <MonoTag className="py-0 text-[10px]">{s.managed ? "Managed" : "Linked"}</MonoTag>
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <BatchChips batches={s.batches} />
                    </td>
                    <td className="px-3 py-3">
                      <FaceStatus s={s} onAdd={() => actions.open("photo", s)} />
                    </td>
                    <td className="tabular px-3 py-3 text-right">{s.attempts}</td>
                    <td className="tabular px-3 py-3 text-right">{s.average != null ? `${Math.round(s.average)}%` : "—"}</td>
                    <td className={cn("tabular px-3 py-3 text-right", s.flags > 0 && "font-medium text-destructive")}>{s.flags}</td>
                    <td className="px-3 py-3 text-muted-foreground">{s.last_active ? timeAgo(s.last_active) : "Never"}</td>
                    <td className="px-3 py-3">
                      <RowMenu s={s} onAction={actions.open} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {visible.map((s) => (
              <li key={s.id} className="surface p-4">
                <div className="flex items-start gap-3">
                  <Link href={`/proctor/students/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={s.name} src={s.photo_url} size={44} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.name || s.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                    </div>
                  </Link>
                  <RowMenu s={s} onAction={actions.open} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <FaceStatus s={s} onAdd={() => actions.open("photo", s)} />
                  <BatchChips batches={s.batches} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-muted/50 p-3 text-center text-xs">
                  <div>
                    <dt className="text-muted-foreground">Exams</dt>
                    <dd className="tabular mt-0.5 text-sm font-semibold">{s.attempts}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Average</dt>
                    <dd className="tabular mt-0.5 text-sm font-semibold">{s.average != null ? `${Math.round(s.average)}%` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Flags</dt>
                    <dd className={cn("tabular mt-0.5 text-sm font-semibold", s.flags > 0 && "text-destructive")}>{s.flags}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      {actions.dialogs}
    </>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors",
        active ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function FaceStatus({ s, onAdd }: { s: Student; onAdd: () => void }) {
  if (s.has_reference) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
        <ShieldCheck className="h-3.5 w-3.5" /> Enrolled
      </span>
    );
  }
  return (
    <button
      onClick={onAdd}
      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
    >
      <Camera className="h-3.5 w-3.5" /> Add photo
    </button>
  );
}

function RowMenu({ s, onAction }: { s: Student; onAction: (a: "photo" | "batches" | "reset" | "remove", s: Student) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.name || s.email}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
        <DropdownMenuItem className="rounded-xl" onClick={() => onAction("photo", s)}>
          <Camera className="mr-2 h-4 w-4" /> {s.has_reference ? "Replace photo" : "Add reference photo"}
        </DropdownMenuItem>
        <DropdownMenuItem className="rounded-xl" onClick={() => onAction("batches", s)}>
          <Layers className="mr-2 h-4 w-4" /> Manage batches
        </DropdownMenuItem>
        {s.managed && (
          <DropdownMenuItem className="rounded-xl" onClick={() => onAction("reset", s)}>
            <KeyRound className="mr-2 h-4 w-4" /> Reset password
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="rounded-xl text-destructive focus:text-destructive" onClick={() => onAction("remove", s)}>
          <UserMinus className="mr-2 h-4 w-4" /> Remove from roster
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* =========================================================================== batches */

function BatchesTab({
  batches,
  roster,
  onChanged,
}: {
  batches: QueryState<Batch[]>;
  roster: Student[] | null;
  onChanged: () => void;
}) {
  const api = useApi();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [deleting, setDeleting] = useState<Batch | null>(null);
  const [openBatch, setOpenBatch] = useState<Batch | null>(null);

  const membersOf = (id: string) => (roster ?? []).filter((s) => s.batches.some((b) => b.id === id)).map((s) => s.name || s.email);

  if (batches.error && !batches.data) return <ErrorNote message={batches.error} onRetry={batches.reload} />;

  return (
    <>
      {batches.loading && !batches.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-[28px]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(batches.data ?? []).map((b) => (
            <article
              key={b.id}
              className="group relative flex min-h-[190px] flex-col rounded-[28px] border border-border/70 bg-card p-5 transition-shadow hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="grainient-soft flex h-10 w-10 items-center justify-center rounded-full">
                  <Layers className="relative z-10 h-4 w-4" />
                </span>
                <div className="relative z-10 flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${b.name}`}
                    onClick={() => {
                      setEditing(b);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${b.name}`} onClick={() => setDeleting(b)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <button
                onClick={() => setOpenBatch(b)}
                className="mt-4 text-left after:absolute after:inset-0 after:rounded-[28px] focus-visible:outline-none"
              >
                <h3 className="text-lg font-semibold tracking-tight">{b.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{b.description || "No description"}</p>
              </button>
              <div className="mt-auto flex items-center justify-between pt-4">
                <AvatarStack names={membersOf(b.id)} />
                <p className="text-xs text-muted-foreground">
                  <span className="tabular font-medium text-foreground">{b.member_count}</span> students ·{" "}
                  <span className="tabular font-medium text-foreground">{b.exam_count}</span> exams
                </p>
              </div>
            </article>
          ))}

          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium">New batch</span>
          </button>
        </div>
      )}

      <BatchFormDialog open={formOpen} onOpenChange={setFormOpen} batch={editing} onSaved={onChanged} />
      <BatchSheet batch={openBatch} roster={roster} onOpenChange={(o) => !o && setOpenBatch(null)} onChanged={onChanged} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name}”?`}
        description="Students stay on your roster, and exams stay published — they're just no longer assigned through this batch."
        confirmLabel="Delete batch"
        onConfirm={async () => {
          try {
            await api(`/api/batches/${deleting!.id}`, { method: "DELETE" });
            toast.success("Batch deleted");
            onChanged();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </>
  );
}

/* =========================================================================== invites */

function InvitesTab({ invites, batches }: { invites: QueryState<Invite[]>; batches: Batch[] }) {
  const api = useApi();
  const [revoking, setRevoking] = useState<Invite | null>(null);
  const batchName = new Map(batches.map((b) => [b.id, b.name]));

  if (invites.error && !invites.data) return <ErrorNote message={invites.error} onRetry={invites.reload} />;
  if (invites.loading && !invites.data) return <Skeleton className="h-40 rounded-[28px]" />;
  if (!invites.data?.length) {
    return (
      <EmptyState icon={Mail} title="No pending invites">
        Invited students appear here until they sign up — then they join your roster automatically.
      </EmptyState>
    );
  }

  return (
    <>
      <ul className="surface divide-y divide-border/60 overflow-hidden">
        {invites.data.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lavender text-lavender-foreground">
              <Mail className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.name || i.email}</p>
              <p className="truncate text-xs text-muted-foreground">
                {i.email} · invited {timeAgo(i.created_at)}
              </p>
            </div>
            <div className="hidden flex-wrap gap-1 sm:flex">
              {i.batch_ids.map((id) => (
                <span key={id} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                  {batchName.get(id) ?? "Batch"}
                </span>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setRevoking(i)}>
              <X /> Revoke
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Revoke invitation?"
        description={`The sign-up link sent to ${revoking?.email} will stop working.`}
        confirmLabel="Revoke"
        onConfirm={async () => {
          try {
            await api(`/api/invites/${revoking!.id}`, { method: "DELETE" });
            toast.success("Invitation revoked");
            invites.reload();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </>
  );
}
