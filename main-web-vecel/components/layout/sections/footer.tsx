import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import Image from "next/image";

export const FooterSection = () => {
  return (
    <footer id="footer" className="container py-24 sm:py-32">
      <div className="p-10 bg-card border border-secondary rounded-2xl">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-12 gap-y-8">
          <div className="col-span-full xl:col-span-2">
            <Link href="#" className="flex font-bold items-center">
              <Image
                src="https://github.com/Hiteshydv001/Guard-AI/raw/main/demo/guard_eye_logo.png"
                alt="Guard AI Logo"
                width={48}
                height={48}
                className="mr-2 rounded-md"
              />
              <h3 className="text-2xl">Guard AI</h3>
            </Link>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-lg">Contact</h3>
            <div>
              <Link
                href="https://github.com/Hiteshydv001/Guard-AI.git"
                className="opacity-60 hover:opacity-100"
                target="_blank"
              >
                Github
              </Link>
            </div>
            <div>
              <Link
                href="https://x.com/Hitesh_0003"
                className="opacity-60 hover:opacity-100"
                target="_blank"
              >
                Twitter
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-lg">Platforms</h3>
            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                iOS
              </Link>
            </div>
            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Android
              </Link>
            </div>
            <div>
              <Link href="#" className="opacity-60 hover:opacity-100">
                Web
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-lg">Help</h3>
            <div>
              <Link href="#contact" className="opacity-60 hover:opacity-100">
                Contact Us
              </Link>
            </div>
            <div>
              <Link href="#faq" className="opacity-60 hover:opacity-100">
                FAQ
              </Link>
            </div>
            <div>
              <Link
                href="https://docs.google.com/forms/d/e/1FAIpQLSdqqOSG82asLvwYaL6YfR35y2m6t_x_j7SHeS3W4636mzM-oQ/viewform?usp=dialog"
                className="opacity-60 hover:opacity-100"
                target="_blank"
              >
                Feedback
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-lg">Socials</h3>
            <div>
              <Link
                href="https://github.com/Hiteshydv001/Guard-AI.git"
                className="opacity-60 hover:opacity-100"
              >
                Github
              </Link>
            </div>
            <div>
              <Link
                href="https://discord.gg/pBasetQn"
                className="opacity-60 hover:opacity-100"
              >
                Discord
              </Link>
            </div>
          </div>
        </div>

        <Separator className="my-6" />
        <section className="">
          <h3 className="">
            &copy; 2024 Designed and developed by
            <Link
              target="_blank"
              href="https://github.com/Hiteshydv001/Guard-AI.git"
              className="text-primary transition-all border-primary hover:border-b-2 ml-1"
            >
              Guard AI
            </Link>
          </h3>
        </section>
      </div>
    </footer>
  );
};
