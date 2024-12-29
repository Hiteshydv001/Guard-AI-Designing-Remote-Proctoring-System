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
      "The integration process was smooth, and the system’s real-time monitoring capabilities are unmatched. It’s a must-have for modern assessments.",
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
      "Guard AI’s robust anti-cheating mechanisms and user-friendly interface have made online exams stress-free for both instructors and students.",
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
    <section id="testimonials" className="container py-24 sm:py-32">
      <div className="text-center mb-8">
        <h2 className="text-lg text-primary tracking-wider mb-2">
          Testimonials
        </h2>
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          What Educators and Professionals Say About Guard AI
        </h2>
      </div>

      <Carousel
        opts={{
          align: "start",
        }}
        className="relative w-[80%] sm:w-[90%] lg:max-w-screen-xl mx-auto"
      >
        <CarouselContent>
          {reviewList.map((review) => (
            <CarouselItem
              key={review.name}
              className="md:basis-1/2 lg:basis-1/3"
            >
              <Card className="bg-muted/50 dark:bg-card">
                <CardContent className="pt-6 pb-0">
                  <div className="flex gap-1 pb-6">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        className={`size-4 ${
                          index < Math.round(review.rating)
                            ? "fill-primary text-primary"
                            : "fill-muted text-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p>"{review.comment}"</p>
                </CardContent>

                <CardHeader>
                  <div className="flex flex-row items-center gap-4">
                    <Avatar>
                      <AvatarImage
                        src={review.image}
                        alt={`${review.name}'s avatar`}
                      />
                      <AvatarFallback>{review.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <CardTitle className="text-lg">{review.name}</CardTitle>
                      <CardDescription>User</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </section>
  );
};
