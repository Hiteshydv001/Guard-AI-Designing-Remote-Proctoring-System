"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Circle,
  Crosshair,
  Loader2,
  Maximize,
  Mic,
  Monitor,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  Sun,
  UserCheck,
  XCircle,
} from "lucide-react";
import { ApiError, useApi } from "@/lib/api";
import type { AttemptDetail, CheckResponse, VerifyResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { MonoTag } from "@/components/app/kit";
import { cn } from "@/lib/utils";
import { captureBurst, captureJpeg, hasExtendedDisplay, sleep } from "./media";

type StepId = "camera" | "identity" | "calibrate" | "rules";
type State = "pending" | "ok" | "fail";

export function SystemCheck({
  detail,
  attemptId,
  attachVideo,
  videoRef,
  mediaError,
  hasAudio,
  mediaReady,
  onStart,
}: {
  detail: AttemptDetail;
  attemptId: string;
  attachVideo: (el: HTMLVideoElement | null) => void;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  mediaError: string | null;
  hasAudio: boolean;
  mediaReady: boolean;
  onStart: (opts: { extendedDisplay: boolean }) => void;
}) {
  const settings = detail.exam.settings;
  const identityDone = ["verified", "approved", "skipped"].includes(detail.attempt.identity?.status ?? "");
  const steps: { id: StepId; label: string }[] = [
    { id: "camera", label: "Camera" },
    ...(detail.identity_required ? [{ id: "identity" as StepId, label: "Identity" }] : []),
    { id: "calibrate", label: "Calibrate" },
    { id: "rules", label: "Start" },
  ];
  const [step, setStep] = useState<StepId>("camera");
  const idx = steps.findIndex((s) => s.id === step);
  const next = () => setStep(steps[Math.min(steps.length - 1, idx + 1)].id);

  return (
    <div className="ambient min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-6 sm:px-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="eyebrow">System check</p>
          <p className="truncate font-semibold tracking-tight">{detail.exam.title}</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[1.25fr_1fr] lg:py-10">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-[32px] border border-border/70 bg-black">
            <video ref={attachVideo} muted playsInline className="aspect-[4/3] w-full scale-x-[-1] object-cover" />
            {!mediaReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
                {mediaError ? <XCircle className="h-8 w-8 text-red-400" /> : <Loader2 className="h-8 w-8 animate-spin" />}
                <p className="max-w-xs text-center text-sm">{mediaError ?? "Waiting for camera permission…"}</p>
              </div>
            )}
            {step === "calibrate" && <CalibrationTarget />}
            <span className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-white backdrop-blur">
              Preview · not recorded
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Frames are analysed on Guard AI&apos;s server during the exam. Video is never stored — only snapshots of flagged
            moments are kept for your proctor.
          </p>
        </div>

        <div className="space-y-5">
          <Stepper steps={steps} current={idx} />
          <div className="surface p-6">
            {step === "camera" && (
              <CameraStep
                attemptId={attemptId}
                videoRef={videoRef}
                mediaReady={mediaReady}
                wantAudio={settings.detect_audio}
                hasAudio={hasAudio}
                onNext={next}
              />
            )}
            {step === "identity" && (
              <IdentityStep attemptId={attemptId} videoRef={videoRef} alreadyDone={identityDone} onNext={next} />
            )}
            {step === "calibrate" && (
              <CalibrateStep attemptId={attemptId} videoRef={videoRef} calibrated={detail.attempt.calibrated} onNext={next} />
            )}
            {step === "rules" && <RulesStep detail={detail} onStart={() => onStart({ extendedDisplay: hasExtendedDisplay() })} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stepper({ steps, current }: { steps: { id: string; label: string }[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s.id} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full px-3 text-xs font-medium",
              i === current && "bg-primary text-primary-foreground",
              i < current && "bg-card text-foreground",
              i > current && "bg-muted text-muted-foreground"
            )}
            aria-current={i === current ? "step" : undefined}
          >
            <span className="font-mono">{i < current ? <Check className="h-3.5 w-3.5" /> : String(i + 1).padStart(2, "0")}</span>
            <span className="truncate">{s.label}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Row({ state, icon: Icon, label, hint }: { state: State; icon: typeof Camera; label: string; hint?: string }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border/70 px-4 py-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {state === "ok" && <CheckCircle2 className="h-5 w-5 text-success" aria-label="Passed" />}
      {state === "fail" && <XCircle className="h-5 w-5 text-destructive" aria-label="Failed" />}
      {state === "pending" && <Circle className="h-5 w-5 animate-pulse text-muted-foreground/40" aria-label="Checking" />}
    </li>
  );
}

function StepTitle({ tag, title, children }: { tag: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <MonoTag>{tag}</MonoTag>
      <h2 className="display mt-3 text-2xl">{title}</h2>
      {children && <p className="mt-1.5 text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ 01 */
function CameraStep({
  attemptId,
  videoRef,
  mediaReady,
  wantAudio,
  hasAudio,
  onNext,
}: {
  attemptId: string;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  mediaReady: boolean;
  wantAudio: boolean;
  hasAudio: boolean;
  onNext: () => void;
}) {
  const api = useApi();
  const [check, setCheck] = useState<CheckResponse | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const extended = typeof window !== "undefined" && hasExtendedDisplay();

  useEffect(() => {
    if (!mediaReady) return;
    let stop = false;
    (async () => {
      while (!stop) {
        const image = captureJpeg(videoRef.current);
        if (image) {
          try {
            setCheck(await api<CheckResponse>(`/api/attempts/${attemptId}/check`, { method: "POST", json: { image } }));
            setEngine(null);
          } catch (e) {
            setEngine(e instanceof ApiError && e.status === 503 ? "The AI engine is starting — retrying…" : (e as Error).message);
          }
        }
        await sleep(1200);
      }
    })();
    return () => {
      stop = true;
    };
  }, [api, attemptId, mediaReady, videoRef]);

  const faceState: State = !check ? "pending" : check.faces === 1 ? "ok" : "fail";
  const lightState: State = !check ? "pending" : check.too_dark ? "fail" : "ok";
  const ready = mediaReady && check?.ok;

  return (
    <>
      <StepTitle tag="[ 01 ]" title={<>Check your <b>camera & room</b></>}>
        Sit facing the screen, alone, with your face well lit.
      </StepTitle>
      <ul className="space-y-2">
        <Row state={mediaReady ? "ok" : "pending"} icon={Camera} label="Camera" />
        {wantAudio && (
          <Row
            state={!mediaReady ? "pending" : hasAudio ? "ok" : "fail"}
            icon={Mic}
            label="Microphone"
            hint={mediaReady && !hasAudio ? "Not available — audio won't be monitored" : undefined}
          />
        )}
        <Row
          state={faceState}
          icon={ScanFace}
          label="Exactly one face visible"
          hint={check && check.faces !== 1 ? (check.faces === 0 ? "We can't see your face" : `${check.faces} faces in view — make sure you're alone`) : undefined}
        />
        <Row state={lightState} icon={Sun} label="Good lighting" hint={check?.too_dark ? "Too dark — turn on a light in front of you" : undefined} />
        <Row
          state={extended ? "fail" : "ok"}
          icon={Monitor}
          label="Single display"
          hint={extended ? "A second screen is connected — this will be flagged" : undefined}
        />
      </ul>
      {engine && <p className="mt-3 text-xs text-muted-foreground">{engine}</p>}
      <Button size="lg" className="mt-6 w-full" disabled={!ready} onClick={onNext}>
        Continue <ArrowRight />
      </Button>
    </>
  );
}

/* ------------------------------------------------------------------------------------------ 02 */
function IdentityStep({
  attemptId,
  videoRef,
  alreadyDone,
  onNext,
}: {
  attemptId: string;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  alreadyDone: boolean;
  onNext: () => void;
}) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const images = await captureBurst(videoRef.current, 3, 300);
      if (!images.length) throw new Error("Camera is not ready yet");
      setResult(await api<VerifyResponse>(`/api/attempts/${attemptId}/verify`, { method: "POST", json: { images } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (alreadyDone && !result) {
    return (
      <>
        <StepTitle tag="[ 02 ]" title={<>Identity <b>already checked</b></>}>
          Your identity check for this attempt is complete.
        </StepTitle>
        <Button size="lg" className="w-full" onClick={onNext}>
          Continue <ArrowRight />
        </Button>
      </>
    );
  }

  const status = result?.status;
  const passed = status === "verified" || status === "approved" || status === "skipped";
  return (
    <>
      <StepTitle tag="[ 02 ]" title={<>Verify it&apos;s <b>really you</b></>}>
        The exam opens only when your face matches the photo your teacher registered. Look straight at the camera in good
        light, alone, without sunglasses, caps or masks. Your timer starts once you&apos;re verified.
      </StepTitle>

      {result && (
        <div
          role="status"
          className={cn(
            "mb-4 flex items-start gap-3 rounded-2xl p-4 text-sm",
            passed ? "bg-success/10 text-success" : status === "retry" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
          )}
        >
          {passed ? <UserCheck className="h-5 w-5 shrink-0" /> : <ScanFace className="h-5 w-5 shrink-0" />}
          <div>
            <p className="font-medium">
              {status === "verified"
                ? "Identity verified"
                : status === "approved"
                  ? "Approved by your teacher"
                  : status === "skipped"
                    ? "No check needed"
                    : status === "no_reference"
                      ? "No registered photo"
                      : "Not a match yet. The exam stays locked"}
            </p>
            {result.message && <p className="mt-0.5 text-foreground/80">{result.message}</p>}
            {typeof result.score === "number" && <p className="mt-1 font-mono text-xs opacity-80">match {Math.round(result.score * 100)}%</p>}
          </div>
        </div>
      )}
      {error && <p className="mb-4 rounded-2xl bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

      {result?.can_continue ? (
        <Button size="lg" className="w-full" onClick={onNext}>
          Continue <ArrowRight />
        </Button>
      ) : (
        <Button size="lg" className="w-full" onClick={verify} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <ScanFace />}
          {status === "no_reference" ? "Check again" : result ? "Try again" : "Verify my identity"}
        </Button>
      )}
    </>
  );
}

/* ------------------------------------------------------------------------------------------ 03 */
function CalibrationTarget() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
      <span className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute h-16 w-16 animate-ping rounded-full border-2 border-white/60" />
        <span className="h-4 w-4 rounded-full bg-white" />
      </span>
    </div>
  );
}

function CalibrateStep({
  attemptId,
  videoRef,
  calibrated,
  onNext,
}: {
  attemptId: string;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  calibrated: boolean;
  onNext: () => void;
}) {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(calibrated);
  const [error, setError] = useState<string | null>(null);

  async function calibrate() {
    setBusy(true);
    setError(null);
    try {
      const images = await captureBurst(videoRef.current, 4, 550);
      await api(`/api/attempts/${attemptId}/calibrate`, { method: "POST", json: { images } });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StepTitle tag="[ 03 ]" title={<>Look at the <b>centre dot</b></>}>
        Sit how you&apos;ll sit for the exam. We learn your natural head position so normal posture isn&apos;t flagged.
      </StepTitle>
      {done && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl bg-success/10 p-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" /> Calibrated
        </p>
      )}
      {error && <p className="mb-4 rounded-2xl bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        {done && (
          <Button variant="outline" size="lg" onClick={calibrate} disabled={busy}>
            <RotateCcw /> Redo
          </Button>
        )}
        {done ? (
          <Button size="lg" className="flex-1" onClick={onNext} disabled={busy}>
            Continue <ArrowRight />
          </Button>
        ) : (
          <Button size="lg" className="flex-1" onClick={calibrate} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Crosshair />}
            {busy ? "Hold still…" : "Calibrate"}
          </Button>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------------------------ 04 */
function RulesStep({ detail, onStart }: { detail: AttemptDetail; onStart: () => void }) {
  const s = detail.exam.settings;
  const rules = [
    s.require_fullscreen && "Stay in fullscreen and on this tab — leaving is flagged.",
    "Keep your face in view and your eyes on the screen. Looking down or away is flagged within seconds.",
    "Nobody else may appear on camera, even walking past.",
    s.detect_objects && "No phones, books, notes or other devices. Your last frame is checked when you submit.",
    s.detect_audio && "Don't talk. Voices and loud noise near your microphone are flagged.",
    s.verify_identity && "Your face is re-checked every few seconds during the exam.",
    "Copy, paste and right-click are disabled.",
    "Answers save automatically. The exam submits itself when time runs out.",
  ].filter(Boolean) as string[];
  return (
    <>
      <StepTitle tag="[ 04 ]" title={<>You&apos;re <b>all set</b></>}>
        {detail.exam.duration_minutes} minutes{detail.questions.length ? ` · ${detail.questions.length} questions` : ""}
        {s.max_violations ? ` · ends automatically after ${s.max_violations} flags` : ""}
      </StepTitle>
      {detail.exam.description && <p className="mb-4 whitespace-pre-wrap rounded-2xl bg-muted p-4 text-sm">{detail.exam.description}</p>}
      <ul className="mb-6 space-y-2 text-sm">
        {rules.map((r) => (
          <li key={r} className="flex gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {r}
          </li>
        ))}
      </ul>
      <Button size="lg" className="w-full" onClick={onStart}>
        {s.require_fullscreen && <Maximize />}
        Start exam
      </Button>
    </>
  );
}
