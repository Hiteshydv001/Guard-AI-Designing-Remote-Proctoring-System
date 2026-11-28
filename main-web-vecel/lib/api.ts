"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function describe(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { msg?: string }) => (d?.msg ?? "").replace(/^Value error, /, ""))
      .filter(Boolean)
      .join("; ");
  }
  return "Request failed";
}

type RequestOptions = RequestInit & { json?: unknown };

export const SESSION_ENDED = "Your session has ended. Sign in again to continue.";

/** Returns a fetch helper that attaches the Clerk session token. */
export function useApi() {
  const { getToken } = useAuth();

  return useCallback(
    async <T = unknown>(path: string, init: RequestOptions = {}): Promise<T> => {
      const token = await getToken();
      const { json, headers, ...rest } = init;
      let res: Response;
      try {
        res = await fetch(`${API_URL}${path}`, {
          ...rest,
          headers: {
            ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
          },
          body: json !== undefined ? JSON.stringify(json) : rest.body,
        });
      } catch {
        throw new ApiError(0, "Can't reach the Guard AI server. Check your connection.");
      }
      if (res.status === 204) return undefined as T;
      if ((res.headers.get("content-type") || "").includes("text/csv")) return (await res.blob()) as T;
      const data = await res.json().catch(() => ({}));
      // Backend 401s ("Missing bearer token", "Invalid token") all mean the same thing to a person.
      if (res.status === 401) throw new ApiError(401, SESSION_ENDED);
      if (!res.ok) throw new ApiError(res.status, describe((data as { detail?: unknown }).detail));
      return data as T;
    },
    [getToken]
  );
}

/**
 * Load data on mount, optionally re-polling. Keeps the previous data while refreshing so
 * polling never flashes a spinner.
 */
export function useQuery<T>(path: string | null, opts: { refreshMs?: number } = {}) {
  const api = useApi();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!path) return;
    try {
      const d = await api<T>(path);
      if (alive.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [api, path]);

  useEffect(() => {
    alive.current = true;
    load();
    if (!opts.refreshMs) return () => void (alive.current = false);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, opts.refreshMs);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [load, opts.refreshMs]);

  return { data, error, loading, reload: load, setData };
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function formatDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return "just now";
  const units: [number, string][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [604800, "week"],
  ];
  let unit = "minute";
  let value = diff / 60;
  for (const [secs, name] of units) {
    if (diff >= secs) {
      unit = name;
      value = diff / secs;
    }
  }
  const n = Math.round(value);
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

export function initials(name: string | null | undefined): string {
  const parts = (name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Resize + compress an image file to a JPEG data URL (for reference photo uploads). */
export async function fileToJpegDataUrl(file: File, maxSide = 800, quality = 0.88): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}
