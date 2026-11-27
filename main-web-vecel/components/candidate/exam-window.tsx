import { CalendarClock } from "lucide-react";
import { formatDate } from "@/lib/api";

/** "Opens … · Closes …" line; renders nothing for always-open exams. */
export function ExamWindow({ startsAt, endsAt }: { startsAt: string | null; endsAt: string | null }) {
  if (!startsAt && !endsAt) return null;
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <CalendarClock className="h-4 w-4 shrink-0" />
      <span>
        {startsAt && <>Opens {formatDate(startsAt)}</>}
        {startsAt && endsAt && " · "}
        {endsAt && <>Closes {formatDate(endsAt)}</>}
      </span>
    </p>
  );
}

export function timeChip(iso: string | null): { top: string; bottom: string } {
  if (!iso) return { top: "Any", bottom: "time" };
  const d = new Date(iso);
  return {
    top: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    bottom: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
  };
}
