"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  Loader2,
  RotateCcw,
  ScanFace,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError, fileToJpegDataUrl, useApi } from "@/lib/api";
import type { Student } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhotoCropper, type CropperHandle } from "./photo-cropper";

type Source = "idle" | "camera" | "preview";

/** Upload or capture the student's reference photo for face-recognition identity checks. */
export function PhotoDialog({
  open,
  onOpenChange,
  student,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Pick<Student, "id" | "name" | "photo_url"> | null;
  onSaved: (s: Student) => void;
}) {
  const api = useApi();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cropRef = useRef<CropperHandle>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [source, setSource] = useState<Source>("idle");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setSource("idle");
      setImage(null);
      setError(null);
    }
  }, [open, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function pickFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please choose a JPEG or PNG image.");
      return;
    }
    try {
      setError(null);
      stopCamera();
      setImage(await fileToJpegDataUrl(file, 1600, 0.92)); // full detail for cropping
      setSource("preview");
    } catch {
      setError("Couldn't read that image.");
    }
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
      });
      streamRef.current = stream;
      setSource("camera");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setError(
        "Camera access was blocked. Allow it in the browser's address bar or upload a file instead.",
      );
    }
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    const ctx = c.getContext("2d")!;
    ctx.translate(c.width, 0); // keep the mirrored view the teacher saw while framing
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, c.width, c.height);
    setImage(c.toDataURL("image/jpeg", 0.9));
    stopCamera();
    setSource("preview");
  }

  async function save() {
    const cropped = cropRef.current?.exportJpeg();
    if (!student || !cropped) return;
    setBusy(true);
    setError(null);
    try {
      const s = await api<Student>(`/api/students/${student.id}/photo`, {
        method: "POST",
        json: { image: cropped },
      });
      toast.success("Reference photo saved", {
        description: "Face ID is now active for this student.",
      });
      onSaved(s);
      onOpenChange(false);
    } catch (e) {
      const err = e as ApiError;
      setError(
        err.status === 503
          ? "Face recognition is still starting on the server. Try again in a moment."
          : err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <p className="eyebrow">Face ID</p>
          <DialogTitle className="text-xl tracking-tight">
            Reference photo{student?.name ? ` · ${student.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            A clear, front-facing photo with only the student in frame.
            It&apos;s compared with their webcam before and during every exam.
          </DialogDescription>
        </DialogHeader>

        {source === "preview" && image ? (
          <PhotoCropper ref={cropRef} src={image} />
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) pickFile(f);
            }}
            className={cn(
              "relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[24px] border-2 border-dashed bg-muted/40",
              dragging ? "border-foreground/40" : "border-border",
              source !== "idle" && "border-solid border-transparent",
            )}
          >
            {source === "camera" && (
              <>
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="h-full w-full scale-x-[-1] object-cover"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-[62%] w-[42%] rounded-[50%] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
              </>
            )}
            {source === "idle" &&
              (student?.photo_url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={student.photo_url}
                    alt="Current reference"
                    className="h-full w-full object-cover opacity-90"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
                    Current photo
                  </span>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 p-6 text-center">
                  <span className="grainient-soft flex h-14 w-14 items-center justify-center rounded-full">
                    <ScanFace className="relative z-10 h-6 w-6" />
                  </span>
                  <p className="text-sm font-medium">Drop a photo here</p>
                  <p className="text-xs text-muted-foreground">
                    JPEG or PNG · good lighting · no sunglasses
                  </p>
                </div>
              ))}
          </div>
        )}

        {error && (
          <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {source === "camera" ? (
            <Button onClick={capture}>
              <Camera /> Capture
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus />{" "}
                {source === "preview" ? "Choose another" : "Upload photo"}
              </Button>
              <Button variant="outline" onClick={startCamera}>
                {source === "preview" ? <RotateCcw /> : <Camera />}{" "}
                {source === "preview" ? "Retake" : "Use webcam"}
              </Button>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f);
              e.target.value = "";
            }}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={!image || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            {busy ? "Checking face…" : "Save photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
