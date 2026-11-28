"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ArrowRight, Check, GraduationCap, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import type { Role } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROLES: { role: Role; tag: string; title: string; text: string; icon: typeof ShieldCheck; points: string[] }[] = [
  {
    role: "proctor",
    tag: "[ 01 ]",
    title: "I run exams",
    text: "Teachers, examiners and institutions.",
    icon: ShieldCheck,
    points: ["Build and schedule exams", "Manage students and batches", "Watch live, review AI evidence"],
  },
  {
    role: "candidate",
    tag: "[ 02 ]",
    title: "I take exams",
    text: "Students and candidates.",
    icon: GraduationCap,
    points: ["See exams assigned to you", "Join with an access code", "Get your results instantly"],
  },
];

export default function OnboardingPage() {
  const api = useApi();
  const router = useRouter();
  const { user } = useUser();
  const [choice, setChoice] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!choice) return;
    setSaving(true);
    try {
      await api("/api/me", {
        method: "PUT",
        json: {
          role: choice,
          name: user?.fullName || user?.username || null,
          email: user?.primaryEmailAddress?.emailAddress ?? null,
        },
      });
      router.replace(choice === "proctor" ? "/proctor" : "/candidate");
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="ambient flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-10 flex items-center gap-2">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-lg" />
          <span className="font-semibold tracking-tight">Guard AI</span>
        </div>
        <p className="eyebrow mb-3">[ setup ]</p>
        <h1 className="display text-4xl leading-[1.05] sm:text-5xl">
          Welcome{user?.firstName ? <>, <b>{user.firstName}</b></> : ""}. <br className="hidden sm:block" />
          How will you <b>use Guard AI?</b>
        </h1>

        <div className="mt-10 grid gap-4 md:grid-cols-2" role="radiogroup" aria-label="Choose your role">
          {ROLES.map(({ role, tag, title, text, icon: Icon, points }) => {
            const on = choice === role;
            return (
              <button
                key={role}
                role="radio"
                aria-checked={on}
                onClick={() => setChoice(role)}
                className={cn(
                  "flex flex-col rounded-[28px] border-2 p-6 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-primary bg-card shadow-[0_12px_40px_-16px_rgba(0,0,0,0.25)]" : "border-border/70 bg-card hover:border-foreground/25"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("flex h-11 w-11 items-center justify-center rounded-full", on ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{tag}</span>
                </div>
                <h2 className="mt-8 text-xl font-semibold tracking-tight">{title}</h2>
                <p className="text-sm text-muted-foreground">{text}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {points.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" /> {p}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">If your teacher created your account, you&apos;re already set up as a student.</p>
          <Button size="lg" disabled={!choice || saving} onClick={save}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Continue <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
