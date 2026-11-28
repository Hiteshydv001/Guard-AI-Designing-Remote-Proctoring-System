"use client";

import { useState } from "react";
import { AlertTriangle, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import type { Batch, Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ManageBatchesDialog } from "./batch-dialogs";
import { PhotoDialog } from "./photo-dialog";
import { ConfirmDialog, CopyButton } from "./shared";

export type StudentAction = "photo" | "batches" | "reset" | "remove" | "remove-photo";

/**
 * All per-student dialogs in one place. Usage:
 *   const actions = useStudentActions({ batches, onChanged });
 *   actions.open("photo", student);  ...  {actions.dialogs}
 */
export function useStudentActions({
  batches,
  onChanged,
  onRemoved,
}: {
  batches: Batch[];
  onChanged: () => void;
  onRemoved?: (s: Student) => void;
}) {
  const api = useApi();
  const [action, setAction] = useState<StudentAction | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [password, setPassword] = useState<string | null>(null);

  const open = (a: StudentAction, s: Student) => {
    setStudent(s);
    setAction(a);
  };
  const close = () => setAction(null);
  const label = student?.name || student?.email || "this student";

  const dialogs = (
    <>
      <PhotoDialog
        open={action === "photo"}
        onOpenChange={(o) => !o && close()}
        student={student}
        onSaved={() => onChanged()}
      />
      <ManageBatchesDialog
        open={action === "batches"}
        onOpenChange={(o) => !o && close()}
        student={student}
        batches={batches}
        onSaved={onChanged}
      />
      <ConfirmDialog
        open={action === "reset"}
        onOpenChange={(o) => !o && close()}
        title={`Reset password for ${label}?`}
        description="A new temporary password is generated and they're signed out of other devices. Share it with them securely."
        confirmLabel="Reset password"
        destructive={false}
        onConfirm={async () => {
          try {
            const r = await api<{ password: string }>(`/api/students/${student!.id}/reset-password`, { method: "POST" });
            setPassword(r.password);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
      <ConfirmDialog
        open={action === "remove-photo"}
        onOpenChange={(o) => !o && close()}
        title="Remove reference photo?"
        description="Identity verification will be skipped for this student until a new photo is added."
        confirmLabel="Remove photo"
        onConfirm={async () => {
          try {
            await api(`/api/students/${student!.id}/photo`, { method: "DELETE" });
            toast.success("Reference photo removed");
            onChanged();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
      <ConfirmDialog
        open={action === "remove"}
        onOpenChange={(o) => !o && close()}
        title={`Remove ${label}?`}
        description={
          student?.managed ? (
            <div className="space-y-2">
              <p>They&apos;ll be removed from your roster and batches.</p>
              <p className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-3 py-2 text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                You created this account, so their login is deleted and the account deactivated. Past exam results are kept.
              </p>
            </div>
          ) : (
            "They'll be removed from your roster and batches. Their own Guard AI account and past results aren't affected."
          )
        }
        confirmLabel="Remove student"
        onConfirm={async () => {
          try {
            await api(`/api/students/${student!.id}`, { method: "DELETE" });
            toast.success(`${label} removed`);
            onRemoved?.(student!);
            onChanged();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
      <Dialog open={!!password} onOpenChange={(o) => !o && setPassword(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <KeyRound className="h-5 w-5" />
            </span>
            <DialogTitle className="tracking-tight">New temporary password</DialogTitle>
            <DialogDescription>For {student?.email}. This is shown only once.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/40 p-4">
            <p className="truncate font-mono text-[15px] font-medium tracking-wide">{password}</p>
            <CopyButton value={password ?? ""} />
          </div>
          <DialogFooter>
            <Button onClick={() => setPassword(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return { open, dialogs };
}
