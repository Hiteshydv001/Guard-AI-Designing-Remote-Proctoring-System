"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import type { Batch, Student } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, EmptyState, Field, Skeleton } from "@/components/app/kit";
import { BatchPicker } from "./shared";

/* --------------------------------------------------------------------------- create / edit */

export function BatchFormDialog({
  open,
  onOpenChange,
  batch,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch?: Batch | null;
  onSaved: () => void;
}) {
  const api = useApi();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(batch?.name ?? "");
      setDescription(batch?.description ?? "");
    }
  }, [open, batch]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api(batch ? `/api/batches/${batch.id}` : "/api/batches", {
        method: batch ? "PATCH" : "POST",
        json: { name: name.trim(), description: description.trim() },
      });
      toast.success(batch ? "Batch updated" : "Batch created");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <p className="eyebrow">Batch</p>
            <DialogTitle className="text-xl tracking-tight">{batch ? "Edit batch" : "New batch"}</DialogTitle>
            <DialogDescription>Group students by class or section, then assign exams to the whole batch.</DialogDescription>
          </DialogHeader>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CSE · Section A · 2026" autoFocus maxLength={120} />
          </Field>
          <Field label="Description" hint="Optional">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
          </Field>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && <Loader2 className="animate-spin" />}
              {batch ? "Save" : "Create batch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------------------- per-student batches */

export function ManageBatchesDialog({
  open,
  onOpenChange,
  student,
  batches,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  batches: Batch[];
  onSaved: () => void;
}) {
  const api = useApi();
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && student) setIds(student.batches.map((b) => b.id));
  }, [open, student]);

  async function save() {
    if (!student) return;
    setBusy(true);
    try {
      await api(`/api/students/${student.id}`, { method: "PATCH", json: { batch_ids: ids } });
      toast.success("Batches updated");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <p className="eyebrow">Batches</p>
          <DialogTitle className="text-xl tracking-tight">{student?.name || student?.email}</DialogTitle>
          <DialogDescription>The student sees every published exam assigned to these batches.</DialogDescription>
        </DialogHeader>
        <BatchPicker batches={batches} value={ids} onChange={setIds} />
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------------------- batch sheet */

export function BatchSheet({
  batch,
  roster,
  onOpenChange,
  onChanged,
}: {
  batch: Batch | null;
  roster: Student[] | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const api = useApi();
  const [members, setMembers] = useState<Student[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function loadMembers(id: string) {
    try {
      setMembers(await api<Student[]>(`/api/students?batch_id=${encodeURIComponent(id)}`));
    } catch (e) {
      toast.error((e as Error).message);
      setMembers([]);
    }
  }

  useEffect(() => {
    setMembers(null);
    setAdding(false);
    setPicked([]);
    setQ("");
    if (batch) loadMembers(batch.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch?.id]);

  const memberIds = useMemo(() => new Set((members ?? []).map((m) => m.id)), [members]);
  const candidates = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (roster ?? [])
      .filter((s) => !memberIds.has(s.id))
      .filter((s) => !needle || (s.name || "").toLowerCase().includes(needle) || (s.email || "").toLowerCase().includes(needle));
  }, [roster, memberIds, q]);

  async function remove(s: Student) {
    if (!batch) return;
    setBusy(s.id);
    try {
      await api(`/api/batches/${batch.id}/members/${s.id}`, { method: "DELETE" });
      setMembers((m) => (m ?? []).filter((x) => x.id !== s.id));
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    if (!batch || !picked.length) return;
    setBusy("add");
    try {
      const r = await api<{ added: number }>(`/api/batches/${batch.id}/members`, { method: "POST", json: { student_ids: picked } });
      toast.success(`Added ${r.added} student${r.added === 1 ? "" : "s"} to ${batch.name}`);
      setPicked([]);
      setAdding(false);
      await loadMembers(batch.id);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={!!batch} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 border-border/70 bg-card p-0 sm:max-w-md">
        <SheetHeader className="space-y-1 border-b border-border/70 p-6 text-left">
          <p className="eyebrow">Batch</p>
          <SheetTitle className="text-xl tracking-tight">{batch?.name}</SheetTitle>
          <SheetDescription>{batch?.description || `${members?.length ?? batch?.member_count ?? 0} students`}</SheetDescription>
        </SheetHeader>

        <div className="hairline-scroll flex-1 overflow-y-auto p-4">
          {adding ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your roster" className="rounded-full pl-10" autoFocus />
              </div>
              {candidates.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {roster?.length ? "Everyone on your roster is already in this batch." : "Add students to your roster first."}
                </p>
              ) : (
                <ul className="space-y-1">
                  {candidates.map((s) => {
                    const on = picked.includes(s.id);
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                            on ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          )}
                        >
                          <Avatar name={s.name} src={s.photo_url} size={34} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{s.name || s.email}</p>
                            <p className={cn("truncate text-xs", on ? "text-primary-foreground/70" : "text-muted-foreground")}>{s.email}</p>
                          </div>
                          {on && <Check className="h-4 w-4" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : members === null ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <EmptyState icon={Users} title="No students yet" className="m-2">
              Add students from your roster to this batch.
            </EmptyState>
          ) : (
            <ul className="space-y-1">
              {members.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-muted/60">
                  <Avatar name={s.name} src={s.photo_url} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name || s.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(s)}
                    disabled={busy === s.id}
                    aria-label={`Remove ${s.name || s.email} from batch`}
                    title="Remove from batch"
                  >
                    {busy === s.id ? <Loader2 className="animate-spin" /> : <UserMinus />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2 border-t border-border/70 p-4">
          {adding ? (
            <>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Back
              </Button>
              <Button className="flex-1" onClick={add} disabled={!picked.length || busy === "add"}>
                {busy === "add" && <Loader2 className="animate-spin" />}
                Add {picked.length || ""} student{picked.length === 1 ? "" : "s"}
              </Button>
            </>
          ) : (
            <Button className="flex-1" onClick={() => setAdding(true)}>
              <UserPlus /> Add students
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
