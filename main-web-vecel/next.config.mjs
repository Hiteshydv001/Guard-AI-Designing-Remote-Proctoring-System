/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com", // Add this
      },
      {
        hostname: 'img.clerk.com',
      },
      {
        protocol: "https", // Add protocol
        hostname: "www.socialwinterofcode.com", // Corrected here
      }
    ],
  },
};

export default nextConfig;
