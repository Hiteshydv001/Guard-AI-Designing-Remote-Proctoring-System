"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { FooterSection } from "@/components/layout/sections/footer";
import {
  useTabSwitchingAlert,
  useProctoringAlert,
} from "@/components/layout/usealert";
import Image from "next/image"; // Import Image from next/image
import TabSwitchPopup from "@/components/layout/tabswitchpopup";

// Monitor tab switching and display an alert
export default function Page() {
  const router = useRouter();
  const [isProctoringActive, setIsProctoringActive] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(0);
  const [pupilDistance, setPupilDistance] = useState<string>("N/A");
  const [gazeDirection, setGazeDirection] = useState<string>("N/A");

  // Use the tab switching alert hook
  const alertMessage = useTabSwitchingAlert();
  // Use the proctoring alert hook
  const proctoringAlertMessage = useProctoringAlert(isProctoringActive);

  useEffect(() => {
    const interval = setInterval(() => {
      setPupilDistance("10 cm");
      setGazeDirection("Looking right");
    }, 1000);

    return () => {
      clearInterval(interval);
    };
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

  const { isPopupVisible, setPopupVisible, switchCount, timeAway } = useTabSwitchingAlert();

  const handleDismissPopup = () => {
    setPopupVisible(false);
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
              <span> Guard AI: The future of security is here!</span>{" "}
              {/* Escaped quotes */}
            </Badge>

            <h1 className="text-4xl md:text-6xl font-bold">
              Ready to
              <span className="text-transparent px-2 bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
                Start Your
              </span>
              Exam
            </h1>

            <p className="text-xl text-muted-foreground">
              Guard AI isn&apos;t just another security solution; it&apos;s a
              smart, AI-powered system that evolves with your needs. Protect
              your digital assets, enhance your security, and get real-time
              insights like never before. AND GIVE
            </p>

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
      </section>

      <section className="container w-full">
        <div className="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto py-20 md:py-32">
          <Card className="max-w-[800px] w-full shadow-lg rounded-2xl">
                  {isPopupVisible && (
                <TabSwitchPopup 
                  onDismiss={handleDismissPopup}
                  switchCount={switchCount}
                  timeAway={timeAway}
                />
              )}

            <CardContent>
              <div className="camera-feed-container w-full bg-black rounded-xl shadow-xl">
                <Image
                  className="w-full h-auto rounded-lg mt-10"
                  src="/video_feed"
                  alt="Webcam Feed"
                  width={640} // specify width
                  height={480} // specify height
                />
              </div>
              <div className="mt-6 p-6 rounded-xl shadow-xl light:bg-white">
                <h2 className="text-lg font-semibold mb-4">Gaze Information</h2>
                <p className="text-sm">Pupil Distance: {pupilDistance}</p>
                <p className="text-sm">Gaze Direction: {gazeDirection}</p>
              </div>

              {/* Add Timer Section Below Gaze Information */}
              {isProctoringActive && (
                <div className="mt-6 p-6 rounded-xl shadow-xl light:bg-white">
                  <h2 className="text-lg font-semibold mb-4">Proctoring Timer</h2>
                  <p className="text-sm">Timer: {timer}s</p>
                </div>
              )}
            </CardContent>

            <Separator />
            <CardFooter className="flex flex-wrap gap-6 justify-center mt-8">
              {!isProctoringActive ? (
                <Button
                  onClick={startProctoringSession}
                  className="font-bold rounded-full px-6 py-3 transition-all transform hover:scale-105"
                >
                  Start Proctoring
                  <ArrowRight className="ml-2 transition-transform" />
                </Button>
              ) : (
                <Button
                  onClick={stopProctoringSession}
                  className="font-bold rounded-full px-6 py-3 transition-all transform hover:scale-105"
                >
                  Stop Proctoring
                  <ArrowRight className="ml-2 transition-transform" />
                </Button>
              )}
              <Button
                onClick={() => router.push("/")}
                className="font-bold rounded-full px-6 py-3 transition-all transform hover:scale-105"
              >
                Go to Main Page
                <ArrowRight className="ml-2 transition-transform" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      <FooterSection />
    </>
  );
}
