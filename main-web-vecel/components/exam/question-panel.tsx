"use client";

import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Send } from "lucide-react";
import type { AnswerValue, CandidateQuestion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MonoTag } from "@/components/app/kit";
import { cn } from "@/lib/utils";

export function isAnswered(v: AnswerValue | undefined): boolean {
  return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim().length > 0;
}

export function QuestionNavigator({
  questions,
  answers,
  flagged,
  current,
  onJump,
}: {
  questions: CandidateQuestion[];
  answers: Record<string, AnswerValue>;
  flagged: Set<string>;
  current: number;
  onJump: (i: number) => void;
}) {
  const answered = questions.filter((q) => isAnswered(answers[q.id])).length;
  return (
    <div className="surface p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="eyebrow">Questions</p>
        <p className="tabular text-sm">
          <b>{answered}</b>
          <span className="text-muted-foreground"> / {questions.length}</span>
        </p>
      </div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
        {questions.map((q, i) => {
          const done = isAnswered(answers[q.id]);
          return (
            <button
              key={q.id}
              onClick={() => onJump(i)}
              aria-label={`Question ${i + 1}${done ? ", answered" : ""}${flagged.has(q.id) ? ", flagged" : ""}`}
              aria-current={i === current ? "true" : undefined}
              className={cn(
                "tabular relative flex h-10 items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                done ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-accent",
                i === current && "ring-2 ring-primary ring-offset-2 ring-offset-card"
              )}
            >
              {i + 1}
              {flagged.has(q.id) && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-card" />}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Answered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted ring-1 ring-border" /> Not yet
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-warning" /> For review
        </span>
      </div>
    </div>
  );
}

export function QuestionCard({
  question,
  index,
  total,
  value,
  flagged,
  onChange,
  onToggleFlag,
  onPrev,
  onNext,
  onFinish,
}: {
  question: CandidateQuestion;
  index: number;
  total: number;
  value: AnswerValue | undefined;
  flagged: boolean;
  onChange: (v: AnswerValue) => void;
  onToggleFlag: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const picked = Array.isArray(value) ? value : [];
  const last = index === total - 1;

  return (
    <div className="space-y-4">
      <article className="surface p-6 sm:p-8">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <MonoTag>
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </MonoTag>
          <span className="text-xs text-muted-foreground">
            {question.points} pt{question.points === 1 ? "" : "s"} ·{" "}
            {question.type === "single" ? "Choose one" : question.type === "multiple" ? "Choose all that apply" : "Written answer"}
          </span>
          <Button variant={flagged ? "secondary" : "ghost"} size="sm" className="ml-auto" onClick={onToggleFlag} aria-pressed={flagged}>
            {flagged ? <BookmarkCheck /> : <Bookmark />}
            {flagged ? "Marked for review" : "Mark for review"}
          </Button>
        </div>

        <h2 className="whitespace-pre-wrap text-xl font-medium leading-relaxed tracking-tight">{question.prompt}</h2>

        {question.type === "text" ? (
          <Textarea
            className="mt-6 min-h-[200px] select-text text-base"
            placeholder="Type your answer…"
            aria-label="Your answer"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <div className="mt-6 space-y-3" role={question.type === "single" ? "radiogroup" : "group"}>
            {question.options.map((opt, i) => {
              const on = picked.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  role={question.type === "single" ? "radio" : "checkbox"}
                  aria-checked={on}
                  onClick={() =>
                    onChange(
                      question.type === "single" ? [opt.id] : on ? picked.filter((p) => p !== opt.id) : [...picked, opt.id].sort((a, b) => a - b)
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-4 rounded-[22px] border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on ? "border-primary bg-primary/[0.03]" : "border-border/70 hover:border-foreground/25"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center font-mono text-xs font-medium transition-colors",
                      question.type === "single" ? "rounded-full" : "rounded-xl",
                      on ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-[15px]">{opt.text}</span>
                </button>
              );
            })}
          </div>
        )}
      </article>

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="lg" onClick={onPrev} disabled={index === 0}>
          <ChevronLeft /> Previous
        </Button>
        {last ? (
          <Button size="lg" onClick={onFinish}>
            Finish <Send />
          </Button>
        ) : (
          <Button size="lg" onClick={onNext}>
            Next <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  );
}
