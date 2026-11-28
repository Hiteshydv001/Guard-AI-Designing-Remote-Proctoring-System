import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Faq, Features, FinalCta, Footer, HowItWorks, IdentityPrivacy, Statement } from "@/components/landing/sections";

export const metadata = {
  title: "Guard AI — AI-proctored online exams",
  description:
    "Server-side AI proctoring with face, phone and identity checks, live monitoring and analytics. Nothing for students to install.",
};

export default function Home() {
  return (
    <div className="ambient">
      <LandingNav />
      <main>
        <Hero />
        <Statement />
        <Features />
        <HowItWorks />
        <IdentityPrivacy />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
