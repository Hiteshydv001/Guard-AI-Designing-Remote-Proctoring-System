"use client";

import { Marquee } from "@devnomic/marquee";
import "@devnomic/marquee/dist/index.css";

interface Sponsor {
  logoUrl: string;
  name: string;
  altText: string;
}

const sponsors: Sponsor[] = [
  {
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/91/Octicons-mark-github.svg",
    name: "GitHub",
    altText: "GitHub Logo",
  },
  {
    logoUrl: "https://www.socialwinterofcode.com/static/media/favicon-logo-2.633feaf5.png",
    name: "SWOC",
    altText: "SWOC Logo",
  },
  // Add more sponsors here
];

export const SponsorsSection = () => {
  return (
    <section id="sponsors" className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 pb-24 sm:pb-32">
      <h2 className="text-center text-2xl sm:text-3xl font-bold mb-8 text-gray-800 dark:text-gray-200">
        Our Sponsors
      </h2>

      <div className="overflow-hidden">
        <Marquee
          className="gap-12" // Adjust the gap between logos
          fade
          innerClassName="gap-12"
          pauseOnHover
        >
          {sponsors.map(({ logoUrl, name, altText }) => (
            <div
              key={name}
              className="flex flex-col items-center justify-center text-center"
              style={{ width: "150px" }} // Ensures consistent sizing
            >
              <img
                src={logoUrl}
                alt={altText}
                className="h-12 sm:h-16 mb-3 object-contain"
                loading="lazy" // Improves performance
              />
              <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400 font-medium">
                {name}
              </span>
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
};
  