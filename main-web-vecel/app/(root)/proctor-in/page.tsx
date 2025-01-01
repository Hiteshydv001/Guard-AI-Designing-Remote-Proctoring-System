"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Lottie from "lottie-react";
import animationData from "@/public/proctor-animation.json"; // Replace with the correct path to your JSON file

const ProctorPage = () => {
  const router = useRouter();

  return (
    <section className="container w-full">
      <div className="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto py-20 md:py-32">
        <div className="text-center space-y-8">
          <Badge variant="outline" className="text-sm py-2">
            <span className="mr-2 text-primary">
              <Badge>Proctor</Badge>
            </span>
            <span> Securely manage candidate check-ins with Guard AI</span>
          </Badge>

          <div className="max-w-screen-md mx-auto text-center text-4xl md:text-6xl font-bold">
            <h1>
              Monitor with precision using
              <span className="text-transparent px-2 bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
                Guard AI Proctor
              </span>
            </h1>
          </div>

          <p className="max-w-screen-sm mx-auto text-xl text-muted-foreground">
            {`Guard AI Proctor enables you to seamlessly monitor and manage candidate check-ins with a high level of security and precision.
            Experience the future of secure digital check-ins and ensure the integrity of your assessments.`}
          </p>

          <div className="space-y-4 md:space-y-0 md:space-x-4 pt-8">
            <Button
              onClick={() => router.push("/proctor-in")}
              className="w-5/6 md:w-1/4 font-bold group/arrow"
            >
              Start Proctoring Now
              <ArrowRight className="size-5 ml-2 group-hover/arrow:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>

        <div className="relative group mt-14">
          <div className="absolute top-2 lg:-top-8 left-1/2 transform -translate-x-1/2 w-[90%] mx-auto h-20 lg:h-40 bg-primary/50 rounded-full blur-3xl"></div>
          <div className="w-full md:w-[800px] mx-auto h-[400px]">
            <Lottie
              animationData={animationData}
              loop={true}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="absolute bottom-0 left-0 w-full h-16 md:h-20 bg-gradient-to-b from-background/0 via-background/50 to-background rounded-lg"></div>
        </div>
      </div>
    </section>
  );
};

export default ProctorPage;
