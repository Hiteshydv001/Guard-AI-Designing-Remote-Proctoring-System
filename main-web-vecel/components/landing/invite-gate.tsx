"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarX2, Link2Off, Loader2, MailX, UserCheck } from "lucide-react";
import { API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";

type TicketStatus = "pending" | "accepted" | "revoked" | "expired" | "invalid" | "unknown";
type TicketInfo = { status: TicketStatus; email?: string; teacher?: string };

const COPY: Record<
  Exclude<TicketStatus, "pending" | "unknown">,
  { tag: string; icon: typeof MailX; title: string; text: (i: TicketInfo) => React.ReactNode; signIn?: boolean }
> = {
  revoked: {
    tag: "[ invitation withdrawn ]",
    icon: MailX,
    title: "This invitation is no longer active",
    text: (i) => (
      <>
        {i.teacher ? <b className="text-foreground">{i.teacher}</b> : "Your teacher"} withdrew the invitation for{" "}
        <b className="text-foreground">{i.email}</b>. If you think this is a mistake, ask them to send you a new one.
      </>
    ),
  },
  accepted: {
    tag: "[ already accepted ]",
    icon: UserCheck,
    title: "You've already used this invitation",
    text: (i) => (
      <>
        An account for <b className="text-foreground">{i.email}</b> already exists. Sign in with it to see your exams.
      </>
    ),
    signIn: true,
  },
  expired: {
    tag: "[ link expired ]",
    icon: CalendarX2,
    title: "This invitation has expired",
    text: (i) => (
      <>
        Invitations are valid for 30 days. Ask {i.teacher ? <b className="text-foreground">{i.teacher}</b> : "your teacher"} to send a
        new one to <b className="text-foreground">{i.email}</b>.
      </>
    ),
  },
  invalid: {
    tag: "[ invalid link ]",
    icon: Link2Off,
    title: "This invitation link isn't valid",
    text: () => <>The link may be incomplete. Open it again from your invitation email, or ask your teacher to send a new one.</>,
  },
};

/** Checks a Clerk invitation ticket with our API and explains dead links instead of letting Clerk fail on them. */
export function InviteGate({ children }: { children: React.ReactNode }) {
  const ticket = useSearchParams().get("__clerk_ticket");
  const [info, setInfo] = useState<TicketInfo | null>(null);

  useEffect(() => {
    if (!ticket) return;
    let alive = true;
    fetch(`${API_URL}/api/invites/ticket?ticket=${encodeURIComponent(ticket)}`)
      .then((r) => (r.ok ? r.json() : { status: "unknown" }))
      .catch(() => ({ status: "unknown" })) // API unreachable: let Clerk decide
      .then((data: TicketInfo) => alive && setInfo(data));
    return () => {
      alive = false;
    };
  }, [ticket]);

  if (!ticket) return <>{children}</>;
  if (!info) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking your invitation…
      </div>
    );
  }
  if (info.status === "pending" || info.status === "unknown") return <>{children}</>;

  const { tag, icon: Icon, title, text, signIn } = COPY[info.status];
  return (
    <div className="w-full max-w-[420px] rounded-[28px] border border-border/70 bg-card p-8 shadow-[0_24px_60px_-28px_rgba(23,19,17,0.35)]">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5" />
      </span>
      <p className="eyebrow mt-6">{tag}</p>
      <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text(info)}</p>
      <div className="mt-7 flex flex-wrap gap-2">
        {signIn ? (
          <Button asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/">Go to homepage</Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href={signIn ? "/" : "/sign-in"}>{signIn ? "Homepage" : "I have an account"}</Link>
        </Button>
      </div>
    </div>
  );
}
