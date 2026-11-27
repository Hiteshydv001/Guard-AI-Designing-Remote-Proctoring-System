"use client";

import { Award, Home } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { RoleGate } from "@/components/app/role-gate";

const NAV = [
  { href: "/candidate", label: "Home", icon: Home, exact: true },
  { href: "/candidate/results", label: "Results", icon: Award },
];

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate role="candidate">
      <AppShell nav={NAV} role="Student">
        {children}
      </AppShell>
    </RoleGate>
  );
}
