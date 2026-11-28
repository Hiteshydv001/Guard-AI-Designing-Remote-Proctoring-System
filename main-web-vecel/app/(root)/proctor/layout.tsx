"use client";

import { FileText, LayoutGrid, Sparkles, Users } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { RoleGate } from "@/components/app/role-gate";
import { useQuery } from "@/lib/api";
import type { MLStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/proctor", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/proctor/exams", label: "Exams", icon: FileText },
  { href: "/proctor/students", label: "Students", icon: Users },
  { href: "/proctor/assistant", label: "Assistant", icon: Sparkles },
];

function EngineStatus() {
  const { data } = useQuery<{ ml: MLStatus }>("/health", { refreshMs: 20000 });
  const ml = data?.ml;
  const ok = ml?.ready;
  return (
    <div className="mt-3 rounded-[20px] border border-border/70 p-3.5">
      <p className="eyebrow mb-2">AI engine</p>
      <div className="flex items-center gap-2 text-sm">
        <span className={cn("h-2 w-2 rounded-full", ok ? "bg-success" : ml ? "bg-warning" : "bg-muted-foreground")} />
        <span className="font-medium">{ok ? "Online" : ml ? "Starting…" : "Checking…"}</span>
        {ok && <span className="ml-auto text-xs text-muted-foreground tabular">{Math.round(ml!.avg_inference_ms)} ms</span>}
      </div>
      {ok && (
        <p className="mt-1 text-xs text-muted-foreground">
          {ml!.active_streams} live stream{ml!.active_streams === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

export default function ProctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate role="proctor">
      <AppShell nav={NAV} role="Proctor" footer={<EngineStatus />}>
        {children}
      </AppShell>
    </RoleGate>
  );
}
