import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Eye,
  Lock,
  Radio,
  ScanFace,
  Server,
  Smartphone,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function Statement() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[1fr_2.2fr]">
        <p className="eyebrow">[ 002 ]&nbsp;&nbsp;Why Guard AI</p>
        <div>
          <p className="display text-3xl leading-[1.15] sm:text-[42px]">
            Guard AI supports both <b>teachers and institutions</b> by delivering{" "}
            <b>fair, verifiable exams at scale</b> — without asking students to install anything, and without
            storing a single minute of video.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              ["~130 ms", "server-side analysis per webcam frame"],
              ["4 models", "face, landmarks, identity and object detection"],
              ["0 installs", "works in any modern browser"],
            ].map(([n, l]) => (
              <div key={n} className="border-t border-border pt-4">
                <p className="tabular text-3xl font-semibold tracking-tight">{n}</p>
                <p className="mt-1 text-sm text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: ScanFace, title: "Face & gaze tracking", text: "Counts faces, measures head pose against a per-student calibration and catches eyes drifting off-screen." },
  { icon: Smartphone, title: "Phones, books & devices", text: "A YOLOX object detector spots phones, notes and second laptops in view — with snapshot evidence." },
  { icon: UserCheck, title: "Identity verification", text: "Upload a student photo once. Guard AI matches their face before the exam and re-checks during it." },
  { icon: Radio, title: "Live monitoring", text: "A live grid of every candidate with risk scores. Warn a student or end an attempt in one click." },
  { icon: BarChart3, title: "Analytics & export", text: "Score distribution, per-question accuracy, flag breakdowns and CSV export for every exam." },
  { icon: Users, title: "Students & batches", text: "Create student accounts, import a CSV, invite by email, and assign exams to whole classes." },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-4">[ 003 ]&nbsp;&nbsp;Features</p>
          <h2 className="display max-w-2xl text-4xl leading-[1.05] sm:text-5xl">
            Everything a proctor does, <b>minus the webcam wall.</b>
          </h2>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }, i) => (
          <article key={title} className="surface group flex flex-col p-7 transition-shadow hover:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">0{i + 1}</span>
            </div>
            <h3 className="mt-8 text-lg font-semibold tracking-tight">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", title: "Build & assign", text: "Write questions, set the rules, then publish to a batch or share a 6-character code." },
  { n: "02", title: "Students check in", text: "A guided camera check, identity match and 2-second calibration — then fullscreen." },
  { n: "03", title: "AI watches, you decide", text: "Flags arrive with snapshots and a risk score. Review evidence, grade, export." },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-7xl rounded-[36px] bg-primary p-8 text-primary-foreground sm:p-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-primary-foreground/60">[ 004 ]&nbsp;&nbsp;How it works</p>
        <h2 className="mt-4 max-w-2xl text-4xl font-medium leading-[1.05] tracking-[-0.035em] sm:text-5xl">
          From draft to verified results <span className="text-primary-foreground/50">in three steps.</span>
        </h2>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-[28px] bg-primary-foreground/[0.06] p-6">
              <span className="font-mono text-sm text-primary-foreground/50">{s.n}</span>
              <h3 className="mt-10 text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/70">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function IdentityPrivacy() {
  return (
    <section id="identity" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bronze flex min-h-[380px] flex-col justify-between rounded-[32px] p-8 sm:p-10">
          <div className="relative z-10 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/70">[ 005 ]&nbsp;&nbsp;Identity</span>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur">
              <UserCheck className="h-5 w-5" />
            </span>
          </div>
          <div className="relative z-10">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">The right student, the whole exam.</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
              Teachers register one reference photo. A face-recognition model (SFace) confirms the match before the
              exam starts and quietly re-checks every few seconds — a swap mid-exam is flagged immediately.
            </p>
          </div>
        </div>
        <div className="surface flex flex-col justify-between p-8 sm:p-10">
          <div className="flex items-center justify-between">
            <span className="eyebrow">[ 006 ]&nbsp;&nbsp;Privacy by design</span>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <Lock className="h-5 w-5" />
            </span>
          </div>
          <ul className="mt-8 space-y-5">
            {[
              { icon: Server, t: "Models run on our server", d: "No plug-ins, no extensions, no heavy downloads on student devices." },
              { icon: Eye, t: "No video is stored", d: "Frames are analysed in memory. Only flagged moments are kept as snapshots." },
              { icon: Lock, t: "Private evidence", d: "Snapshots and reference photos live in a private bucket behind signed URLs." },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex gap-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  ["Do students need to install anything?", "No. Guard AI runs in Chrome, Edge, Firefox and Safari. Students only allow camera (and optionally microphone) access."],
  ["What does the AI actually detect?", "Missing or extra faces, extra people, prolonged looking away, frequent head movement, eyes off-screen, phones, books, extra laptops, talking, a covered camera and identity mismatches. The browser also reports tab switches, leaving fullscreen and copy/paste."],
  ["Is the AI the final judge?", "No. The AI raises flags with snapshot evidence and a risk score. The proctor reviews them and decides — warn, end the attempt, or ignore."],
  ["Is video recorded?", "No. Frames are analysed in memory on the server and discarded. Only frames attached to a flag are stored as evidence, in a private bucket."],
  ["How do students get accounts?", "They can sign up themselves, or teachers can create accounts (with a generated password), import a CSV or send email invites — and group them into batches."],
  ["Can it handle a whole class?", "Yes. The server adapts each student's frame rate to its load, so analysis stays responsive as more students join."],
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <p className="eyebrow mb-4">[ 007 ]&nbsp;&nbsp;FAQ</p>
          <h2 className="display text-4xl leading-[1.05] sm:text-5xl">
            Questions, <b>answered.</b>
          </h2>
        </div>
        <Accordion type="single" collapsible className="surface px-6">
          {FAQ.map(([q, a], i) => (
            <AccordionItem key={q} value={`q${i}`} className={i === FAQ.length - 1 ? "border-b-0" : undefined}>
              <AccordionTrigger className="text-left text-[15px] font-medium hover:no-underline">{q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="px-4 py-20 sm:px-6">
      <div className="grainient mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-[36px] p-8 sm:p-14 md:flex-row md:items-end">
        <h2 className="relative z-10 max-w-2xl text-4xl font-medium leading-[1.05] tracking-[-0.035em] text-white sm:text-5xl">
          Run your next exam with Guard AI.
        </h2>
        <Button asChild size="lg" className="relative z-10 bg-white text-[#171311] hover:bg-white/90">
          <Link href="/sign-up">
            Create a free account <ArrowRight />
          </Link>
        </Button>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
      <div className="flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={24} height={24} className="rounded-md" />
          <span className="font-semibold tracking-tight">Guard AI</span>
          <span className="text-sm text-muted-foreground">· Open-source AI proctoring</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground sm:ml-auto">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
          <a
            href="https://github.com/Hiteshydv001/Guard-AI-Designing-Remote-Proctoring-System"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-foreground"
          >
            <GithubMark className="h-4 w-4" /> GitHub
          </a>
          <span className="font-mono text-xs">© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}

/** GitHub's mark (lucide-react v1 no longer ships brand icons). */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className={className}>
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
