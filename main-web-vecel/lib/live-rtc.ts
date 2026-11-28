/*
 * On-demand live video over WebRTC, peer to peer: the candidate's browser streams its camera (and mic) straight
 * to the proctor's browser. The API only relays one SDP offer and one SDP answer per connection. ICE is
 * non-trickle (each side waits until it has gathered its network candidates, up to a few seconds), so plain
 * HTTP polling is enough and no WebSocket is needed.
 *
 * Framework-free on purpose: the app passes its authenticated fetch helper, and tests can pass their own.
 */

export type Request = <T = unknown>(path: string, init?: { method?: string; json?: unknown }) => Promise<T>;
export type LiveRequest = { session_id: string; ice_servers: RTCIceServer[] };
export type BroadcastState = "idle" | "connecting" | "live" | "reconnecting";
export type ViewerState = "requesting" | "waiting" | "connecting" | "live" | "reconnecting" | "ended" | "timeout" | "failed";

const ICE_WAIT_MS = 3000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Resolve once ICE gathering completes, or after `ms` with whatever candidates exist (enough for most networks). */
export function waitForIceGathering(pc: RTCPeerConnection, ms = ICE_WAIT_MS): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => pc.iceGatheringState === "complete" && done();
    const timer = setTimeout(done, ms);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

/** Whether the media path is direct (peer to peer) or relayed through a TURN server. */
export async function connectionRoute(pc: RTCPeerConnection): Promise<"direct" | "relay" | null> {
  try {
    const stats = await pc.getStats();
    let pairId: string | undefined;
    stats.forEach((s) => {
      if (s.type === "transport" && s.selectedCandidatePairId) pairId = s.selectedCandidatePairId;
    });
    let pair: RTCIceCandidatePairStats | undefined;
    stats.forEach((s) => {
      if (s.type === "candidate-pair" && (s.id === pairId || (!pairId && s.nominated && s.state === "succeeded"))) pair = s;
    });
    if (!pair) return null;
    const local = stats.get(pair.localCandidateId);
    const remote = stats.get(pair.remoteCandidateId);
    return local?.candidateType === "relay" || remote?.candidateType === "relay" ? "relay" : "direct";
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------------------------------- candidate side */

/**
 * Candidate side. Feed it the `live` field of every frame/heartbeat response: a request starts (or repairs) a
 * stream to the proctor, `null` hangs up.
 */
export class LiveBroadcaster {
  private pc: RTCPeerConnection | null = null;
  private sessionId: string | null = null;
  private busy = false;
  state: BroadcastState = "idle";

  constructor(
    private request: Request,
    private attemptId: string,
    private getStream: () => MediaStream | null,
    private onState: (s: BroadcastState) => void = () => undefined
  ) {}

  private set(s: BroadcastState) {
    this.state = s;
    this.onState(s);
  }

  async handle(live: LiveRequest | null | undefined): Promise<void> {
    if (!live) return this.stop();
    const healthy = this.pc && !["failed", "closed"].includes(this.pc.connectionState);
    if (this.busy || (live.session_id === this.sessionId && healthy)) return;
    await this.connect(live, live.session_id === this.sessionId);
  }

  private async connect(live: LiveRequest, retry: boolean): Promise<void> {
    const stream = this.getStream();
    if (!stream) return;
    this.busy = true;
    this.pc?.close();
    this.sessionId = live.session_id;
    this.set(retry ? "reconnecting" : "connecting");
    const pc = new RTCPeerConnection({ iceServers: live.ice_servers });
    this.pc = pc;
    try {
      for (const track of stream.getTracks()) pc.addTransceiver(track, { direction: "sendonly", streams: [stream] });
      pc.addEventListener("connectionstatechange", () => {
        if (this.pc !== pc) return;
        if (pc.connectionState === "connected") this.set("live");
        if (pc.connectionState === "failed") this.set("reconnecting"); // the next pulse re-offers
      });
      await pc.setLocalDescription(await pc.createOffer());
      await waitForIceGathering(pc);
      const base = `/api/attempts/${this.attemptId}/live`;
      await this.request(`${base}/offer`, { method: "POST", json: { session_id: live.session_id, sdp: pc.localDescription?.sdp } });
      for (let i = 0; i < 45 && this.pc === pc; i++) {
        const r = await this.request<{ active: boolean; answer: string | null }>(
          `${base}/answer?session_id=${encodeURIComponent(live.session_id)}`
        );
        if (!r.active) return this.stop();
        if (r.answer) {
          await pc.setRemoteDescription({ type: "answer", sdp: r.answer });
          return;
        }
        await sleep(700);
      }
    } catch {
      if (this.pc === pc) this.set("reconnecting"); // retried on the next pulse
    } finally {
      this.busy = false;
    }
  }

  stop(): void {
    this.pc?.close();
    this.pc = null;
    this.sessionId = null;
    if (this.state !== "idle") this.set("idle");
  }
}

/* --------------------------------------------------------------------------------------- proctor side */

/** Proctor side: asks the candidate's browser to stream, answers its offer and hands over the remote stream. */
export class LiveViewer {
  private pc: RTCPeerConnection | null = null;
  private sessionId: string | null = null;
  private iceServers: RTCIceServer[] = [];
  private answered = 0;
  private stopped = false;
  state: ViewerState = "requesting";

  constructor(
    private request: Request,
    private attemptId: string,
    private onStream: (stream: MediaStream) => void,
    private onState: (s: ViewerState, detail?: string) => void = () => undefined
  ) {}

  private set(s: ViewerState, detail?: string) {
    this.state = s;
    this.onState(s, detail);
  }

  get connection(): RTCPeerConnection | null {
    return this.pc;
  }

  async start(waitMs = 45000): Promise<void> {
    const base = `/api/attempts/${this.attemptId}/live`;
    try {
      const s = await this.request<{ session_id: string; ice_servers: RTCIceServer[] }>(base, { method: "POST" });
      this.sessionId = s.session_id;
      this.iceServers = s.ice_servers;
    } catch (e) {
      return this.set("failed", (e as Error).message);
    }
    this.set("waiting");
    const started = Date.now();
    while (!this.stopped) {
      let r: { active: boolean; offer?: string | null; version?: number; reason?: string };
      try {
        r = await this.request(`${base}?session_id=${encodeURIComponent(this.sessionId!)}`);
      } catch {
        await sleep(2000);
        continue;
      }
      if (this.stopped) return;
      if (!r.active) return this.end(r.reason === "ended" || !r.reason ? "ended" : r.reason);
      if (r.offer && r.version && r.version !== this.answered) await this.answer(r.offer, r.version);
      if (!this.answered && Date.now() - started > waitMs) {
        this.set("timeout");
        return this.stop();
      }
      await sleep(this.state === "live" ? 4000 : 800); // the poll doubles as the keep-alive
    }
  }

  private async answer(offer: string, version: number): Promise<void> {
    this.pc?.close();
    this.set(this.answered ? "reconnecting" : "connecting");
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.pc = pc;
    pc.addEventListener("track", (e) => this.onStream(e.streams[0] ?? new MediaStream([e.track])));
    pc.addEventListener("connectionstatechange", () => {
      if (this.pc !== pc || this.stopped) return;
      if (pc.connectionState === "connected") this.set("live");
      if (pc.connectionState === "failed") this.set("reconnecting");
    });
    try {
      await pc.setRemoteDescription({ type: "offer", sdp: offer });
      await pc.setLocalDescription(await pc.createAnswer());
      await waitForIceGathering(pc);
      await this.request(`/api/attempts/${this.attemptId}/live/answer`, {
        method: "POST",
        json: { session_id: this.sessionId, version, sdp: pc.localDescription?.sdp },
      });
      this.answered = version;
    } catch (e) {
      this.set("failed", (e as Error).message);
    }
  }

  private end(reason: string) {
    this.set("ended", reason);
    this.stop(false);
  }

  /** Close the connection; tells the server too unless it already knows the session is over. */
  stop(notify = true): void {
    if (this.stopped) return;
    this.stopped = true;
    this.pc?.close();
    this.pc = null;
    if (notify && this.sessionId) {
      this.request(`/api/attempts/${this.attemptId}/live?session_id=${encodeURIComponent(this.sessionId)}`, {
        method: "DELETE",
      }).catch(() => undefined);
    }
  }
}
