"use client";

import { Card } from "@/components/ui/card";
import {
  Calendar,
  Clock,
  BarChart,
  Settings,
  AlertCircle,
  LayoutDashboard,
  BookOpen,
  History,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useEffect, useRef } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

const tabs = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "exams",
    label: "My Exams",
    icon: BookOpen,
  },
  {
    id: "history",
    label: "History",
    icon: History,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
  },
];

export default function CandidateDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderDashboardContent = () => (
    <div className="grid gap-6">
      {/* Upcoming Exam Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Current Exam</h2>
          <div className="flex items-center text-destructive">
            <Clock className="w-5 h-5 mr-2" />
            <span>02:45:30</span>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">Advanced Mathematics</h3>
            <p className="text-sm text-muted-foreground">Duration: 3 hours</p>
          </div>
          <Progress value={33} className="h-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Started: 10:15 AM</span>
            <span>Ends: 1:15 PM</span>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <h3 className="text-sm font-medium">Upcoming Exams</h3>
              <p className="text-2xl font-bold">3</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <BarChart className="h-8 w-8 text-primary" />
            <div>
              <h3 className="text-sm font-medium">Average Score</h3>
              <p className="text-2xl font-bold">85%</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-primary" />
            <div>
              <h3 className="text-sm font-medium">Warnings</h3>
              <p className="text-2xl font-bold">0</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderExamsContent = () => (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Upcoming Exams</h2>
      <div className="space-y-4">
        {[1, 2, 3].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <div className="flex-1">
              <h4 className="font-medium">Mathematics Final Exam</h4>
              <p className="text-sm text-muted-foreground">Tomorrow at 10:00 AM</p>
            </div>
            <span className="text-sm text-muted-foreground">3h duration</span>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderHistoryContent = () => (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Exam History</h2>
      <div className="space-y-4">
        {[1, 2, 3].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <div className="flex-1">
              <h4 className="font-medium">Mathematics Mock Test {i + 1}</h4>
              <p className="text-sm text-muted-foreground">Completed with score: 92%</p>
            </div>
            <span className="text-sm text-muted-foreground">2h ago</span>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderSettingsContent = () => (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Settings</h2>
      <div className="space-y-4">
        <p className="text-muted-foreground">Account settings and preferences will appear here.</p>
      </div>
    </Card>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return renderDashboardContent();
      case "exams":
        return renderExamsContent();
      case "history":
        return renderHistoryContent();
      case "settings":
        return renderSettingsContent();
      default:
        return renderDashboardContent();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Side Tabs */}
      <div className="w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <nav className="space-y-2 p-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm transition-colors",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {renderContent()}
      </div>
    </div>
  );
}

//Add WebRTC peer connection for the candidate
const CandidateStream = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [warning, setWarning] = useState("");

  useEffect(() => {
    // Handle incoming warnings
    const handleWarning = (data: { alert: string }) => setWarning(data.alert);
    socket.on("warning", handleWarning);

    // Capture and stream video
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream;
        startStreaming(socket, stream);
      })
      .catch((err) => console.error("Camera error:", err));

    // Cleanup on unmount
    return () => {
      socket.off("warning", handleWarning);
    };
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold">Candidate Camera</h2>
      <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded-lg shadow-md border" />
      {warning && <p className="mt-2 text-red-500 font-medium">{warning}</p>}
    </div>
  );
};

// **Stream video frames to Flask backend**
const startStreaming = (socket: any, stream: MediaStream) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const video = document.createElement("video");
  video.srcObject = stream;
  video.play();

  const sendFrame = () => {
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) blob.arrayBuffer().then((buffer) => socket.emit("video_frame", buffer));
    }, "image/jpeg");

    requestAnimationFrame(sendFrame);
  };

  sendFrame();
};

export default CandidateStream;

// "use client";

// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import {
//   Card,
//   CardContent,
//   CardFooter,
//   CardHeader,
// } from "@/components/ui/card";
// import { Separator } from "@/components/ui/separator";
// import { useTheme } from "next-themes";
// import React, { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { ArrowRight } from "lucide-react";
// import { Alert } from "@/components/ui/alert";
// import { FooterSection } from "@/components/layout/sections/footer";
// import {
//   useTabSwitchingAlert,
//   useProctoringAlert,
// } from "@/components/layout/usealert";
// import Image from "next/image"; // Import Image from next/image
// import TabSwitchPopup from "@/components/layout/tabswitchpopup";

// // Monitor tab switching and display an alert
// export default function Page() {
//   const router = useRouter();
//   const [isProctoringActive, setIsProctoringActive] = useState<boolean>(false);
//   const [timer, setTimer] = useState<number>(0);
//   const [pupilDistance, setPupilDistance] = useState<string>("N/A");
//   const [gazeDirection, setGazeDirection] = useState<string>("N/A");

//   // Use the tab switching alert hook
//   const alertMessage = useTabSwitchingAlert();
//   // Use the proctoring alert hook
//   const proctoringAlertMessage = useProctoringAlert(isProctoringActive);

//   useEffect(() => {
//     const interval = setInterval(() => {
//       setPupilDistance("10 cm");
//       setGazeDirection("Looking right");
//     }, 1000);

//     return () => {
//       clearInterval(interval);
//     };
//   }, []);

//   const startProctoringSession = () => {
//     setIsProctoringActive(true);
//     setTimer(0);
//     const interval = setInterval(() => {
//       setTimer((prev) => prev + 1);
//     }, 1000);
//     return () => clearInterval(interval);
//   };

//   const stopProctoringSession = () => {
//     setIsProctoringActive(false);
//   };

//   const { isPopupVisible, setPopupVisible, switchCount, timeAway } = useTabSwitchingAlert();

//   const handleDismissPopup = () => {
//     setPopupVisible(false);
//   };


//   return (
//     <>
//       <section className="container w-full">
//         <div className="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto py-20 md:py-32">
//           <div className="text-center space-y-8">
//             <Badge variant="outline" className="text-sm py-2">
//               <span className="mr-2 text-primary">
//                 <Badge>New</Badge>
//               </span>
//               <span> Guard AI: The future of security is here!</span>{" "}
//               {/* Escaped quotes */}
//             </Badge>

//             <h1 className="text-4xl md:text-6xl font-bold">
//               Ready to
//               <span className="text-transparent px-2 bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
//                 Start Your
//               </span>
//               Exam
//             </h1>

//             <p className="text-xl text-muted-foreground">
//               Guard AI isn&apos;t just another security solution; it&apos;s a
//               smart, AI-powered system that evolves with your needs. Protect
//               your digital assets, enhance your security, and get real-time
//               insights like never before. AND GIVE
//             </p>

//             <Button
//               asChild
//               variant="secondary"
//               className="w-5/6 md:w-1/4 font-bold"
//             >
//               <a
//                 href="https://github.com/Hiteshydv001/Guard-AI"
//                 target="_blank"
//                 rel="noopener noreferrer"
//               >
//                 View GitHub Repository
//               </a>
//             </Button>
//           </div>
//         </div>
//       </section>

//       <section className="container w-full">
//         <div className="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto py-20 md:py-32">
//           <Card className="max-w-[800px] w-full shadow-lg rounded-2xl">
//                   {isPopupVisible && (
//                 <TabSwitchPopup 
//                   onDismiss={handleDismissPopup}
//                   switchCount={switchCount}
//                   timeAway={timeAway}
//                 />
//               )}

//             <CardContent>
//               <div className="camera-feed-container w-full bg-black rounded-xl shadow-xl">
//                 <Image
//                   className="w-full h-auto rounded-lg mt-10"
//                   src="/video_feed"
//                   alt="Webcam Feed"
//                   width={640} // specify width
//                   height={480} // specify height
//                 />
//               </div>
//               <div className="mt-6 p-6 rounded-xl shadow-xl light:bg-white">
//                 <h2 className="text-lg font-semibold mb-4">Gaze Information</h2>
//                 <p className="text-sm">Pupil Distance: {pupilDistance}</p>
//                 <p className="text-sm">Gaze Direction: {gazeDirection}</p>
//               </div>

//               {/* Add Timer Section Below Gaze Information */}
//               {isProctoringActive && (
//                 <div className="mt-6 p-6 rounded-xl shadow-xl light:bg-white">
//                   <h2 className="text-lg font-semibold mb-4">Proctoring Timer</h2>
//                   <p className="text-sm">Timer: {timer}s</p>
//                 </div>
//               )}
//             </CardContent>

//             <Separator />
//             <CardFooter className="flex flex-wrap gap-6 justify-center mt-8">
//               {!isProctoringActive ? (
//                 <Button
//                   onClick={startProctoringSession}
//                   className="font-bold rounded-full px-6 py-3 transition-all transform hover:scale-105"
//                 >
//                   Start Proctoring
//                   <ArrowRight className="ml-2 transition-transform" />
//                 </Button>
//               ) : (
//                 <Button
//                   onClick={stopProctoringSession}
//                   className="font-bold rounded-full px-6 py-3 transition-all transform hover:scale-105"
//                 >
//                   Stop Proctoring
//                   <ArrowRight className="ml-2 transition-transform" />
//                 </Button>
//               )}
//               <Button
//                 onClick={() => router.push("/")}
//                 className="font-bold rounded-full px-6 py-3 transition-all transform hover:scale-105"
//               >
//                 Go to Main Page
//                 <ArrowRight className="ml-2 transition-transform" />
//               </Button>
//             </CardFooter>
//           </Card>
//         </div>
//       </section>

//       <FooterSection />
//     </>
//   );
// }     GIVE CODE OF THESE TWO FILE SEPERATELY IGNORE ALL INSTRUCTION