"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import type { AttemptSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DoneScreen({ result }: { result: AttemptSummary | null }) {
  const terminated = result?.status === "terminated";
  const hasScore = result?.score !== null && result?.score !== undefined;
  return (
    <div className="ambient flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-border/70 bg-card">
        <div className={cn("p-8", terminated ? "grainient-soft" : "bronze")}>
          <div className="relative z-10">
            {terminated ? (
              <XCircle className="h-10 w-10 text-destructive" />
            ) : (
              <CheckCircle2 className="h-10 w-10 text-white" />
            )}
            <p className={cn("eyebrow mt-6", !terminated && "text-white/70")}>{terminated ? "[ ended ]" : "[ submitted ]"}</p>
            <h1 className={cn("mt-2 text-3xl font-semibold tracking-tight", !terminated && "text-white")}>
              {terminated ? "Your exam was ended" : "Nicely done."}
            </h1>
            <p className={cn("mt-2 text-sm", terminated ? "text-muted-foreground" : "text-white/80")}>
              {result?.termination_reason && result.termination_reason !== "Time expired"
                ? result.termination_reason
                : result?.termination_reason === "Time expired"
                  ? "Time ran out — your saved answers were submitted."
                  : "Your answers are saved and submitted."}
            </p>
          </div>
        </div>
        <div className="space-y-5 p-8">
          {hasScore && (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Auto-graded score</p>
                <p className="tabular text-4xl font-semibold tracking-tight">
                  {result!.score}
                  <span className="text-xl text-muted-foreground"> / {result!.max_score}</span>
                </p>
              </div>
              {result!.passed !== null && (
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-medium",
                    result!.passed ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                  )}
                >
                  {result!.passed ? "Passed" : "Below pass mark"}
                </span>
              )}
            </div>
          )}
          {hasScore && <p className="text-xs text-muted-foreground">Written answers may be graded later by your proctor.</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            {result && (
              <Button asChild variant="outline" className="flex-1">
                <Link href={`/candidate/results/${result.id}`}>View result</Link>
              </Button>
            )}
            <Button asChild className="flex-1">
              <Link href="/candidate">
                Dashboard <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
