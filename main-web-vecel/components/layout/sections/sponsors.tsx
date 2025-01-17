"use client";

import { Marquee } from "@devnomic/marquee";
import "@devnomic/marquee/dist/index.css";

interface sponsorsProps {
  logoUrl: string;
  name: string;
  altText: string;
}

const sponsors: sponsorsProps[] = [
  {
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/91/Octicons-mark-github.svg", // GitHub logo
    name: "GitHub",
    altText: "GitHub Logo",
  },
  {
    logoUrl: "https://www.socialwinterofcode.com/static/media/favicon-logo-2.633feaf5.png", // SWOC logo (replace with the correct one if available)
    name: "SWOC",
    altText: "SWOC Logo",
  },
  // You can add more sponsors here if needed
];

export const SponsorsSection = () => {
  return (
    <section id="sponsors" className="max-w-[75%] mx-auto pb-24 sm:pb-32">
      <h2 className="text-lg md:text-xl text-center mb-6">
        Our Sponsors
      </h2>

      <div className="mx-auto">
        <Marquee
          className="gap-[4rem]" // Increased gap between logos
          fade
          innerClassName="gap-[4rem]" // Increased gap between logos
          pauseOnHover
        >
          {sponsors.map(({ logoUrl, name, altText }) => (
            <div
              key={name}
              className="flex items-center text-xl md:text-2xl font-medium"
            >
              <img
                src={logoUrl}
                alt={altText}
                className="mr-4 h-10" // Space and size adjustment for the logos
              />
              {name}
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
};