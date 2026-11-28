"use client";

import { useState } from "react";
import { Ban, Loader2, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const PRESETS = [
  "Please keep your face clearly visible in the camera.",
  "Please keep your eyes on the screen.",
  "Remove any phones, books or notes from your desk.",
  "Please stay quiet during the exam.",
];

type Mode = "warn" | "terminate" | null;

export function AttemptActions({
  attemptId,
  candidate,
  onDone,
  size = "sm",
  compact = false,
}: {
  attemptId: string;
  candidate: string;
  onDone?: () => void;
  size?: "sm" | "default";
  /** Icon-only buttons (for dense live cards). */
  compact?: boolean;
}) {
  const api = useApi();
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const open = (m: Mode) => {
    setText(m === "warn" ? PRESETS[0] : "Exam terminated by the proctor due to suspicious activity.");
    setMode(m);
  };

  async function confirm() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      if (mode === "warn") {
        await api(`/api/attempts/${attemptId}/warn`, { method: "POST", json: { message: text.trim() } });
        toast.success(`Warning sent to ${candidate}`, { description: "It appears on their screen within a few seconds." });
      } else {
        await api(`/api/attempts/${attemptId}/terminate`, { method: "POST", json: { reason: text.trim() } });
        toast.success(`${candidate}'s attempt was ended`);
      }
      setMode(null);
      onDone?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size={compact ? "icon-sm" : size}
        onClick={() => open("warn")}
        aria-label={`Warn ${candidate}`}
        title="Send a warning"
      >
        <MessageSquareWarning />
        {!compact && "Warn"}
      </Button>
      <Button
        variant="destructive"
        size={compact ? "icon-sm" : size}
        onClick={() => open("terminate")}
        aria-label={`End ${candidate}'s attempt`}
        title="End attempt"
      >
        <Ban />
        {!compact && "End"}
      </Button>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && !busy && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <p className="eyebrow">{mode === "warn" ? "Send warning" : "End attempt"}</p>
            <DialogTitle className="text-xl tracking-tight">
              {mode === "warn" ? `Warn ${candidate}` : `End ${candidate}'s exam?`}
            </DialogTitle>
            <DialogDescription>
              {mode === "warn"
                ? "The message pops up on the candidate's screen and is logged on their attempt."
                : "The attempt is submitted immediately with the answers saved so far. This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          {mode === "warn" && (
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setText(p)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    text === p ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            aria-label={mode === "warn" ? "Warning message" : "Reason"}
          />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setMode(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={mode === "warn" ? "default" : "destructive"} onClick={confirm} disabled={busy || !text.trim()}>
              {busy && <Loader2 className="animate-spin" />}
              {mode === "warn" ? "Send warning" : "End attempt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
