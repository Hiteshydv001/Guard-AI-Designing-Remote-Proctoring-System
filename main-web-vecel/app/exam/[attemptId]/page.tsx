"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, Clock, Loader2, Maximize, Radio, Send, ShieldCheck, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { ApiError, formatDuration, useApi } from "@/lib/api";
import type { AnswerValue, AttemptDetail, AttemptSummary, FrameResponse, LiveAnalysis, Severity } from "@/lib/types";
import { FullPageError, FullPageSpinner, RoleGate } from "@/components/app/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SystemCheck } from "@/components/exam/system-check";
import { QuestionCard, QuestionNavigator, isAnswered } from "@/components/exam/question-panel";
import { DoneScreen } from "@/components/exam/done-screen";
import { AudioMeter, captureJpeg, enterFullscreen, openMedia, sleep } from "@/components/exam/media";
import { cn } from "@/lib/utils";
import { LiveBroadcaster, type BroadcastState } from "@/lib/live-rtc";

type Phase = "check" | "exam" | "done";

const AUTOSAVE_MS = 3000;
const DEDUPE_MS = 5000;

export default function ExamPage() {
  return (
    <RoleGate role="candidate">
      <ExamRoom />
    </RoleGate>
  );
}

function ExamRoom() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const api = useApi();
  const router = useRouter();

  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("check");
  const [result, setResult] = useState<AttemptSummary | null>(null);

  // media
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<AudioMeter | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [hasAudio, setHasAudio] = useState(false);

  // exam
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [current, setCurrent] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [remaining, setRemaining] = useState(0);
  const [analysis, setAnalysis] = useState<LiveAnalysis | null>(null);
  const [flags, setFlags] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [proctorMsg, setProctorMsg] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<BroadcastState>("idle");
  const broadcasterRef = useRef<LiveBroadcaster | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const phaseRef = useRef<Phase>("check");
  const answersRef = useRef(answers);
  const dirtyRef = useRef(false);
  const finishingRef = useRef(false);
  const lastReport = useRef<Record<string, number>>({});
  answersRef.current = answers;
  phaseRef.current = phase;

  /* ------------------------------------------------------------------ load */
  useEffect(() => {
    api<AttemptDetail>(`/api/attempts/${attemptId}`)
      .then((d) => {
        setDetail(d);
        setAnswers(d.answers ?? {});
        setRemaining(d.attempt.remaining_seconds);
        if (d.attempt.status !== "in_progress") {
          setResult(d.attempt);
          setPhase("done");
        }
      })
      .catch((e) => setLoadError((e as Error).message));
  }, [api, attemptId]);

  /* ------------------------------------------------------------------ media */
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => undefined);
    }
  }, []);

  const stopMedia = useCallback(() => {
    broadcasterRef.current?.stop();
    broadcasterRef.current = null;
    meterRef.current?.close();
    meterRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const wantMedia = !!detail && detail.attempt.status === "in_progress";
  const wantAudio = !!detail?.exam.settings.detect_audio;
  useEffect(() => {
    if (!wantMedia) return;
    let cancelled = false;
    openMedia(wantAudio)
      .then(({ stream, audio }) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        setHasAudio(audio);
        if (audio) meterRef.current = new AudioMeter(stream);
        attachVideo(videoRef.current);
        setMediaReady(true);
        stream.getVideoTracks()[0]?.addEventListener("ended", () => report("camera_lost", "high", "Camera was disconnected"));
      })
      .catch(() =>
        setMediaError("Camera access was blocked. Allow camera access from the address bar, then reload this page.")
      );
    return () => {
      cancelled = true;
    };
    // report is stable enough via refs; re-running would reopen the camera
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantMedia, wantAudio, attachVideo]);

  useEffect(() => stopMedia, [stopMedia]);

  /* ------------------------------------------------------------------ finish */
  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    phaseRef.current = "done";
    setSubmitting(true);
    try {
      // One last frame and audio summary: the server checks them before closing the attempt.
      const finalImage = captureJpeg(videoRef.current);
      const sound = meterRef.current?.read();
      setResult(
        await api<AttemptSummary>(`/api/attempts/${attemptId}/submit`, {
          method: "POST",
          json: {
            answers: answersRef.current,
            final_image: finalImage,
            audio_level: sound?.level ?? 0,
            voice: sound ? sound.voice : null,
          },
        })
      );
    } catch {
      const d = await api<AttemptDetail>(`/api/attempts/${attemptId}`).catch(() => null);
      if (d) setResult(d.attempt);
    }
    stopMedia();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    setConfirmSubmit(false);
    setPhase("done");
  }, [api, attemptId, stopMedia]);

  /* ------------------------------------------------------------------ violations from the browser */
  const report = useCallback(
    (type: string, severity: Severity, message: string) => {
      if (phaseRef.current !== "exam") return;
      const now = Date.now();
      if (now - (lastReport.current[type] ?? 0) < DEDUPE_MS) return;
      lastReport.current[type] = now;
      setFlags((n) => n + 1);
      toast.warning(message, { description: "Recorded for your proctor." });
      api<{ status: string }>(`/api/attempts/${attemptId}/violations`, { method: "POST", json: { type, severity, message } })
        .then((r) => {
          if (r.status !== "in_progress") finish();
        })
        .catch(() => undefined);
    },
    [api, attemptId, finish]
  );

  async function begin({ extendedDisplay }: { extendedDisplay: boolean }) {
    if (!detail) return;
    // Questions are withheld by the server until the face check passes; fetch them now.
    try {
      const fresh = await api<AttemptDetail>(`/api/attempts/${attemptId}`);
      if (!fresh.identity_ok) {
        toast.error("Your identity hasn't been verified yet.");
        return;
      }
      setDetail(fresh);
      setRemaining(fresh.attempt.remaining_seconds);
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    if (detail.exam.settings.require_fullscreen) await enterFullscreen();
    meterRef.current?.resume();
    phaseRef.current = "exam";
    setPhase("exam");
    if (extendedDisplay) setTimeout(() => report("multiple_displays", "medium", "More than one display is connected"), 0);
  }

  /* ------------------------------------------------------------------ proctoring loop (server-side AI) */
  useEffect(() => {
    if (phase !== "exam") return;
    let stopped = false;
    (async () => {
      let failures = 0;
      let wait = detail?.ml.frame_interval_ms ?? 1500;
      while (!stopped && phaseRef.current === "exam") {
        const started = performance.now();
        const image = captureJpeg(videoRef.current);
        if (!image) {
          await sleep(500);
          continue;
        }
        try {
          const r = await api<FrameResponse>(`/api/attempts/${attemptId}/frames`, {
            method: "POST",
            json: (() => {
              const sound = meterRef.current?.read();
              return { image, audio_level: sound?.level ?? 0, voice: sound ? sound.voice : null };
            })(),
          });
          if (stopped) return;
          failures = 0;
          setReconnecting(false);
          setLatency(Math.round(performance.now() - started));
          setRemaining(r.remaining_seconds);
          if (r.analysis) setAnalysis(r.analysis);
          for (const ev of r.events ?? []) {
            setFlags((n) => n + 1);
            toast.warning(ev.message, { description: "Recorded for your proctor." });
          }
          if (r.messages.length) setProctorMsg(r.messages.map((m) => m.body).join("\n\n"));
          // Proctor asked to watch live (or stopped): stream the camera peer to peer, or hang up.
          if (r.live || broadcasterRef.current) {
            broadcasterRef.current ??= new LiveBroadcaster(api, attemptId, () => streamRef.current, setLiveState);
            void broadcasterRef.current.handle(r.live ?? null);
          }
          if (r.status !== "in_progress") {
            finish();
            return;
          }
          wait = r.next_frame_ms;
        } catch (e) {
          if (e instanceof ApiError && (e.status === 404 || e.status === 409)) {
            finish();
            return;
          }
          failures++;
          if (failures >= 3) setReconnecting(true);
          wait = Math.min(10000, 1500 * 2 ** Math.min(failures, 3));
        }
        await sleep(Math.max(250, wait - (performance.now() - started)));
      }
    })();
    return () => {
      stopped = true;
    };
  }, [phase, api, attemptId, detail, finish]);

  /* ------------------------------------------------------------------ timer + autosave */
  useEffect(() => {
    if (phase !== "exam") return;
    const tick = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    const save = setInterval(async () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      try {
        await api(`/api/attempts/${attemptId}/answers`, { method: "PUT", json: { answers: answersRef.current } });
      } catch (e) {
        dirtyRef.current = true;
        if (e instanceof ApiError && e.status === 409) finish();
      }
    }, AUTOSAVE_MS);
    return () => {
      clearInterval(tick);
      clearInterval(save);
    };
  }, [phase, api, attemptId, finish]);

  useEffect(() => {
    if (phase === "exam" && remaining <= 0) finish();
  }, [phase, remaining, finish]);

  /* ------------------------------------------------------------------ lockdown */
  useEffect(() => {
    if (phase !== "exam" || !detail) return;
    const s = detail.exam.settings;
    const onVisibility = () => document.hidden && report("tab_switch", "medium", "Switched to another tab or app");
    const onBlur = () =>
      setTimeout(() => {
        if (!document.hidden && !document.hasFocus()) report("window_blur", "low", "The exam window lost focus");
      }, 400);
    const onFs = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs && s.require_fullscreen) report("fullscreen_exit", "medium", "Exited fullscreen mode");
    };
    const block = (e: Event) => {
      e.preventDefault();
      report("copy_paste", "low", `Tried to ${e.type} — not allowed during the exam`);
    };
    const noMenu = (e: Event) => e.preventDefault();
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    document.addEventListener("contextmenu", noMenu);
    window.addEventListener("beforeunload", beforeUnload);
    setIsFullscreen(!!document.fullscreenElement || !s.require_fullscreen);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("contextmenu", noMenu);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [phase, detail, report]);

  const setAnswer = (qid: string, v: AnswerValue) => {
    dirtyRef.current = true;
    setAnswers((a) => ({ ...a, [qid]: v }));
  };

  /* ------------------------------------------------------------------ render */
  if (loadError) return <FullPageError message={loadError} onRetry={() => router.push("/candidate")} />;
  if (!detail) return <FullPageSpinner label="Preparing your exam…" />;
  if (phase === "done") return <DoneScreen result={result} />;

  if (phase === "check") {
    return (
      <SystemCheck
        detail={detail}
        attemptId={attemptId}
        attachVideo={attachVideo}
        videoRef={videoRef}
        mediaReady={mediaReady}
        mediaError={mediaError}
        hasAudio={hasAudio}
        onStart={begin}
      />
    );
  }

  const questions = detail.questions;
  const q = questions[current];
  const unanswered = questions.filter((x) => !isAnswered(answers[x.id])).length;
  const ok = analysis ? analysis.faces === 1 && !analysis.looking_away : true;
  const s = detail.exam.settings;

  return (
    <div className="ambient min-h-screen select-none">
      {liveState !== "idle" && (
        <div role="status" className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-destructive px-4 py-1.5 text-xs font-medium text-destructive-foreground">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          {liveState === "live" ? "Your proctor is watching your camera live" : "Your proctor is connecting to watch your camera live…"}
        </div>
      )}
      <header className={cn("sticky z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl", liveState !== "idle" ? "top-7" : "top-0")}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <h1 className="hidden min-w-0 truncate font-semibold tracking-tight sm:block">{detail.exam.title}</h1>
          <span className="hidden items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success md:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            AI proctoring{latency !== null && <span className="tabular opacity-70"> · {latency} ms</span>}
          </span>
          {flags > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
              <AlertTriangle className="h-3 w-3" /> {flags}
              <span className="hidden sm:inline">flag{flags === 1 ? "" : "s"}</span>
            </span>
          )}
          <div
            className={cn(
              "tabular ml-auto flex h-10 items-center gap-1.5 rounded-full px-4 font-mono text-[15px] font-medium",
              remaining < 60 ? "bg-destructive text-destructive-foreground" : remaining < 300 ? "bg-warning/15 text-warning" : "bg-card border border-border/70"
            )}
            role="timer"
            aria-label={`${formatDuration(remaining)} remaining`}
          >
            <Clock className="h-4 w-4" />
            {formatDuration(remaining)}
          </div>
          <Button onClick={() => setConfirmSubmit(true)} disabled={submitting}>
            <Send /> <span className="hidden sm:inline">Submit</span>
          </Button>
        </div>
        {reconnecting && (
          <div className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-2 text-xs font-medium text-warning">
            <WifiOff className="h-3.5 w-3.5" /> Connection unstable — reconnecting. Your answers are kept on this device.
          </div>
        )}
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_1fr] lg:py-10">
        <aside className="order-2 lg:order-1">
          <div className="lg:sticky lg:top-24">
            <QuestionNavigator questions={questions} answers={answers} flagged={flagged} current={current} onJump={setCurrent} />
          </div>
        </aside>
        <main className="order-1 lg:order-2">
          {q && (
            <QuestionCard
              question={q}
              index={current}
              total={questions.length}
              value={answers[q.id]}
              flagged={flagged.has(q.id)}
              onChange={(v) => setAnswer(q.id, v)}
              onToggleFlag={() =>
                setFlagged((f) => {
                  const n = new Set(f);
                  if (n.has(q.id)) n.delete(q.id);
                  else n.add(q.id);
                  return n;
                })
              }
              onPrev={() => setCurrent((c) => Math.max(0, c - 1))}
              onNext={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
              onFinish={() => setConfirmSubmit(true)}
            />
          )}
        </main>
      </div>

      {/* Self-view */}
      <div className="fixed bottom-4 right-4 z-40">
        <div className={cn("overflow-hidden rounded-[22px] border-[3px] bg-black shadow-2xl transition-colors", ok ? "border-success" : "border-destructive")}>
          <video ref={attachVideo} muted playsInline className="h-28 w-40 scale-x-[-1] object-cover sm:h-32 sm:w-44" />
        </div>
        {!ok && analysis && (
          <p className="mt-2 rounded-full bg-destructive px-3 py-1 text-center text-xs font-medium text-destructive-foreground">
            {analysis.faces === 0 ? "Face not visible" : analysis.faces > 1 ? "More than one person" : "Look at the screen"}
          </p>
        )}
      </div>

      {s.require_fullscreen && !isFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background/95 p-6 text-center backdrop-blur">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Maximize className="h-7 w-7 text-destructive" />
          </span>
          <h2 className="display text-3xl">
            You left <b>fullscreen</b>
          </h2>
          <p className="max-w-md text-muted-foreground">
            This exam must be taken in fullscreen. The event was recorded and your timer is still running.
          </p>
          <Button size="lg" onClick={enterFullscreen}>
            Return to fullscreen
          </Button>
        </div>
      )}

      <Dialog open={!!proctorMsg} onOpenChange={(o) => !o && setProctorMsg(null)}>
        <DialogContent>
          <DialogHeader>
            <p className="eyebrow text-destructive">Message from your proctor</p>
            <DialogTitle className="flex items-center gap-2 text-xl tracking-tight">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Please read
            </DialogTitle>
            <DialogDescription className="whitespace-pre-wrap pt-2 text-base text-foreground">{proctorMsg}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setProctorMsg(null)}>I understand</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmSubmit} onOpenChange={(o) => !submitting && setConfirmSubmit(o)}>
        <DialogContent>
          <DialogHeader>
            <p className="eyebrow">Submit</p>
            <DialogTitle className="text-xl tracking-tight">Submit your exam?</DialogTitle>
            <DialogDescription>
              {unanswered > 0
                ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} still unanswered. `
                : "Every question has an answer. "}
              You can&apos;t change answers after submitting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setConfirmSubmit(false)} disabled={submitting}>
              Keep working
            </Button>
            <Button onClick={finish} disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Submit exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
