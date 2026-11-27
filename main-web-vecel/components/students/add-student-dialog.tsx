"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, KeyRound, Loader2, Mail, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import type { Batch, StudentCreateResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, Segmented } from "@/components/app/kit";
import { BatchPicker, CopyButton, EMAIL_RE } from "./shared";

type Mode = "password" | "invite";

export function AddStudentDialog({
  open,
  onOpenChange,
  batches,
  defaultBatchIds = [],
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batches: Batch[];
  defaultBatchIds?: string[];
  onCreated: () => void;
}) {
  const api = useApi();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<Mode>("password");
  const [customPw, setCustomPw] = useState(false);
  const [password, setPassword] = useState("");
  const [batchIds, setBatchIds] = useState<string[]>(defaultBatchIds);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StudentCreateResult | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setMode("password");
      setCustomPw(false);
      setPassword("");
      setBatchIds(defaultBatchIds);
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const emailOk = EMAIL_RE.test(email.trim());
  const pwOk = !customPw || mode === "invite" || password.length >= 8;
  const canSubmit = name.trim().length > 0 && emailOk && pwOk && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const r = await api<StudentCreateResult>("/api/students", {
        method: "POST",
        json: {
          name: name.trim(),
          email: email.trim(),
          mode,
          password: mode === "password" && customPw ? password : undefined,
          batch_ids: batchIds,
        },
      });
      onCreated();
      if (r.status === "created" && r.password) {
        setResult(r);
      } else {
        toast.success(
          r.status === "invited"
            ? `Invitation emailed to ${r.email}`
            : `${r.name || r.email} already had an account — added to your roster`
        );
        onOpenChange(false);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {result ? (
          <>
            <DialogHeader>
              <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-success/10 text-success">
                <UserCheck className="h-5 w-5" />
              </span>
              <DialogTitle className="tracking-tight">Account created</DialogTitle>
              <DialogDescription>Share these sign-in details with {result.name || "the student"}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">Email</p>
                  <p className="truncate font-medium">{result.email}</p>
                </div>
                <CopyButton value={result.email} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">Temporary password</p>
                  <p className="truncate font-mono text-[15px] font-medium tracking-wide">{result.password}</p>
                </div>
                <CopyButton value={result.password!} />
              </div>
            </div>
            <p className="flex items-start gap-2 rounded-2xl bg-warning/10 px-3.5 py-2.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This password is shown only once. You can generate a new one later with “Reset password”.
            </p>
            <DialogFooter className="gap-2">
              <CopyButton value={`Email: ${result.email}\nPassword: ${result.password}`} label="Copy both" />
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <DialogHeader>
              <p className="eyebrow">New student</p>
              <DialogTitle className="text-xl tracking-tight">Add a student</DialogTitle>
              <DialogDescription>
                If the email already belongs to a Guard AI student, they&apos;re simply added to your roster.
              </DialogDescription>
            </DialogHeader>

            <Segmented<Mode>
              value={mode}
              onChange={setMode}
              className="w-full [&>button]:flex-1 [&>button]:justify-center"
              options={[
                { value: "password", label: (<><KeyRound className="h-4 w-4" /> Create account</>) },
                { value: "invite", label: (<><Mail className="h-4 w-4" /> Email invite</>) },
              ]}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" autoFocus maxLength={200} />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aarav@college.edu"
                  aria-invalid={email.length > 0 && !emailOk}
                />
              </Field>
            </div>

            {mode === "password" ? (
              <div className="space-y-3 rounded-2xl border border-border/70 p-4">
                <label className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block text-sm font-medium">Set a custom password</span>
                    <span className="block text-xs text-muted-foreground">Otherwise a strong password is generated for you.</span>
                  </span>
                  <Switch checked={customPw} onCheckedChange={setCustomPw} />
                </label>
                {customPw && (
                  <Input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="font-mono"
                  />
                )}
              </div>
            ) : (
              <p className="rounded-2xl bg-lavender px-4 py-3 text-sm text-lavender-foreground">
                We&apos;ll email a sign-up link. They join your roster automatically after signing up.
              </p>
            )}

            <Field label="Batches" hint="Students see exams assigned to their batches on their dashboard.">
              <BatchPicker batches={batches} value={batchIds} onChange={setBatchIds} />
            </Field>

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {busy && <Loader2 className="animate-spin" />}
                {mode === "invite" ? "Send invite" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
