"use client";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FooterSection } from "@/components/layout/sections/footer";

export default function Page() {
  const router = useRouter();
  const [videoUrl, setVideoUrl] = useState<string>("/video_feed");
  const [isProctoringActive, setIsProctoringActive] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(0);
  const [pupilDistance, setPupilDistance] = useState<string>("N/A");
  const [gazeDirection, setGazeDirection] = useState<string>("N/A");

  useEffect(() => {
    setVideoUrl("http://localhost:5000/video_feed");
    const interval = setInterval(() => {
      setPupilDistance("10 cm");
      setGazeDirection("Looking right");
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const startProctoringSession = () => {
    setIsProctoringActive(true);
    setTimer(0);
    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  };

  const stopProctoringSession = () => {
    setIsProctoringActive(false);
  };

  return (
    <>
      <section className="container w-full">
        <div className="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto py-20 md:py-32">
          <div className="text-center space-y-8">
            <Badge variant="outline" className="text-sm py-2">
              <span className="mr-2 text-primary">
                <Badge>New</Badge>
              </span>
              <span> Guard AI: The future of security is here!</span>
            </Badge>

            <div className="max-w-screen-md mx-auto text-center text-4xl md:text-6xl font-bold">
              <h1>
                Ready to
                <span className="text-transparent px-2 bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
                  Start Your
                </span>
                Exam
              </h1>
            </div>

            <p className="max-w-screen-sm mx-auto text-xl text-muted-foreground">
              {`Guard AI isn't just another security solution; it's a smart, AI-powered system that evolves with your needs.
              Protect your digital assets, enhance your security, and get real-time insights like never before.`}
            </p>

            <div className="space-y-4 md:space-y-0 md:space-x-4">
              <Button
                asChild
                variant="secondary"
                className="w-5/6 md:w-1/4 font-bold"
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

          
        </div>
      </section>

  <section className="container w-full">
  <div className="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto py-20 md:py-32">
    <Card className="max-w-[800px] w-full light:bg-gray-100 shadow-lg rounded-2xl">
      <Separator className="my-4" />
      <CardContent>
        {isProctoringActive && (
          <div className="mb-4 text-lg">
            <p>Session Time: {timer}s</p>
          </div>
        )}
        <div className="camera-feed-container w-full bg-black rounded-xl shadow-xl">
          <img
            className="w-full h-auto rounded-lg"
            src={videoUrl}
            alt="Webcam Feed"
            width="640"
            height="480"
          />
        </div>
        <div className="mt-6 light:bg-white p-6 rounded-xl shadow-xl light:text-black">
          <h2 className="text-lg font-semibold mb-4">Gaze Information</h2>
          <p className="text-sm">Pupil Distance: {pupilDistance}</p>
          <p className="text-sm">Gaze Direction: {gazeDirection}</p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-6 justify-center mt-8">
        {!isProctoringActive ? (
          
          <Button
            onClick={startProctoringSession}
            className="font-bold light:bg-gray-300 text-black rounded-full px-6 py-3 transition-all transform hover:scale-105"
          >
            Start Proctoring
            <ArrowRight className="ml-2 transition-transform" />
          </Button>
        ) : (
          <Button
            onClick={stopProctoringSession}
            className="font-bold light:bg-gray-300 text-black rounded-full px-6 py-3  transition-all transform hover:scale-105"
          >
            Stop Proctoring
            <ArrowRight className="ml-2 transition-transform" />
          </Button>
        )}
        <Button
          onClick={() => router.push("/")}
          className="font-bold light:bg-gray-300 text-black rounded-full px-6 py-3 transition-all transform hover:scale-105"
        >
          Go to Main Page
          <ArrowRight className="ml-2 transition-transform" />
        </Button>
      </CardFooter>
    </Card>

    <Card className="mt-8 max-w-[640px] w-full light:bg-gray-100 rounded-2xl">
      <CardContent>
        <h2 className="text-lg font-semibold mb-4">Proctoring Status</h2>
        <p className="text-sm">
          Please ensure you are in a quiet environment with minimal distractions during the session.
        </p>
      </CardContent>
    </Card>
  </div>
</section>

      <FooterSection />
    </>
  );
}
