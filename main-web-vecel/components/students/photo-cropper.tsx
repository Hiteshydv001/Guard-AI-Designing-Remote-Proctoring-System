"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Maximize2,
  Minus,
  Move,
  Plus,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type CropperHandle = { exportJpeg: () => string | null };

const OUT = 640; // exported square size (px)
const MAX_ZOOM = 4;

type View = { zoom: number; x: number; y: number; rot: number };
const START: View = { zoom: 1, x: 0, y: 0, rot: 0 };

/**
 * Square crop with drag-to-move, zoom and 90° rotation. Exports exactly what is inside the frame.
 * Offsets are in frame pixels relative to the frame centre.
 */
export const PhotoCropper = forwardRef<CropperHandle, { src: string }>(
  function PhotoCropper({ src }, ref) {
    const frameRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const drag = useRef<{
      id: number;
      sx: number;
      sy: number;
      ox: number;
      oy: number;
    } | null>(null);
    const [frame, setFrame] = useState(0);
    const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
    const [view, setView] = useState<View>(START);

    // Image size after rotation, and the scale at which it just covers the frame.
    const rotated = nat
      ? view.rot % 180 === 0
        ? nat
        : { w: nat.h, h: nat.w }
      : null;
    const cover =
      rotated && frame ? Math.max(frame / rotated.w, frame / rotated.h) : 1;
    const scale = cover * view.zoom;

    const clamp = useCallback(
      (v: View): View => {
        if (!nat || !frame) return v;
        const r = v.rot % 180 === 0 ? nat : { w: nat.h, h: nat.w };
        const s = Math.max(frame / r.w, frame / r.h) * v.zoom;
        const mx = Math.max(0, (r.w * s - frame) / 2);
        const my = Math.max(0, (r.h * s - frame) / 2);
        return {
          ...v,
          x: Math.min(mx, Math.max(-mx, v.x)),
          y: Math.min(my, Math.max(-my, v.y)),
        };
      },
      [nat, frame],
    );

    /** Initial framing: portraits keep their upper part (where the face usually is) in view. */
    const fit = useCallback(() => {
      if (!nat || !frame) return;
      const s = Math.max(frame / nat.w, frame / nat.h);
      const my = Math.max(0, (nat.h * s - frame) / 2);
      setView({ zoom: 1, x: 0, y: my * 0.7, rot: 0 });
    }, [nat, frame]);

    useEffect(() => {
      const el = frameRef.current;
      if (!el) return;
      const ro = new ResizeObserver(([e]) => setFrame(e.contentRect.width));
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      setNat(null);
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        setNat({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.src = src;
    }, [src]);

    useEffect(fit, [fit]);

    const update = (fn: (v: View) => View) => setView((v) => clamp(fn(v)));
    const zoomTo = (z: number) =>
      update((v) => ({ ...v, zoom: Math.min(MAX_ZOOM, Math.max(1, z)) }));

    useImperativeHandle(
      ref,
      () => ({
        exportJpeg() {
          const img = imgRef.current;
          if (!img || !nat || !frame) return null;
          const k = OUT / frame;
          const c = document.createElement("canvas");
          c.width = c.height = OUT;
          const ctx = c.getContext("2d")!;
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, OUT, OUT);
          ctx.translate(OUT / 2 + view.x * k, OUT / 2 + view.y * k);
          ctx.rotate((view.rot * Math.PI) / 180);
          ctx.scale(scale * k, scale * k);
          ctx.drawImage(img, -nat.w / 2, -nat.h / 2);
          return c.toDataURL("image/jpeg", 0.9);
        },
      }),
      [nat, frame, view, scale],
    );

    return (
      <div className="space-y-3">
        <div
          ref={frameRef}
          role="application"
          aria-label="Crop area. Drag to move, use arrow keys to nudge, plus and minus to zoom."
          tabIndex={0}
          className="relative mx-auto aspect-square w-full max-w-[360px] cursor-grab touch-none select-none overflow-hidden rounded-[24px] bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              id: e.pointerId,
              sx: e.clientX,
              sy: e.clientY,
              ox: view.x,
              oy: view.y,
            };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId) return;
            update((v) => ({
              ...v,
              x: d.ox + e.clientX - d.sx,
              y: d.oy + e.clientY - d.sy,
            }));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onWheel={(e) => zoomTo(view.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 20 : 5;
            const moves: Record<string, [number, number]> = {
              ArrowLeft: [-step, 0],
              ArrowRight: [step, 0],
              ArrowUp: [0, -step],
              ArrowDown: [0, step],
            };
            if (moves[e.key]) {
              e.preventDefault();
              update((v) => ({
                ...v,
                x: v.x + moves[e.key][0],
                y: v.y + moves[e.key][1],
              }));
            } else if (e.key === "+" || e.key === "=") zoomTo(view.zoom * 1.1);
            else if (e.key === "-") zoomTo(view.zoom / 1.1);
          }}
        >
          {nat && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt="Photo being cropped"
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: nat.w,
                height: nat.h,
                transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) rotate(${view.rot}deg) scale(${scale})`,
              }}
            />
          )}
          {/* Face guide: keep the face inside the oval */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[66%] w-[50%] rounded-[50%] border-2 border-dashed border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]" />
          </div>
          <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/55 px-3 py-1 text-[11px] text-white backdrop-blur">
            <Move className="h-3 w-3" /> Drag to adjust
          </span>
        </div>

        <div className="mx-auto flex max-w-[360px] items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom out"
            onClick={() => zoomTo(view.zoom / 1.2)}
          >
            <Minus />
          </Button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={view.zoom}
            aria-label="Zoom"
            onChange={(e) => zoomTo(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-foreground"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom in"
            onClick={() => zoomTo(view.zoom * 1.2)}
          >
            <Plus />
          </Button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              update((v) => ({ ...v, rot: (v.rot + 270) % 360, x: 0, y: 0 }))
            }
          >
            <RotateCcw /> Rotate left
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              update((v) => ({ ...v, rot: (v.rot + 90) % 360, x: 0, y: 0 }))
            }
          >
            <RotateCw /> Rotate right
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={fit}>
            <Maximize2 /> Reset
          </Button>
        </div>
      </div>
    );
  },
);
