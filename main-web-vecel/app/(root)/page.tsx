import { BenefitsSection } from "@/components/layout/sections/benefits";
import { CommunitySection } from "@/components/layout/sections/community";
import { ContactSection } from "@/components/layout/sections/contact";
import { FAQSection } from "@/components/layout/sections/faq";
import { FeaturesSection } from "@/components/layout/sections/features";
import { FooterSection } from "@/components/layout/sections/footer";
import { HeroSection } from "@/components/layout/sections/hero";
import { PricingSection } from "@/components/layout/sections/pricing";
import { ServicesSection } from "@/components/layout/sections/services";
import { SponsorsSection } from "@/components/layout/sections/sponsors";
import { TeamSection } from "@/components/layout/sections/team";
import { TestimonialSection } from "@/components/layout/sections/testimonial";

export const metadata = {
  title: "Guard AI - Advanced Security Solutions",
  description: "Guard AI offers cutting-edge AI-powered security for a safer future.",
  openGraph: {
    type: "website",
    url: "https://github.com/Hiteshydv001/Guard-AI.git",
    title: "Guard AI - Advanced Security Solutions",
    description: "Guard AI offers cutting-edge AI-powered security for a safer future.",
    images: [
      {
        url: "https://github.com/Hiteshydv001/Guard-AI/raw/main/demo/guard_eye_logo.png",
        width: 1200,
        height: 630,
        alt: "Guard AI - Advanced Security Solutions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://github.com/Hiteshydv001/Guard-AI.git",
    title: "Guard AI - Advanced Security Solutions",
    description: "Guard AI offers cutting-edge AI-powered security for a safer future.",
    images: [
      "https://github.com/Hiteshydv001/Guard-AI/raw/main/demo/guard_eye_logo.png",
    ],
  },
};

export default function Home() {
  return (
    <>
      <div className="space-y-16">
        <HeroSection />
        <SponsorsSection />
        <BenefitsSection />
        <FeaturesSection />
        <ServicesSection />
        <TestimonialSection />
        <TeamSection />
        <CommunitySection />
        <PricingSection />
        <ContactSection />
        <FAQSection />
      </div>
      <FooterSection />
    </>
  );
}


