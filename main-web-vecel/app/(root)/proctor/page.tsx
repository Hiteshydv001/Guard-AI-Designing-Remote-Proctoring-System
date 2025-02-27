// "use client";

// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import { ArrowRight } from "lucide-react";
// import { useRouter } from "next/navigation";
// import dynamic from "next/dynamic";

// // Dynamically import the Lottie component with SSR disabled
// const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
// import animationData from "@/public/proctor-animation.json"; // Replace with the correct path to your JSON file

// const ProctorPage = () => {
//   const router = useRouter();

//   return (
//     <section className="container w-full">
//       <div className="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto py-20 md:py-32">
//         <div className="text-center space-y-8">
//           <Badge variant="outline" className="text-sm py-2">
//             <span className="mr-2 text-primary">
//               <Badge>Proctor</Badge>
//             </span>
//             <span> Securely manage candidate check-ins with Guard AI</span>
//           </Badge>

//           <div className="max-w-screen-md mx-auto text-center text-4xl md:text-6xl font-bold">
//             <h1>
//               Monitor with precision using
//               <span className="text-transparent px-2 bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
//                 Guard AI Proctor
//               </span>
//             </h1>
//           </div>

//           <p className="max-w-screen-sm mx-auto text-xl text-muted-foreground">
//             {`Guard AI Proctor enables you to seamlessly monitor and manage candidate check-ins with a high level of security and precision.
//             Experience the future of secure digital check-ins and ensure the integrity of your assessments.`}
//           </p>

//           <div className="space-y-4 md:space-y-0 md:space-x-4 pt-8">
//             <Button
//               onClick={() => router.push("/proctor-in")}
//               className="w-5/6 md:w-1/4 font-bold group/arrow"
//             >
//               Start Proctoring Now
//               <ArrowRight className="size-5 ml-2 group-hover/arrow:translate-x-1 transition-transform" />
//             </Button>
//           </div>
//         </div>

//         <div className="relative group mt-14">
//           <div className="absolute top-2 lg:-top-8 left-1/2 transform -translate-x-1/2 w-[90%] mx-auto h-20 lg:h-40 bg-primary/50 rounded-full blur-3xl"></div>
//           <div className="w-full md:w-[800px] mx-auto h-[400px]">
//             <Lottie
//               animationData={animationData}
//               loop={true}
//               className="w-full h-full object-contain"
//             />
//           </div>
//           <div className="absolute bottom-0 left-0 w-full h-16 md:h-20 bg-gradient-to-b from-background/0 via-background/50 to-background rounded-lg"></div>
//         </div>
//       </div>
//     </section>
//   );
// };

// export default ProctorPage;


"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  Users,
  Video,
  Activity,
  MoreVertical,
  LayoutDashboard,
  Monitor,
  Bell,
  Settings,
  Maximize2,
  MessageSquare,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useRef } from "react";

const tabs = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "monitoring",
    label: "Live Monitoring",
    icon: Monitor,
  },
  {
    id: "alerts",
    label: "Alerts",
    icon: Bell,
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
  },
];

export default function ProctorDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedView, setSelectedView] = useState<"grid" | "featured">("grid");

  const renderDashboardContent = () => (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h3 className="text-sm font-medium">Active Students</h3>
              <p className="text-2xl font-bold">24</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <h3 className="text-sm font-medium">Alerts</h3>
              <p className="text-2xl font-bold">3</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Video className="h-8 w-8 text-primary" />
            <div>
              <h3 className="text-sm font-medium">Active Sessions</h3>
              <p className="text-2xl font-bold">12</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <h3 className="text-sm font-medium">System Status</h3>
              <p className="text-sm font-medium text-green-500">All Systems Normal</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  //Receive and display the candidate's stream.
  const ProctorStream = () => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const peer = new RTCPeerConnection();
        peer.ontrack = (event) => {
            if (videoRef.current) videoRef.current.srcObject = event.streams[0];
        };
    }, []);

    return (
        <div>
            <h2>Proctor View</h2>
            <video ref={videoRef} autoPlay playsInline className="w-full h-auto" />
        </div>
    );
};

export default ProctorStream;
  
  const renderMonitoringContent = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Live Monitoring</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoring {selectedView === "grid" ? "12" : "1"} active sessions
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant={selectedView === "grid" ? "default" : "outline"}
            onClick={() => setSelectedView("grid")}
          >
            Grid View
          </Button>
          <Button
            variant={selectedView === "featured" ? "default" : "outline"}
            onClick={() => setSelectedView("featured")}
          >
            Featured View
          </Button>
        </div>
      </div>

      {selectedView === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="relative aspect-video bg-muted">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Video className="h-12 w-12 text-muted-foreground/20" />
                </div>
                {i === 2 && (
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 text-xs font-medium bg-destructive text-destructive-foreground rounded-full">
                      Alert
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Student {i + 1}</h4>
                    <p className="text-sm text-muted-foreground">Mathematics Exam</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedView("featured")}>
                        <Maximize2 className="h-4 w-4 mr-2" />
                        View Fullscreen
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Send Warning
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Ban className="h-4 w-4 mr-2" />
                        End Session
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-2 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Time Remaining: 1h 45m</span>
                    <span>Progress: 65%</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="relative aspect-video bg-muted">
            <div className="absolute inset-0 flex items-center justify-center">
              <Video className="h-24 w-24 text-muted-foreground/20" />
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Student 3</h3>
                <p className="text-muted-foreground">Mathematics Exam</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Warning
                </Button>
                <Button variant="destructive" size="sm">
                  <Ban className="h-4 w-4 mr-2" />
                  End Session
                </Button>
              </div>
            </div>
            <div className="mt-4 grid gap-4">
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Time Elapsed</h4>
                  <p className="text-2xl font-bold">1h 15m</p>
                </Card>
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Warnings</h4>
                  <p className="text-2xl font-bold">2</p>
                </Card>
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Progress</h4>
                  <p className="text-2xl font-bold">65%</p>
                </Card>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  const renderAlertsContent = () => (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Recent Alerts</h2>
      <div className="space-y-4">
        {[1, 2, 3].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <div className="flex-1">
              <h4 className="font-medium">Multiple faces detected</h4>
              <p className="text-sm text-muted-foreground">Student 4 - Mathematics Exam</p>
            </div>
            <Button variant="outline" size="sm">Review</Button>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderSettingsContent = () => (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Settings</h2>
      <div className="space-y-4">
        <p className="text-muted-foreground">System settings and preferences will appear here.</p>
      </div>
    </Card>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return renderDashboardContent();
      case "monitoring":
        return renderMonitoringContent();
      case "alerts":
        return renderAlertsContent();
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