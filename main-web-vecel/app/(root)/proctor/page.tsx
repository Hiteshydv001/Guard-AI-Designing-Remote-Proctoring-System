"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

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
      </div>
    </section>
  );
};

export default ProctorPage;
