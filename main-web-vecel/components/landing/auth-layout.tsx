import Link from "next/link";
import Image from "next/image";
import { Check, Cpu, ScanFace, Smartphone, Eye, Radio } from "lucide-react";

const ROWS = [
  { initials: "AK", name: "Aarav K.", tone: "bg-[#c9d3ff]", status: "Face ID verified", icon: Check, chip: "bg-emerald-400/25 text-emerald-50" },
  { initials: "SM", name: "Sara M.", tone: "bg-[#ffd2c2]", status: "Looking away · 4s", icon: Eye, chip: "bg-amber-300/30 text-amber-50" },
  { initials: "RJ", name: "Rohan J.", tone: "bg-[#ffc2d9]", status: "Phone detected", icon: Smartphone, chip: "bg-rose-400/30 text-rose-50" },
];

const POINTS = [
  { icon: ScanFace, text: "Face ID before and during every exam" },
  { icon: Cpu, text: "AI runs on the server, light on any laptop" },
  { icon: Radio, text: "Live grid with evidence you can review" },
];

/** A static, illustrative preview of the proctor's live view. */
function LivePreview() {
  return (
    <div className="relative w-full max-w-[400px]" aria-hidden>
      <div className="rounded-[26px] border border-white/35 bg-white/15 p-5 shadow-[0_30px_80px_-30px_rgba(23,19,17,0.45)] backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/75">[ live ] CS-A · Midterm</p>
            <p className="mt-1 text-sm font-medium">Data Structures, 60 min</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-300" /> 24 online
          </span>
        </div>
        <ul className="mt-4 space-y-2">
          {ROWS.map(({ initials, name, tone, status, icon: Icon, chip }) => (
            <li key={name} className="flex items-center gap-3 rounded-2xl bg-white/12 px-3 py-2.5">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-[#171311] ${tone}`}>
                {initials}
              </span>
              <span className="flex-1 text-sm">{name}</span>
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${chip}`}>
                <Icon className="h-3 w-3" /> {status}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute -bottom-6 -right-6 hidden rounded-2xl border border-white/40 bg-white/85 px-4 py-3 text-[#171311] shadow-xl backdrop-blur xl:block">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6f6862]">Identity match</p>
        <p className="mt-0.5 flex items-baseline gap-1.5 text-2xl font-semibold tabular-nums tracking-tight">
          0.82 <span className="text-xs font-medium text-emerald-700">verified</span>
        </p>
      </div>
    </div>
  );
}

/** Split layout for Clerk sign-in / sign-up: grainient brand panel + form. */
export function AuthLayout({ label, title, children }: { label: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="grainient relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        {/* Scrim keeps the copy legible over the light parts of the gradient. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#171311]/55 via-[#171311]/20 to-transparent" />
        <Link href="/" className="relative z-10 flex items-center gap-2">
          <Image src="/logo.png" alt="" width={30} height={30} className="rounded-lg" />
          <span className="font-semibold tracking-tight">Guard AI</span>
        </Link>

        <div className="relative z-10 flex flex-1 items-center py-10">
          <LivePreview />
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/80">{label}</p>
          <h1 className="mt-4 text-5xl font-medium leading-[1.03] tracking-[-0.035em] [text-shadow:0_2px_24px_rgba(23,19,17,0.25)]">
            {title}
          </h1>
          <ul className="mt-8 space-y-2.5 text-sm text-white/90">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="ambient flex flex-col items-center justify-center gap-8 px-4 py-10">
        <Link href="/" className="flex items-center gap-2 lg:hidden">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-lg" />
          <span className="font-semibold tracking-tight">Guard AI</span>
        </Link>
        {children}
      </main>
    </div>
  );
}
