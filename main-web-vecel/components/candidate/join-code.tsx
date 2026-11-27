"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Clock, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import type { ExamLookup } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Chip, MonoTag } from "@/components/app/kit";
import { ExamWindow } from "./exam-window";

export function JoinByCode() {
  const api = useApi();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<ExamLookup | null>(null);
  const [busy, setBusy] = useState<"find" | "join" | null>(null);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (c.length < 4) return;
    setBusy("find");
    try {
      setLookup(await api<ExamLookup>(`/api/exams/lookup/${encodeURIComponent(c)}`));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function join() {
    setBusy("join");
    try {
      const r = await api<{ attempt_id: string }>("/api/exams/join", { method: "POST", json: { access_code: code.trim() } });
      router.push(`/exam/${r.attempt_id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(null);
    }
  }

  const existing = lookup?.existing_attempt;
  const done = existing && existing.status !== "in_progress";

  return (
    <>
      <div className="surface p-6">
        <p className="eyebrow mb-2">[ code ]</p>
        <h3 className="text-lg font-semibold tracking-tight">Have an access code?</h3>
        <p className="mt-1 text-sm text-muted-foreground">Your examiner can share a 6-character code for open exams.</p>
        <form onSubmit={find} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="ABC123"
              aria-label="Access code"
              maxLength={12}
              className="pl-10 font-mono tracking-[0.3em]"
            />
          </div>
          <Button type="submit" size="icon" aria-label="Find exam" disabled={code.trim().length < 4 || busy !== null}>
            {busy === "find" ? <Loader2 className="animate-spin" /> : <ArrowRight />}
          </Button>
        </form>
      </div>

      <Dialog open={!!lookup} onOpenChange={(o) => !o && setLookup(null)}>
        <DialogContent className="max-w-md">
          {lookup && (
            <>
              <DialogHeader>
                <MonoTag className="w-fit">{code}</MonoTag>
                <DialogTitle className="text-xl tracking-tight">{lookup.title}</DialogTitle>
                {lookup.description && (
                  <DialogDescription className="whitespace-pre-wrap">{lookup.description}</DialogDescription>
                )}
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                <Chip>
                  <Clock className="h-3 w-3" /> {lookup.duration_minutes} min
                </Chip>
                <Chip>
                  <BookOpen className="h-3 w-3" /> {lookup.question_count} questions
                </Chip>
                <Chip>
                  <ShieldCheck className="h-3 w-3" /> AI proctored
                </Chip>
              </div>
              <ExamWindow startsAt={lookup.starts_at} endsAt={lookup.ends_at} />
              {done ? (
                <p className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">You have already completed this exam.</p>
              ) : lookup.open_error && !existing ? (
                <p className="rounded-2xl bg-destructive/5 p-3 text-sm text-destructive">{lookup.open_error}</p>
              ) : (
                <Button size="lg" onClick={join} disabled={busy !== null}>
                  {busy === "join" && <Loader2 className="animate-spin" />}
                  {existing ? "Resume exam" : "Continue to system check"}
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
