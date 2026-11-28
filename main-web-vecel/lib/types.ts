/* Types mirroring the Guard AI API (backend/app). Keep in sync with the serializers in services/exams.py. */

export type Role = "proctor" | "candidate";
export type QuestionType = "single" | "multiple" | "text";
export type AttemptStatus = "in_progress" | "submitted" | "terminated";
export type ExamStatus = "draft" | "published" | "closed";
export type Severity = "low" | "medium" | "high";

export interface Profile {
  id: string;
  role: Role | null;
  name: string | null;
  email: string | null;
}

export interface ExamSettings {
  max_violations: number;
  require_fullscreen: boolean;
  detect_objects: boolean;
  detect_audio: boolean;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_results: boolean;
  reveal_answers: boolean;
  pass_percentage: number;
  require_assignment: boolean;
  verify_identity: boolean;
}

/** Question as the proctor sees it (with answer key). */
export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  correct: number[];
  points: number;
  explanation: string;
  position?: number;
}

/** Question as the candidate sees it: options carry their original index as `id`. */
export interface CandidateQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options: { id: number; text: string }[];
  points: number;
}

export interface ExamSummary {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  starts_at: string | null;
  ends_at: string | null;
  status: ExamStatus;
  access_code: string;
  settings: ExamSettings;
  question_count: number;
  total_points: number;
  created_at: string;
  batch_ids: string[];
  attempt_count?: number;
  live_count?: number;
}

export interface ExamFull extends ExamSummary {
  questions: Question[];
}

export interface LiveAnalysis {
  width: number;
  height: number;
  faces: number;
  persons: number;
  yaw: number | null;
  pitch: number | null;
  gaze: number;
  jaw_open: number;
  brightness: number;
  objects: { label: string; score: number; box: [number, number, number, number] }[];
  face_box: [number, number, number, number] | null;
  looking_away: boolean;
  identity?: { score: number; match: boolean };
}

export interface IdentityState {
  status?: "verified" | "retry" | "failed" | "skipped" | "approved" | "no_reference";
  score?: number | null;
  tries?: number;
  checked_at?: string;
}

export interface AttemptSummary {
  id: string;
  exam_id: string;
  exam_title: string | null;
  candidate_id: string;
  candidate_name: string | null;
  candidate_email: string | null;
  status: AttemptStatus;
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  passed: boolean | null;
  risk_score: number;
  violation_count: number;
  termination_reason: string | null;
  online: boolean;
  remaining_seconds: number;
  answered: number;
  calibrated: boolean;
  identity: IdentityState;
  last_frame?: string | null;
  live?: LiveAnalysis;
}

export interface ViolationOut {
  id: string;
  attempt_id: string;
  type: string;
  severity: Severity;
  source: "ai" | "browser";
  message: string;
  meta: Record<string, unknown>;
  snapshot_url: string | null;
  created_at: string;
  candidate_name?: string | null;
  exam_title?: string;
  exam_id?: string;
}

export interface ActivityPoint {
  date: string;
  attempts: number;
  flags: number;
}

export interface Overview {
  exam_count: number;
  published_count: number;
  student_count: number;
  active_attempts: number;
  online_now: number;
  completed_attempts: number;
  average_score: number | null;
  alerts_24h: number;
  recent_violations: ViolationOut[];
  activity: ActivityPoint[];
  violations_by_type: { type: string; count: number }[];
  live_exams: (ExamSummary & { live_count: number })[];
  upcoming: ExamSummary[];
  ml: MLStatus;
}

export interface MLStatus {
  ready: boolean;
  error: string | null;
  workers: number;
  queued: number;
  avg_inference_ms: number;
  active_streams: number;
  next_frame_ms: number;
}

export interface ExamAnalytics {
  summary: {
    attempts: number;
    in_progress: number;
    submitted: number;
    terminated: number;
    average: number | null;
    median: number | null;
    highest: number | null;
    pass_rate: number | null;
    pass_percentage: number;
    avg_minutes: number | null;
    flagged: number;
  };
  score_distribution: { range: string; count: number }[];
  questions: { id: string; prompt: string; type: QuestionType; correct_rate: number | null; answered_rate: number | null }[];
  violations_by_type: { type: string; count: number }[];
}

export interface Review {
  attempt: AttemptSummary & {
    answers: Record<string, AnswerValue>;
    manual_scores: Record<string, number>;
    reference_photo_url: string | null;
  };
  exam: ExamSummary;
  questions: Question[];
  violations: ViolationOut[];
}

/* ---------------------------------------------------------------- students & batches */
export interface BatchRef {
  id: string;
  name: string;
}

export interface Student {
  id: string;
  name: string | null;
  email: string | null;
  managed: boolean;
  active: boolean;
  batches: BatchRef[];
  photo_url: string | null;
  has_reference: boolean;
  attempts: number;
  average: number | null;
  flags: number;
  last_active: string | null;
  created_at: string;
}

export interface StudentDetail extends Student {
  history: AttemptSummary[];
}

export interface Batch {
  id: string;
  name: string;
  description: string;
  member_count: number;
  exam_count: number;
  created_at: string;
}

export interface Invite {
  id: string;
  email: string;
  name: string | null;
  batch_ids: string[];
  created_at: string;
}

export interface StudentCreateResult {
  status: "created" | "invited" | "linked" | "error" | "skipped";
  id?: string;
  email: string;
  name: string | null;
  password?: string;
  error?: string;
}

export interface ImportResult {
  results: StudentCreateResult[];
  created: number;
  invited: number;
  linked: number;
  failed: number;
}

/* ---------------------------------------------------------------- candidate */
export type AnswerValue = number[] | string;

export interface MyExam extends Omit<ExamSummary, "access_code"> {
  open_error: string | null;
  attempt: AttemptSummary | null;
}

export interface ExamLookup extends Omit<ExamSummary, "access_code"> {
  open_error: string | null;
  existing_attempt: AttemptSummary | null;
}

export interface AttemptDetail {
  attempt: AttemptSummary;
  answers: Record<string, AnswerValue>;
  exam: { id: string; title: string; description: string; duration_minutes: number; settings: ExamSettings };
  identity_required: boolean;
  identity_ok: boolean;
  has_reference_photo: boolean;
  questions: CandidateQuestion[];
  ml: { ready: boolean; frame_interval_ms: number };
}

export interface FrameResponse {
  status: AttemptStatus;
  remaining_seconds: number;
  termination_reason: string | null;
  messages: { id: string; body: string; created_at: string }[];
  next_frame_ms: number;
  skipped?: boolean;
  analysis?: LiveAnalysis | null;
  events?: { type: string; severity: Severity; message: string }[];
  /** Proctor's request to watch live (peer-to-peer video), or null. */
  live?: { session_id: string; ice_servers: RTCIceServer[] } | null;
}

export interface CheckResponse {
  faces: number;
  brightness: number;
  too_dark: boolean;
  face_box: [number, number, number, number] | null;
  width: number;
  height: number;
  ok: boolean;
}

export interface VerifyResponse extends IdentityState {
  can_continue: boolean;
  message?: string;
  remaining_tries?: number;
  fails?: number;
  faces?: number[];
}

export interface ResultBreakdownItem {
  id: string;
  prompt: string;
  type: QuestionType;
  points: number;
  options: string[];
  your_answer: AnswerValue | undefined;
  correct: number[] | null;
  earned: number | null;
  explanation: string | null;
}

export interface AttemptResult extends AttemptSummary {
  breakdown?: ResultBreakdownItem[];
}

/* ---------------------------------------------------------------- labels */
export const VIOLATION_LABELS: Record<string, string> = {
  no_face: "No face",
  multiple_faces: "Multiple people",
  looking_away: "Looking away",
  frequent_head_movement: "Frequent head movement",
  gaze_away: "Eyes off screen",
  frequent_eye_movement: "Frequent eye movement",
  phone_detected: "Phone detected",
  book_detected: "Book / notes",
  extra_device: "Extra device",
  talking: "Talking",
  background_voice: "Voice nearby",
  background_noise: "Loud noise",
  camera_blocked: "Camera blocked",
  identity_mismatch: "Identity mismatch",
  identity_unverified: "Identity not verified",
  tab_switch: "Tab switch",
  window_blur: "Left exam window",
  fullscreen_exit: "Exited fullscreen",
  copy_paste: "Copy / paste",
  multiple_displays: "Multiple displays",
  camera_lost: "Camera disconnected",
};

export const violationLabel = (t: string) => VIOLATION_LABELS[t] ?? t.replace(/_/g, " ");
