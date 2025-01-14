'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Lottie from "lottie-react";
import animation1 from "/Guard-AI-Designing-Remote-Proctoring-System/main-web-vecel/public/s1.json";
import animation2 from "/Guard-AI-Designing-Remote-Proctoring-System/main-web-vecel/public/s2.json";
import animation3 from "/Guard-AI-Designing-Remote-Proctoring-System/main-web-vecel/public/security-light.json";
import animation4 from "/Guard-AI-Designing-Remote-Proctoring-System/main-web-vecel/public/security-dark.json";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const animations = [animation1, animation2, animation3, animation4];

export const HeroSection = () => {
  const router = useRouter();
  const [currentAnimation, setCurrentAnimation] = useState(animations[0]);
  const [currentAnimationIndex, setCurrentAnimationIndex] = useState(0);

  useEffect(() => {
    // Loop animations and switch every 3 cycles
    let animationCycle = 0;
    const interval = setInterval(() => {
      animationCycle++;
      if (animationCycle > 2) {
        animationCycle = 0;
        setCurrentAnimationIndex((prevIndex) => (prevIndex + 1) % animations.length);
      }
    }, 5000); // Adjust duration if required
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCurrentAnimation(animations[currentAnimationIndex]);
  }, [currentAnimationIndex]);

  return (
    <div className="relative bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[80vh]">
          {/* Left Section */}
          <div className="lg:col-span-6 text-center lg:text-left">
            <Badge variant="outline" className="mb-6 px-3 py-1 text-lg">
              New Release
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              <span className="block">Guard AI:</span>
              <span className="block text-primary">The Future of Security</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-300">
              Guard AI is a cutting-edge security solution powered by artificial
              intelligence. Safeguard your digital assets and receive real-time
              insights that evolve with your needs.
            </p>
            <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-4">
              <Button
                onClick={() => router.push("/candidate")}
                className="w-full sm:w-auto"
                size="lg"
              >
                Candidate View
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button
                onClick={() => router.push("/proctor")}
                variant="outline"
                className="w-full sm:w-auto"
                size="lg"
              >
                Proctor View
              </Button>
              
              <Button
                asChild
                variant="secondary"
                className="w-full sm:w-auto"
                size="lg"
              >
                <a
                  href="https://github.com/Hiteshydv001/Guard-AI"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View GitHub Repository
                </a>
              </Button>

            </div>
          </div>

          {/* Right Section */}
          <div className="lg:col-span-6 flex justify-center items-center">
            {currentAnimation && (
              <div className="w-full max-w-lg h-[400px]">
                <Lottie
                  animationData={currentAnimation}
                  loop={3}
                  className="w-full h-full"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
