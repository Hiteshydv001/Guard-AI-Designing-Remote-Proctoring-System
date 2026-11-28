import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Eye, ScanFace, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

// Free-to-use photos from Unsplash (unsplash.com/license), cropped to the face like a webcam frame.
const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=480&h=360&fit=crop&crop=faces&auto=format&q=70`;

const TILES = [
  { name: "Aarav S.", risk: "Low", tone: "bg-emerald-500/90", frame: "border-emerald-300/80", img: photo("1595152772835-219674b2a8a6"), flag: null },
  { name: "Kabir N.", risk: "High", tone: "bg-red-500/90", frame: "border-red-400", img: photo("1611095973763-414019e72400"), flag: "Phone detected" },
  { name: "Zoya R.", risk: "Low", tone: "bg-emerald-500/90", frame: "border-emerald-300/80", img: photo("1567532939604-b6b5b0db2604"), flag: null },
  { name: "Rohan P.", risk: "Med", tone: "bg-amber-500/90", frame: "border-amber-300", img: photo("1534308143481-c55f00be8bd7"), flag: "Looking away" },
  { name: "Meera K.", risk: "Low", tone: "bg-emerald-500/90", frame: "border-emerald-300/80", img: photo("1607746882042-944635dfe10e"), flag: null },
  { name: "Isha T.", risk: "Low", tone: "bg-emerald-500/90", frame: "border-emerald-300/80", img: photo("1531123897727-8f129e1688ce"), flag: null },
];

export function Hero() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 md:pt-20">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow mb-6">[ 001 ]&nbsp;&nbsp;AI proctoring for online exams</p>
          <h1 className="display text-[44px] leading-[1.02] sm:text-6xl lg:text-[76px]">
            Exams you can <b>trust</b>, proctored by AI that runs <b>on our servers.</b>
          </h1>
        </div>
        <div className="space-y-6 lg:pb-3">
          <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Guard AI watches for phones, extra people, look-aways and impersonation — so teachers can run remote exams
            without a webcam wall. Nothing to install for students.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Start for free <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how">See how it works</a>
            </Button>
          </div>
        </div>
      </div>

      <div className="grainient mt-12 rounded-[36px] p-3 sm:p-6 md:p-10">
        <ProductMock />
      </div>
    </section>
  );
}

function ProductMock() {
  return (
    <div className="relative z-10 mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-white/40 bg-[#f7f4f0]/95 text-[#171311] shadow-2xl backdrop-blur" aria-hidden>
      <div className="flex items-center gap-3 border-b border-black/5 px-5 py-3.5">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/50">Live · Data Structures Midterm</span>
        <span className="ml-auto hidden items-center gap-1.5 rounded-full bg-[#171311] px-3 py-1 text-[11px] font-medium text-white sm:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> 28 online
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 sm:gap-3 sm:p-5">
        {TILES.map((t, i) => (
          <div key={t.name} className={i > 3 ? "hidden sm:block" : undefined}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#e7e1da]">
              <Image src={t.img} alt="" fill sizes="(min-width: 1024px) 300px, (min-width: 640px) 30vw, 45vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/15" />
              {/* Scanner frame, coloured by risk */}
              <div className="absolute inset-[14%] [&>span]:absolute [&>span]:h-4 [&>span]:w-4">
                <span className={`left-0 top-0 rounded-tl-lg border-l-2 border-t-2 ${t.frame}`} />
                <span className={`right-0 top-0 rounded-tr-lg border-r-2 border-t-2 ${t.frame}`} />
                <span className={`bottom-0 left-0 rounded-bl-lg border-b-2 border-l-2 ${t.frame}`} />
                <span className={`bottom-0 right-0 rounded-br-lg border-b-2 border-r-2 ${t.frame}`} />
              </div>
              <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> rec
              </span>
              {t.flag && (
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                  {t.flag}
                </span>
              )}
              <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${t.tone}`}>{t.risk}</span>
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-xs font-medium">{t.name}</span>
              <span className="font-mono text-[10px] text-black/45">{12 + i * 7}:0{i}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden flex-wrap gap-2 border-t border-black/5 px-5 py-3.5 sm:flex">
        {[
          { icon: ScanFace, label: "Face & gaze" },
          { icon: Smartphone, label: "Phone detection" },
          { icon: UserCheck, label: "Identity verified" },
          { icon: Eye, label: "Look-away alerts" },
          { icon: ShieldCheck, label: "Tab & fullscreen lock" },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 rounded-full bg-[#ebe6fb] px-2.5 py-1 text-[11px] font-medium text-[#4b3b8f]">
            <Icon className="h-3 w-3" /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
