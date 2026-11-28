"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, RotateCcw, Sparkles, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { useApi, useQuery } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/kit";
import { useProfile } from "@/components/app/role-gate";
import { Markdown } from "@/components/assistant/markdown";
import { ConfirmCard, ExamCard, StudentsCard, type AssistantCard } from "@/components/assistant/cards";
import { cn } from "@/lib/utils";

/** OpenAI-format message, exactly what the API takes back each turn. */
type ApiMessage = { role: "user" | "assistant" | "tool"; content: string; tool_calls?: unknown[]; tool_call_id?: string };
type Step = { tool: string; ok: boolean };
type Item = { id: string; role: "user" | "assistant"; text: string; steps?: Step[]; cards?: AssistantCard[]; error?: boolean };
type ChatOut = { messages: ApiMessage[]; cards: AssistantCard[]; steps: Step[] };
type DecideOut = { ok: boolean; cancelled: boolean; note: string; card: AssistantCard | null };

const STEP_LABEL: Record<string, string> = {
  get_overview: "Checked your dashboard",
  list_exams: "Looked up exams",
  get_exam: "Read the exam",
  exam_results: "Pulled results",
  list_students: "Looked up students",
  list_batches: "Looked up batches",
  list_invites: "Checked invitations",
  create_exam: "Created a draft exam",
  update_exam: "Updated the exam",
  set_exam_status: "Prepared status change",
  delete_exam: "Prepared deletion",
  add_students: "Prepared students",
  create_batch: "Created a batch",
  add_to_batch: "Updated batch members",
  revoke_invite: "Prepared withdrawal",
};

const SUGGESTIONS = [
  { tag: "[ create ]", text: "Make a 10-question quiz on photosynthesis for Class 9, 20 minutes, opening tomorrow at 10am" },
  { tag: "[ invite ]", text: "Invite riya@school.edu (Riya Shah) and arjun@school.edu (Arjun Rao) to CS-A" },
  { tag: "[ results ]", text: "How did students do in my latest exam? Who was flagged?" },
  { tag: "[ organise ]", text: "Create a batch called CS-B and add 5 harder questions to my draft exam" },
];

const STORE_KEY = "guardai-assistant-v1";
const uid = () => Math.random().toString(36).slice(2, 10);
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** Persist the chat for this tab only, never with passwords. */
function save(history: ApiMessage[], items: Item[]) {
  try {
    const safeItems = items.map((it) => ({
      ...it,
      cards: it.cards?.map((c) => (c.type === "students" ? { ...c, results: c.results.map(({ password: _p, ...r }) => r) } : c)),
    }));
    sessionStorage.setItem(STORE_KEY, JSON.stringify({ history, items: safeItems }));
  } catch {
    /* storage unavailable */
  }
}

function load(): { history: ApiMessage[]; items: Item[] } {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { history: [], items: [] };
}

function Thinking() {
  return (
    <div className="flex items-center gap-3 pl-1 text-sm text-muted-foreground">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </span>
      Working on it…
    </div>
  );
}

export default function AssistantPage() {
  const api = useApi();
  const profile = useProfile();
  const { data: status } = useQuery<{ enabled: boolean; model: string }>("/api/assistant/status");
  const [history, setHistory] = useState<ApiMessage[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = load();
    setHistory(saved.history);
    setItems(saved.items);
  }, []);

  useEffect(() => {
    save(history, items);
  }, [history, items]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length, busy]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;
      const nextHistory: ApiMessage[] = [...history, { role: "user", content }];
      setItems((xs) => [...xs, { id: uid(), role: "user", text: content }]);
      setHistory(nextHistory);
      setInput("");
      setBusy(true);
      try {
        const out = await api<ChatOut>("/api/assistant/chat", { method: "POST", json: { messages: nextHistory, timezone: tz() } });
        setHistory([...nextHistory, ...out.messages]);
        const reply = out.messages
          .filter((m) => m.role === "assistant" && m.content.trim())
          .map((m) => m.content.trim())
          .join("\n\n");
        setItems((xs) => [...xs, { id: uid(), role: "assistant", text: reply, steps: out.steps, cards: out.cards }]);
      } catch (e) {
        // Drop the unanswered turn from the model's history so a retry starts clean.
        setHistory(history);
        setItems((xs) => [...xs, { id: uid(), role: "assistant", text: (e as Error).message, error: true }]);
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [api, busy, history]
  );

  const decide = useCallback(
    async (itemId: string, cardId: string, decision: "confirm" | "cancel") => {
      const patch = (fn: (c: Extract<AssistantCard, { type: "confirm" }>) => AssistantCard, extra?: AssistantCard | null) =>
        setItems((xs) =>
          xs.map((it) =>
            it.id !== itemId
              ? it
              : {
                  ...it,
                  cards: [
                    ...(it.cards ?? []).map((c) => (c.type === "confirm" && c.id === cardId ? fn(c) : c)),
                    ...(extra ? [extra] : []),
                  ],
                }
          )
        );
      patch((c) => ({ ...c, state: "working" }));
      try {
        const out = await api<DecideOut>(`/api/assistant/actions/${cardId}`, { method: "POST", json: { decision, timezone: tz() } });
        patch((c) => ({ ...c, state: out.cancelled ? "cancelled" : "confirmed" }), out.card);
        setHistory((h) => [...h, { role: "user", content: out.note }]);
        if (!out.cancelled) toast.success("Done");
      } catch (e) {
        const message = (e as Error).message;
        patch((c) => ({ ...c, state: "failed", error: message }));
        setHistory((h) => [...h, { role: "user", content: `[The teacher tried to confirm, but it failed: ${message}]` }]);
      }
    },
    [api]
  );

  function reset() {
    setHistory([]);
    setItems([]);
    inputRef.current?.focus();
  }

  const disabled = status && !status.enabled;
  const first = profile?.name?.split(" ")[0];

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col lg:min-h-[calc(100vh-5.5rem)]">
      <PageHeader
        eyebrow="[ assistant ]"
        title={
          <>
            Ask, and it&apos;s <b>done.</b>
          </>
        }
        description="Create exams, invite students, publish and check results by chatting. Anything that emails people, publishes or deletes waits for your approval."
        actions={
          items.length > 0 && (
            <Button variant="outline" onClick={reset} disabled={busy}>
              <RotateCcw /> New chat
            </Button>
          )
        }
      />

      {disabled && (
        <div className="mb-6 flex items-start gap-3 rounded-3xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            The assistant isn&apos;t set up on the server yet. Add <code className="font-mono">GROQ_API_KEY</code> to the backend environment and
            restart it.
          </p>
        </div>
      )}

      <div className="flex-1 space-y-6">
        {items.length === 0 ? (
          <div className="grainient relative overflow-hidden rounded-[32px] p-6 text-white sm:p-8">
            <div className="relative z-10">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur">
                <Sparkles className="h-5 w-5" />
              </span>
              <h2 className="mt-5 max-w-xl text-2xl font-medium leading-tight tracking-tight sm:text-3xl">
                {first ? `Hi ${first}, what` : "What"} should we set up today?
              </h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.tag}
                    type="button"
                    disabled={busy || !!disabled}
                    onClick={() => send(s.text)}
                    className="rounded-[22px] border border-white/35 bg-white/15 p-4 text-left text-sm backdrop-blur-md transition hover:bg-white/25 disabled:opacity-60"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/75">{s.tag}</span>
                    <span className="mt-1.5 block leading-snug">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          items.map((it) =>
            it.role === "user" ? (
              <div key={it.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-[22px] rounded-br-md bg-foreground px-4 py-2.5 text-[15px] text-background">{it.text}</p>
              </div>
            ) : (
              <div key={it.id} className="flex gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    it.error ? "bg-destructive/10 text-destructive" : "bg-foreground text-background"
                  )}
                >
                  {it.error ? <TriangleAlert className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  {it.steps && it.steps.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {it.steps.map((s, i) => (
                        <span
                          key={i}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
                            s.ok ? "bg-muted text-muted-foreground" : "bg-destructive/10 text-destructive"
                          )}
                        >
                          {s.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          {STEP_LABEL[s.tool] ?? s.tool}
                        </span>
                      ))}
                    </div>
                  )}
                  {it.text && (
                    <div className={cn("max-w-[72ch]", it.error && "text-destructive")}>
                      <Markdown text={it.text} />
                    </div>
                  )}
                  {it.cards?.map((c, i) =>
                    c.type === "exam" ? (
                      <ExamCard key={i} exam={c.exam} />
                    ) : c.type === "students" ? (
                      <StudentsCard key={i} mode={c.mode} results={c.results} />
                    ) : (
                      <ConfirmCard key={c.id} card={c} onDecide={(d) => decide(it.id, c.id, d)} />
                    )
                  )}
                </div>
              </div>
            )
          )
        )}
        {busy && <Thinking />}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-24 z-20 mt-8 lg:bottom-6"
      >
        <div className="flex items-end gap-2 rounded-[28px] border border-border/70 bg-card/95 p-2 pl-5 shadow-[0_18px_50px_-24px_rgba(23,19,17,0.35)] backdrop-blur-xl">
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            disabled={!!disabled}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask Guard AI to create an exam, invite students, publish…"
            aria-label="Message the assistant"
            className="max-h-[180px] min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" size="icon-lg" disabled={busy || !input.trim() || !!disabled} aria-label="Send">
            <ArrowUp />
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          AI can make mistakes. Review generated questions before publishing.
        </p>
      </form>
    </div>
  );
}
