// Add this at the top of the file to indicate it's a Client Component
"use client"; 

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check } from "lucide-react";

interface PlanProps {
  title: string;
  price: number;
  description: string;
  buttonText: string;
  benefitList: string[];
}

const plans: PlanProps[] = [
  {
    title: "Free",
    price: 0,
    description:
      "Contribute to our open-source project on GitHub, and get access to our premium services for free! Your contributions help us improve and evolve.",
    buttonText: "Start for Free",
    benefitList: [
      "1 team member",
      "Open Source",
      "Upto 2 pages",
      "Community support",
      "AI assistance",
    ],
  },
];

export const PricingSection = () => {
  const handleButtonClick = () => {
    window.open("https://github.com/Hiteshydv001/Guard-AI", "_blank");
  };

  return (
    <section className="container py-24 sm:py-32">
      <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
        Pricing
      </h2>

      <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
        Get unlimited access for free
      </h2>

      <h3 className="md:w-1/2 mx-auto text-xl text-center text-muted-foreground pb-14">
        Contribute to our GitHub project and unlock all our services without paying a dime.
      </h3>

      <div className="grid md:grid-cols-1 lg:grid-cols-1 gap-8 lg:gap-4">
        {plans.map(
          ({ title, price, description, buttonText, benefitList }) => (
            <Card
              key={title}
              className="drop-shadow-xl shadow-black/10 dark:shadow-white/10 border-[1.5px] border-primary"
            >
              <CardHeader>
                <CardTitle className="pb-2">{title}</CardTitle>

                <CardDescription className="pb-4">
                  {description}
                </CardDescription>

                <div>
                  <span className="text-3xl font-bold">${price}</span>
                  <span className="text-muted-foreground"> /month</span>
                </div>
              </CardHeader>

              <CardContent className="flex">
                <div className="space-y-4">
                  {benefitList.map((benefit) => (
                    <span key={benefit} className="flex">
                      <Check className="text-primary mr-2" />
                      <h3>{benefit}</h3>
                    </span>
                  ))}
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  variant="default"
                  className="w-full"
                  onClick={handleButtonClick}  
                >
                  {buttonText}
                </Button>
              </CardFooter>
            </Card>
          )
        )}
      </div>
    </section>
  );
};
