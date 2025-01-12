"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Star } from "lucide-react";

interface ReviewProps {
  image: string;
  name: string;
  comment: string;
  rating: number;
}

const reviewList: ReviewProps[] = [
  {
    image: "https://github.com/shadcn.png",
    name: "Emily Carter",
    comment:
      "Guard AI Proctoring System has been a game-changer for us. Its advanced features ensure a secure and seamless examination experience.",
    rating: 5.0,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "Michael Nguyen",
    comment:
      "The integration process was smooth, and the system's real-time monitoring capabilities are unmatched. It's a must-have for modern assessments.",
    rating: 4.9,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "Sophia Adams",
    comment:
      "Using Guard AI has significantly improved our exam credibility. The system is intuitive, and the analytics are incredibly detailed.",
    rating: 5.0,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "David Lee",
    comment:
      "Guard AI's robust anti-cheating mechanisms and user-friendly interface have made online exams stress-free for both instructors and students.",
    rating: 4.8,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "Olivia Johnson",
    comment:
      "The system has exceeded our expectations. Its scalability and reliability make it perfect for large-scale professional certifications.",
    rating: 5.0,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "Ethan Brown",
    comment:
      "Guard AI's AI-driven features have made remote assessments completely reliable. A perfect blend of innovation and security.",
    rating: 4.9,
  },
];

export const TestimonialSection = () => {
  return (
    <section className="w-full bg-slate-50 dark:bg-slate-900/50">
      <div className="container py-16 md:py-24">
        <div className="space-y-4 text-center mb-12">
          <h3 className="text-sm font-medium uppercase tracking-wider text-primary">
            Testimonials
          </h3>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            What Educators and Professionals Say
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Discover how Guard AI is transforming online assessments for institutions worldwide
          </p>
        </div>

        <Carousel
          opts={{
            align: "start",
          }}
          className="w-full max-w-6xl mx-auto"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {reviewList.map((review, index) => (
              <CarouselItem
                key={index}
                className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3"
              >
                <div className="h-full">
                  <Card className="h-full border-2 transition-colors hover:border-primary/20">
                    <CardContent className="p-6">
                      <div className="flex gap-1 mb-4">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.floor(review.rating)
                                ? "fill-primary text-primary"
                                : "fill-muted stroke-muted text-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-base leading-relaxed mb-6">
                        &quot;{review.comment}&quot;
                      </p>
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border-2 border-primary/20">
                          <AvatarImage
                            src={review.image}
                            alt={`${review.name}'s avatar`}
                          />
                          <AvatarFallback className="bg-primary/5">
                            {review.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold leading-none">
                            {review.name}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Verified User
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="flex justify-center gap-2 mt-8">
            <CarouselPrevious className="relative static" />
            <CarouselNext className="relative static" />
          </div>
        </Carousel>
      </div>
    </section>
  );
};

export default TestimonialSection;
