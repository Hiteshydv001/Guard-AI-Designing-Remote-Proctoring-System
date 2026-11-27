"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleDot,
  Copy,
  ListChecks,
  Loader2,
  Lock,
  PenLine,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useApi, useQuery } from "@/lib/api";
import type { Batch, ExamFull, ExamSettings, QuestionType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, MonoTag, Section } from "@/components/app/kit";

interface DraftQuestion {
  key: string;
  id?: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  correct: number[];
  points: number;
  explanation: string;
  showExplanation: boolean;
}

const DEFAULT_SETTINGS: ExamSettings = {
  max_violations: 0,
  require_fullscreen: true,
  detect_objects: true,
  detect_audio: true,
  shuffle_questions: false,
  shuffle_options: false,
  show_results: true,
  reveal_answers: false,
  pass_percentage: 40,
  require_assignment: false,
  verify_identity: true,
};

type BoolKey = { [K in keyof ExamSettings]: ExamSettings[K] extends boolean ? K : never }[keyof ExamSettings];

const PROCTORING: { key: BoolKey; label: string; help: string }[] = [
  { key: "verify_identity", label: "Require Face ID", help: "The exam only opens when the face matches the reference photo you registered; re-checked during the exam. Students without a photo wait for your approval." },
  { key: "require_fullscreen", label: "Require fullscreen", help: "Leaving fullscreen or switching tabs is flagged." },
  { key: "detect_objects", label: "Detect phones & books", help: "Server-side object detection on webcam frames." },
  { key: "detect_audio", label: "Monitor audio", help: "Flags talking, voices nearby and loud noise (needs a microphone)." },
];

const DELIVERY: { key: BoolKey; label: string; help: string }[] = [
  { key: "shuffle_questions", label: "Shuffle questions", help: "Each candidate gets a different question order." },
  { key: "shuffle_options", label: "Shuffle options", help: "Answer choices are reordered per candidate." },
  { key: "show_results", label: "Show score after submit", help: "Candidates see their auto-graded score immediately." },
  { key: "reveal_answers", label: "Reveal correct answers", help: "Show the answer key and explanations in the result." },
];

const TYPES: { value: QuestionType; label: string; icon: typeof CircleDot }[] = [
  { value: "single", label: "Single choice", icon: CircleDot },
  { value: "multiple", label: "Multiple choice", icon: ListChecks },
  { value: "text", label: "Written", icon: PenLine },
];

let counter = 0;
const newKey = () => `q${Date.now().toString(36)}${++counter}`;

const blankQuestion = (type: QuestionType = "single"): DraftQuestion => ({
  key: newKey(),
  type,
  prompt: "",
  options: type === "text" ? [] : ["", ""],
  correct: type === "text" ? [] : [0],
  points: type === "text" ? 5 : 1,
  explanation: "",
  showExplanation: false,
});

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ExamBuilder({ initial, locked = false }: { initial?: ExamFull; locked?: boolean }) {
  const api = useApi();
  const router = useRouter();
  const batches = useQuery<Batch[]>("/api/batches");

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [duration, setDuration] = useState(initial?.duration_minutes ?? 30);
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.ends_at ?? null));
  const [settings, setSettings] = useState<ExamSettings>({ ...DEFAULT_SETTINGS, ...initial?.settings });
  const [batchIds, setBatchIds] = useState<string[]>(initial?.batch_ids ?? []);
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    initial?.questions.map((q) => ({
      key: newKey(),
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.type === "text" ? [] : q.options.length ? q.options : ["", ""],
      correct: q.correct ?? [],
      points: q.points,
      explanation: q.explanation ?? "",
      showExplanation: !!q.explanation,
    })) ?? [blankQuestion()]
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalPoints = useMemo(() => questions.reduce((a, q) => a + (Number(q.points) || 0), 0), [questions]);
  const set = <K extends keyof ExamSettings>(k: K, v: ExamSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  const update = (k: string, patch: Partial<DraftQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.key === k ? { ...q, ...patch } : q)));

  const move = (i: number, dir: -1 | 1) =>
    setQuestions((qs) => {
      const j = i + dir;
      if (j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function changeType(q: DraftQuestion, type: QuestionType) {
    if (type === q.type) return;
    if (type === "text") return update(q.key, { type, options: [], correct: [] });
    const options = q.options.length >= 2 ? q.options : ["", ""];
    const correct = type === "single" ? (q.correct.length ? [q.correct[0]] : [0]) : q.correct.length ? q.correct : [0];
    update(q.key, { type, options, correct });
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Give the exam a title";
    if (!questions.length) e.questions = "Add at least one question";
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) e.schedule = "Closing time must be after opening time";
    questions.forEach((q, i) => {
      const n = i + 1;
      if (!q.prompt.trim()) e[q.key] = `Question ${n} needs a prompt`;
      else if (q.type !== "text" && q.options.some((o) => !o.trim())) e[q.key] = `Question ${n} has an empty option`;
      else if (q.type !== "text" && !q.correct.length) e[q.key] = `Mark the correct answer for question ${n}`;
    });
    return e;
  }

  async function save() {
    const e = validate();
    setErrors(e);
    const first = Object.values(e)[0];
    if (first) {
      toast.error(first);
      const firstKey = Object.keys(e)[0];
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    const body = {
      title: title.trim(),
      description,
      duration_minutes: duration,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      settings,
      batch_ids: batchIds,
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt.trim(),
        options: q.type === "text" ? [] : q.options.map((o) => o.trim()),
        correct: q.type === "text" ? [] : q.correct,
        points: Number(q.points) || 0,
        explanation: q.explanation.trim(),
      })),
    };
    try {
      const exam = await api<ExamFull>(initial ? `/api/exams/${initial.id}` : "/api/exams", {
        method: initial ? "PUT" : "POST",
        json: body,
      });
      toast.success(initial ? "Changes saved" : "Exam created", {
        description: initial ? undefined : "It's a draft — publish it when you're ready.",
      });
      router.push(`/proctor/exams/${exam.id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="pb-28">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ------------------------------------------------------------ left: content */}
        <div className="space-y-6">
          <Section title="Details">
            <div className="space-y-5">
              <Field label="Title">
                <Input
                  id="field-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Data Structures — Midterm"
                  aria-invalid={!!errors.title}
                  className={cn(errors.title && "border-destructive")}
                  maxLength={200}
                />
              </Field>
              <Field label="Instructions for candidates" hint="Shown before the exam starts.">
                <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
              </Field>
            </div>
          </Section>

          <div className="flex flex-wrap items-end justify-between gap-3 px-1" id="field-questions">
            <div>
              <p className="eyebrow">Questions</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                {questions.length} question{questions.length === 1 ? "" : "s"}
                <span className="font-normal text-muted-foreground"> · {totalPoints} points</span>
              </h2>
            </div>
            {locked && (
              <p className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Candidates have started — questions can be edited, not added or removed
              </p>
            )}
          </div>

          {questions.map((q, i) => (
            <QuestionCard
              key={q.key}
              q={q}
              index={i}
              total={questions.length}
              locked={locked}
              error={errors[q.key]}
              onChange={(patch) => update(q.key, patch)}
              onType={(t) => changeType(q, t)}
              onMove={(d) => move(i, d)}
              onDuplicate={() =>
                setQuestions((qs) => {
                  const next = [...qs];
                  next.splice(i + 1, 0, { ...q, key: newKey(), id: undefined });
                  return next;
                })
              }
              onDelete={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
            />
          ))}

          {!locked && (
            <div className="grid gap-2 sm:grid-cols-3">
              {TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setQuestions((qs) => [...qs, blankQuestion(t.value)])}
                    className="flex h-14 items-center justify-center gap-2 rounded-[20px] border border-dashed border-border bg-card/50 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus className="h-4 w-4" />
                    <Icon className="h-4 w-4" /> {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------ right: settings */}
        <div className="space-y-6 xl:sticky xl:top-10 xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto xl:pb-4 hairline-scroll">
          <Section title="Schedule">
            <div className="space-y-4" id="field-schedule">
              <Field label="Duration (minutes)">
                <Input
                  type="number"
                  min={1}
                  max={600}
                  value={duration}
                  onChange={(e) => setDuration(Math.min(600, Math.max(1, Number(e.target.value) || 1)))}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <Field label="Opens at" hint="Optional">
                  <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </Field>
                <Field label="Closes at" hint="Optional — attempts end at this time">
                  <Input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className={cn(errors.schedule && "border-destructive")}
                  />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Access" description="Who can take this exam">
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Assign to batches</p>
                {batches.loading && !batches.data ? (
                  <div className="h-8 w-40 animate-pulse rounded-full bg-muted" />
                ) : batches.data && batches.data.length ? (
                  <div className="flex flex-wrap gap-2">
                    {batches.data.map((b) => {
                      const on = batchIds.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setBatchIds((ids) => (on ? ids.filter((x) => x !== b.id) : [...ids, b.id]))}
                          className={cn(
                            "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
                          )}
                        >
                          {on && <Check className="h-3.5 w-3.5" />}
                          {b.name}
                          <span className="tabular text-xs opacity-60">{b.member_count}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No batches yet.{" "}
                    <Link href="/proctor/students" className="font-medium text-foreground underline underline-offset-4">
                      Create one
                    </Link>{" "}
                    to assign exams to a class.
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Assigned students see the exam on their dashboard — no code needed.
                </p>
              </div>
              <ToggleRow
                label="Only assigned students"
                help={
                  <>
                    Off: anyone with the access code{initial ? <> <MonoTag>{initial.access_code}</MonoTag></> : ""} can join.
                  </>
                }
                checked={settings.require_assignment}
                onChange={(v) => set("require_assignment", v)}
              />
            </div>
          </Section>

          <Section title="AI proctoring" description="Runs on the Guard AI server">
            <div className="space-y-1">
              {PROCTORING.map((s) => (
                <ToggleRow key={s.key} label={s.label} help={s.help} checked={settings[s.key]} onChange={(v) => set(s.key, v)} />
              ))}
              <div className="flex items-center justify-between gap-4 pt-3">
                <div>
                  <p className="text-sm font-medium">Auto-end after</p>
                  <p className="text-xs text-muted-foreground">Violations before the attempt ends. 0 = never.</p>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={1000}
                  className="w-24 text-center"
                  aria-label="Auto-end after N violations"
                  value={settings.max_violations}
                  onChange={(e) => set("max_violations", Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
                />
              </div>
            </div>
          </Section>

          <Section title="Delivery & results">
            <div className="space-y-1">
              {DELIVERY.map((s) => (
                <ToggleRow
                  key={s.key}
                  label={s.label}
                  help={s.help}
                  checked={settings[s.key]}
                  disabled={s.key === "reveal_answers" && !settings.show_results}
                  onChange={(v) => set(s.key, v)}
                />
              ))}
              <div className="flex items-center justify-between gap-4 pt-3">
                <div>
                  <p className="text-sm font-medium">Pass mark</p>
                  <p className="text-xs text-muted-foreground">Percentage needed to pass.</p>
                </div>
                <div className="relative w-24">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="pr-8 text-center"
                    aria-label="Pass percentage"
                    value={settings.pass_percentage}
                    onChange={(e) => set("pass_percentage", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* sticky save bar */}
      <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4 lg:bottom-6 lg:left-[264px]">
        <div className="flex w-full max-w-xl items-center gap-3 rounded-full border border-border/70 bg-card/95 p-2 pl-5 shadow-2xl backdrop-blur-xl">
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{questions.length}</span> question{questions.length === 1 ? "" : "s"} ·{" "}
            <span className="font-medium text-foreground">{totalPoints}</span> pts · {duration} min
          </p>
          <Button variant="ghost" onClick={() => router.back()} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {initial ? "Save changes" : "Create exam"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  help,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  help: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-start justify-between gap-4 rounded-2xl py-2.5", disabled && "opacity-50")}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{help}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="mt-0.5" />
    </label>
  );
}

function QuestionCard({
  q,
  index,
  total,
  locked,
  error,
  onChange,
  onType,
  onMove,
  onDuplicate,
  onDelete,
}: {
  q: DraftQuestion;
  index: number;
  total: number;
  locked: boolean;
  error?: string;
  onChange: (patch: Partial<DraftQuestion>) => void;
  onType: (t: QuestionType) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      id={`field-${q.key}`}
      className={cn("rounded-[28px] border bg-card p-5 sm:p-6", error ? "border-destructive/60" : "border-border/70")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2 font-mono text-xs text-primary-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex rounded-full border border-border/70 p-0.5" role="radiogroup" aria-label="Question type">
          {TYPES.map((t) => {
            const Icon = t.icon;
            const on = q.type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onType(t.value)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <label className="mr-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            Points
            <Input
              type="number"
              min={0}
              max={1000}
              step="0.5"
              className="h-8 w-16 rounded-full px-2 text-center text-sm"
              value={q.points}
              onChange={(e) => onChange({ points: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
          <Button variant="ghost" size="icon-sm" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up">
            <ArrowUp />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move down">
            <ArrowDown />
          </Button>
          {!locked && (
            <>
              <Button variant="ghost" size="icon-sm" onClick={onDuplicate} aria-label="Duplicate question">
                <Copy />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={onDelete} disabled={total === 1} aria-label="Delete question">
                <Trash2 className="text-destructive" />
              </Button>
            </>
          )}
        </div>
      </div>

      <Textarea
        rows={2}
        className="mt-4 text-[15px]"
        placeholder="Write the question…"
        value={q.prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
        aria-label={`Question ${index + 1} prompt`}
      />

      {q.type !== "text" ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            {q.type === "single" ? "Click the circle next to the correct answer" : "Tick every correct answer"}
          </p>
          {q.options.map((opt, oi) => {
            const isCorrect = q.correct.includes(oi);
            return (
              <div key={oi} className="flex items-center gap-2">
                <button
                  type="button"
                  role={q.type === "single" ? "radio" : "checkbox"}
                  aria-checked={isCorrect}
                  aria-label={`Mark option ${oi + 1} correct`}
                  onClick={() =>
                    onChange({
                      correct:
                        q.type === "single"
                          ? [oi]
                          : isCorrect
                            ? q.correct.filter((c) => c !== oi)
                            : [...q.correct, oi].sort((a, b) => a - b),
                    })
                  }
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    q.type === "single" ? "rounded-full" : "rounded-lg",
                    isCorrect ? "border-success bg-success text-white" : "border-border hover:border-foreground/40"
                  )}
                >
                  {isCorrect && <Check className="h-4 w-4" />}
                </button>
                <Input
                  value={opt}
                  placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                  className={cn("h-10", isCorrect && "border-success/60 bg-success/5")}
                  onChange={(e) => onChange({ options: q.options.map((o, x) => (x === oi ? e.target.value : o)) })}
                  aria-label={`Option ${oi + 1}`}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={q.options.length <= 2}
                  onClick={() =>
                    onChange({
                      options: q.options.filter((_, x) => x !== oi),
                      correct: q.correct.filter((c) => c !== oi).map((c) => (c > oi ? c - 1 : c)),
                    })
                  }
                  aria-label={`Remove option ${oi + 1}`}
                >
                  <X />
                </Button>
              </div>
            );
          })}
          {q.options.length < 12 && (
            <Button variant="ghost" size="sm" onClick={() => onChange({ options: [...q.options, ""] })}>
              <Plus /> Add option
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-2xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
          Candidates type a free-text answer. You grade it from the attempt review page.
        </p>
      )}

      <div className="mt-4 border-t border-border/60 pt-3">
        {q.showExplanation ? (
          <Textarea
            rows={2}
            placeholder="Explanation shown with the answer key (optional)"
            value={q.explanation}
            onChange={(e) => onChange({ explanation: e.target.value })}
            aria-label="Explanation"
          />
        ) : (
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => onChange({ showExplanation: true })}
          >
            + Add explanation
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
