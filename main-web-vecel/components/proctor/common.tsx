"use client";

import { useState } from "react";
import { Check, Copy, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { AttemptSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CopyCode({ code, className, size = "md" }: { code: string; className?: string; size?: "sm" | "md" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          toast.success("Access code copied");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy — select the code manually");
        }
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/80 bg-card font-mono tracking-[0.2em] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        className
      )}
      aria-label={`Copy access code ${code}`}
      title="Copy access code"
    >
      {code}
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl tracking-tight">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Identity state from the attempt record, refined by the latest live recognition score. */
export function identityOf(a: Pick<AttemptSummary, "identity" | "live">) {
  const status = a.identity?.status;
  const live = a.live?.identity;
  if (status === "approved") return { kind: "ok" as const, label: "Approved", score: a.identity.score ?? null };
  if (live && !live.match) return { kind: "bad" as const, label: "Mismatch", score: live.score };
  if (status === "failed") return { kind: "bad" as const, label: "Not verified", score: a.identity.score ?? null };
  if (status === "retry") return { kind: "bad" as const, label: "Locked: face mismatch", score: a.identity.score ?? null };
  if (status === "no_reference") return { kind: "bad" as const, label: "Locked: no photo", score: null };
  if (status === "verified" || live?.match)
    return { kind: "ok" as const, label: "Verified", score: live?.score ?? a.identity.score ?? null };
  if (status === "skipped") return { kind: "none" as const, label: "No photo", score: null };
  return { kind: "pending" as const, label: "Not checked", score: null };
}

export function IdentityBadge({ attempt, className }: { attempt: Pick<AttemptSummary, "identity" | "live">; className?: string }) {
  const id = identityOf(attempt);
  const Icon = id.kind === "ok" ? ShieldCheck : id.kind === "bad" ? ShieldAlert : ShieldQuestion;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        id.kind === "ok" && "bg-success/10 text-success",
        id.kind === "bad" && "bg-destructive/10 text-destructive",
        (id.kind === "none" || id.kind === "pending") && "bg-muted text-muted-foreground",
        className
      )}
      title={id.score != null ? `Face match ${Math.round(id.score * 100)}%` : undefined}
    >
      <Icon className="h-3.5 w-3.5" />
      {id.label}
      {id.score != null && <span className="tabular opacity-80">· {Math.round(id.score * 100)}%</span>}
    </span>
  );
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "exam"
  );
}

export function formatOffset(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `+${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
