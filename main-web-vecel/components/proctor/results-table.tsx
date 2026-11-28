"use client";

import Link from "next/link";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import { formatDate } from "@/lib/api";
import type { AttemptSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, RiskBadge, StatusPill } from "@/components/app/kit";

function Score({ a, totalPoints }: { a: AttemptSummary; totalPoints: number }) {
  return (
    <div>
      <p className="tabular font-semibold">
        {a.score ?? "—"}
        <span className="font-normal text-muted-foreground"> / {a.max_score ?? totalPoints}</span>
      </p>
      {a.percentage != null && <p className="tabular text-xs text-muted-foreground">{Math.round(a.percentage)}%</p>}
    </div>
  );
}

function Passed({ passed }: { passed: boolean | null }) {
  if (passed == null) return <span className="text-xs text-muted-foreground">Pending</span>;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        passed ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
      )}
    >
      {passed ? "Passed" : "Failed"}
    </span>
  );
}

export function ResultsTable({ attempts, totalPoints }: { attempts: AttemptSummary[]; totalPoints: number }) {
  if (!attempts.length) {
    return (
      <EmptyState icon={ClipboardList} title="No finished attempts yet">
        Submitted and ended attempts appear here with scores and integrity ratings.
      </EmptyState>
    );
  }
  const rows = [...attempts].sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));
  return (
    <>
      {/* desktop table */}
      <div className="hidden overflow-hidden rounded-[28px] border border-border/70 bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left">
              {["Candidate", "Status", "Score", "Result", "Integrity", "Submitted", ""].map((h) => (
                <th key={h} className="eyebrow px-5 py-3.5 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((a) => (
              <tr key={a.id} className="transition-colors hover:bg-muted/40">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={a.candidate_name} size={34} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.candidate_name ?? "Candidate"}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.candidate_email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <StatusPill status={a.status} />
                </td>
                <td className="px-5 py-3.5">
                  <Score a={a} totalPoints={totalPoints} />
                </td>
                <td className="px-5 py-3.5">
                  <Passed passed={a.passed} />
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <RiskBadge score={a.risk_score} compact />
                    <span className="tabular text-xs text-muted-foreground">
                      {a.violation_count} flag{a.violation_count === 1 ? "" : "s"}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">{formatDate(a.submitted_at)}</td>
                <td className="px-5 py-3.5 text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/proctor/attempts/${a.id}`}>Review</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* mobile cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map((a) => (
          <li key={a.id}>
            <Link
              href={`/proctor/attempts/${a.id}`}
              className="block rounded-[24px] border border-border/70 bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-3">
                <Avatar name={a.candidate_name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.candidate_name ?? "Candidate"}</p>
                  <p className="truncate text-xs text-muted-foreground">{formatDate(a.submitted_at)}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusPill status={a.status} />
                <Passed passed={a.passed} />
                <RiskBadge score={a.risk_score} compact />
                <span className="tabular ml-auto font-semibold">
                  {a.score ?? "—"}/{a.max_score ?? totalPoints}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
