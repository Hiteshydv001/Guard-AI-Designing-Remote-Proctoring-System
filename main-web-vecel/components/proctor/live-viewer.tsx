"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Video, Volume2, VolumeX } from "lucide-react";
import { useApi } from "@/lib/api";
import { LiveViewer, connectionRoute, type ViewerState } from "@/lib/live-rtc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STATUS: Record<ViewerState, string> = {
  requesting: "Starting…",
  waiting: "Waiting for the student's browser…",
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  ended: "The stream ended",
  timeout: "The student's browser didn't respond",
  failed: "Couldn't connect",
};

/** Peer-to-peer live video from one candidate. Streams only while this dialog is open. */
export function LiveViewerDialog({
  attemptId,
  name,
  open,
  onOpenChange,
}: {
  attemptId: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const api = useApi();
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerRef = useRef<LiveViewer | null>(null);
  const [state, setState] = useState<ViewerState>("requesting");
  const [detail, setDetail] = useState<string | undefined>();
  const [muted, setMuted] = useState(true);
  const [hasAudio, setHasAudio] = useState(false);
  const [route, setRoute] = useState<"direct" | "relay" | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    setState("requesting");
    setDetail(undefined);
    setRoute(null);
    const viewer = new LiveViewer(
      api,
      attemptId,
      (stream) => {
        setHasAudio(stream.getAudioTracks().length > 0);
        if (videoRef.current && videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      },
      (s, d) => {
        setState(s);
        setDetail(d);
        if (s === "live" && viewer.connection) setTimeout(() => connectionRoute(viewer.connection!).then(setRoute), 500);
      }
    );
    viewerRef.current = viewer;
    void viewer.start();
    const video = videoRef.current;
    return () => {
      viewer.stop();
      viewerRef.current = null;
      if (video) video.srcObject = null;
    };
  }, [open, api, attemptId, attempt]);

  const done = state === "ended" || state === "timeout" || state === "failed";
  const busy = !done && state !== "live";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <p className="eyebrow flex items-center gap-1.5">
            <Video className="h-3 w-3" /> Live camera
          </p>
          <DialogTitle className="text-xl tracking-tight">{name}</DialogTitle>
          <DialogDescription>
            Video goes straight from the student&apos;s browser to yours and isn&apos;t recorded. The student sees that you&apos;re
            watching.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-video overflow-hidden rounded-[22px] bg-black">
          <video ref={videoRef} autoPlay playsInline muted={muted} className={cn("h-full w-full object-contain", state !== "live" && "opacity-40")} />
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur",
                state === "live" ? "bg-red-600/90" : "bg-black/60"
              )}
            >
              {state === "live" ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> : busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {STATUS[state]}
            </span>
            {state === "live" && route && (
              <span className="rounded-full bg-black/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/85 backdrop-blur">
                {route === "direct" ? "direct" : "relayed"}
              </span>
            )}
          </div>
          {state === "live" && hasAudio && (
            <Button
              size="icon-sm"
              variant="glass"
              className="absolute bottom-3 right-3"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => setMuted((m) => !m)}
            >
              {muted ? <VolumeX /> : <Volume2 />}
            </Button>
          )}
          {done && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              <p className="text-sm text-white/85">
                {state === "timeout"
                  ? "Their exam page may be closed or their connection is weak. They're asked to stream on their next check-in."
                  : state === "ended"
                    ? detail === "submitted" || detail === "terminated"
                      ? "This attempt has finished."
                      : "The stream was closed."
                    : detail || "The connection couldn't be established. Very strict networks may need a TURN relay (see README)."}
              </p>
              <Button size="sm" variant="glass" onClick={() => setAttempt((n) => n + 1)}>
                <RefreshCw /> Try again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
