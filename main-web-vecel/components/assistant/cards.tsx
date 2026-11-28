"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, KeyRound, Loader2, Mail, PenLine, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/app/kit";
import { cn } from "@/lib/utils";

export type ExamBrief = {
  id: string;
  title: string;
  status: string;
  question_count: number;
  total_points: number;
  duration_minutes: number;
  starts_at: string | null;
  ends_at: string | null;
  access_code: string;
};

export type StudentResult = { name?: string; email: string; status: string; password?: string; error?: string };

export type AssistantCard =
  | { type: "exam"; exam: ExamBrief }
  | { type: "students"; mode: "invite" | "password"; results: StudentResult[] }
  | {
      type: "confirm";
      id: string;
      tool: string;
      title: string;
      lines: string[];
      confirm_label: string;
      tone: "default" | "danger";
      state?: "pending" | "working" | "confirmed" | "cancelled" | "failed";
      error?: string;
    };

const shell = "rounded-3xl border border-border/70 bg-card p-5";

export function ExamCard({ exam }: { exam: ExamBrief }) {
  const facts = [
    `${exam.question_count} question${exam.question_count === 1 ? "" : "s"}`,
    `${exam.total_points} pts`,
    `${exam.duration_minutes} min`,
    exam.starts_at ? `Opens ${formatDate(exam.starts_at)}` : "No start time",
  ];
  return (
    <div className={shell}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">[ exam ]</p>
          <h3 className="mt-1.5 truncate text-lg font-semibold tracking-tight">{exam.title}</h3>
        </div>
        <StatusPill status={exam.status} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{facts.join(" · ")}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" asChild>
          <Link href={`/proctor/exams/${exam.id}`}>
            Open exam <ArrowUpRight />
          </Link>
        </Button>
        {exam.status === "draft" && (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/proctor/exams/${exam.id}/edit`}>
              <PenLine /> Review questions
            </Link>
          </Button>
        )}
        <span className="ml-auto font-mono text-xs tracking-[0.2em] text-muted-foreground">{exam.access_code}</span>
      </div>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

const STATUS_COPY: Record<string, { label: string; cls: string }> = {
  created: { label: "Account created", cls: "bg-success/10 text-success" },
  invited: { label: "Invite sent", cls: "bg-success/10 text-success" },
  linked: { label: "Already a student, linked", cls: "bg-muted text-muted-foreground" },
  skipped: { label: "Skipped", cls: "bg-muted text-muted-foreground" },
  error: { label: "Failed", cls: "bg-destructive/10 text-destructive" },
};

export function StudentsCard({ mode, results }: { mode: "invite" | "password"; results: StudentResult[] }) {
  const withPasswords = results.filter((r) => r.password);
  return (
    <div className={shell}>
      <p className="eyebrow flex items-center gap-1.5">
        {mode === "invite" ? <Mail className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />}[ {mode === "invite" ? "invitations" : "accounts"} ]
      </p>
      <ul className="mt-3 divide-y divide-border/70">
        {results.map((r) => {
          const s = STATUS_COPY[r.status] ?? STATUS_COPY.error;
          return (
            <li key={r.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name || r.email}</p>
                <p className="truncate text-xs text-muted-foreground">{r.error || r.email}</p>
              </div>
              {r.password && (
                <span className="flex items-center gap-1 rounded-full bg-muted py-0.5 pl-3 pr-1 font-mono text-xs">
                  {r.password}
                  <CopyButton value={r.password} label={`Copy password for ${r.email}`} />
                </span>
              )}
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", s.cls)}>{s.label}</span>
            </li>
          );
        })}
      </ul>
      {withPasswords.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-warning/10 px-3.5 py-2.5 text-xs text-warning">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> Passwords are shown once. Copy them now and share them privately.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              navigator.clipboard
                .writeText(withPasswords.map((r) => `${r.name || ""}\t${r.email}\t${r.password}`).join("\n"))
                .then(() => toast.success("Copied all logins"))
            }
          >
            <Copy /> Copy all
          </Button>
        </div>
      )}
    </div>
  );
}

export function ConfirmCard({
  card,
  onDecide,
}: {
  card: Extract<AssistantCard, { type: "confirm" }>;
  onDecide: (decision: "confirm" | "cancel") => void;
}) {
  const state = card.state ?? "pending";
  const danger = card.tone === "danger";
  return (
    <div className={cn(shell, "border-2", state === "pending" || state === "working" ? (danger ? "border-destructive/40" : "border-foreground/80") : "opacity-80")}>
      <p className="eyebrow">[ needs your approval ]</p>
      <h3 className="mt-1.5 text-lg font-semibold tracking-tight">{card.title}</h3>
      {card.lines.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {card.lines.map((l, i) => (
            <li key={i} className="break-words">
              {l}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {state === "pending" || state === "working" ? (
          <>
            <Button size="sm" variant={danger ? "destructive" : "default"} disabled={state === "working"} onClick={() => onDecide("confirm")}>
              {state === "working" ? <Loader2 className="animate-spin" /> : <Check />} {card.confirm_label}
            </Button>
            <Button size="sm" variant="ghost" disabled={state === "working"} onClick={() => onDecide("cancel")}>
              <X /> Cancel
            </Button>
          </>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              state === "confirmed" && "bg-success/10 text-success",
              state === "cancelled" && "bg-muted text-muted-foreground",
              state === "failed" && "bg-destructive/10 text-destructive"
            )}
          >
            {state === "confirmed" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            {state === "confirmed" ? "Done" : state === "cancelled" ? "Cancelled" : card.error || "Failed"}
          </span>
        )}
      </div>
    </div>
  );
}
