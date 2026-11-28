/* Browser media helpers for the proctored exam room. All analysis happens on the server; the browser
 * only captures small JPEG frames and a scalar microphone level. */

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let canvas: HTMLCanvasElement | null = null;

/** Grab the current video frame as a JPEG data URL (default 640 px wide, ~25 KB). */
export function captureJpeg(video: HTMLVideoElement | null, width = 640, quality = 0.7): string | null {
  if (!video || video.readyState < 2 || !video.videoWidth) return null;
  canvas ??= document.createElement("canvas");
  const scale = Math.min(1, width / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Capture `count` frames spaced `gapMs` apart. */
export async function captureBurst(video: HTMLVideoElement | null, count: number, gapMs: number): Promise<string[]> {
  const frames: string[] = [];
  for (let i = 0; i < count; i++) {
    const f = captureJpeg(video);
    if (f) frames.push(f);
    if (i < count - 1) await sleep(gapMs);
  }
  return frames;
}

/** Opens camera (+ microphone when wanted). Falls back to video-only if the mic is refused. */
export async function openMedia(wantAudio: boolean): Promise<{ stream: MediaStream; audio: boolean }> {
  const video = { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" };
  if (wantAudio) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: { echoCancellation: false, noiseSuppression: false } });
      return { stream, audio: true };
    } catch {
      /* fall through to video only */
    }
  }
  const stream = await navigator.mediaDevices.getUserMedia({ video });
  return { stream, audio: false };
}

export type AudioReading = { level: number; voice: number };

/**
 * Listens to the microphone in 100 ms windows and summarises everything since the last `read()`:
 *  - level: peak loudness (RMS, 0..1), so a short burst between two frame uploads isn't missed
 *  - voice: share of windows that sounded like speech, i.e. clearly above the room's own background
 *    level with most energy in the 300-3400 Hz voice band (fans and hum sit lower, clicks and hiss higher)
 * Only these two numbers leave the browser; no audio is recorded or uploaded.
 */
export class AudioMeter {
  private ctx: AudioContext;
  private analyser: AnalyserNode;
  private wave: Float32Array<ArrayBuffer>;
  private spectrum: Float32Array<ArrayBuffer>;
  private timer: ReturnType<typeof setInterval>;
  private peak = 0;
  private windows = 0;
  private speechWindows = 0;
  private floor = 0.01; // adaptive background level
  level = 0;

  constructor(stream: MediaStream) {
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.2;
    this.wave = new Float32Array(this.analyser.fftSize);
    this.spectrum = new Float32Array(this.analyser.frequencyBinCount);
    src.connect(this.analyser);
    this.timer = setInterval(() => this.sample(), 100);
  }

  private sample() {
    this.analyser.getFloatTimeDomainData(this.wave);
    let sum = 0;
    for (let i = 0; i < this.wave.length; i++) sum += this.wave[i] * this.wave[i];
    const rms = Math.min(1, Math.sqrt(sum / this.wave.length));
    this.level = rms;
    if (rms > this.peak) this.peak = rms;

    // Energy share in the speech band (spectrum is in dBFS; convert to power).
    this.analyser.getFloatFrequencyData(this.spectrum);
    const hzPerBin = this.ctx.sampleRate / this.analyser.fftSize;
    let band = 0;
    let total = 0;
    for (let i = 1; i < this.spectrum.length; i++) {
      const hz = i * hzPerBin;
      if (hz < 80 || hz > 8000) continue;
      const power = 10 ** (this.spectrum[i] / 10);
      total += power;
      if (hz >= 300 && hz <= 3400) band += power;
    }
    const voiced = total > 0 && band / total > 0.6 && rms > Math.max(0.02, this.floor * 2.5);

    // Track the background: drop quickly to quieter levels, creep up slowly (so speech doesn't become "background").
    this.floor = rms < this.floor ? 0.8 * this.floor + 0.2 * rms : this.floor + 0.0005;
    this.windows++;
    if (voiced) this.speechWindows++;
  }

  resume() {
    this.ctx.resume().catch(() => undefined);
  }

  /** Summary since the previous read. */
  read(): AudioReading {
    const out = {
      level: Math.round(this.peak * 1000) / 1000,
      voice: this.windows ? Math.round((this.speechWindows / this.windows) * 100) / 100 : 0,
    };
    this.peak = 0;
    this.windows = 0;
    this.speechWindows = 0;
    return out;
  }

  close() {
    clearInterval(this.timer);
    this.ctx.close().catch(() => undefined);
  }
}

export async function enterFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  } catch {
    /* unsupported (iOS Safari) — the overlay explains it */
  }
}

export function hasExtendedDisplay(): boolean {
  return Boolean((window.screen as Screen & { isExtended?: boolean }).isExtended);
}
