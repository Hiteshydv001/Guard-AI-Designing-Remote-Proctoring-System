"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { icons } from "lucide-react";
import { motion } from "framer-motion"; // For animations

interface FeaturesProps {
  icon: string;
  title: string;
  description: string;
}

const featureList: FeaturesProps[] = [
  {
    icon: "TabletSmartphone",
    title: "Mobile Friendly",
    description:
      "Guard AI ensures a seamless experience for both administrators and candidates on mobile devices, enabling remote proctoring anytime, anywhere.",
  },
  {
    icon: "BadgeCheck",
    title: "Real-Time Integrity Checks",
    description:
      "Guard AI uses advanced AI algorithms to detect suspicious activities and ensure the integrity of assessments, providing real-time alerts.",
  },
  {
    icon: "Goal",
    title: "AI-Powered Proctoring",
    description:
      "Guard AI employs sophisticated facial recognition, motion detection, and anomaly detection to monitor candidates and detect potential cheating.",
  },
  {
    icon: "PictureInPicture",
    title: "Multi-View Support",
    description:
      "Guard AI offers multi-camera support to monitor both the candidate and their environment, ensuring a comprehensive assessment of any suspicious behavior.",
  },
  {
    icon: "MousePointerClick",
    title: "Instant Feedback",
    description:
      "Guard AI instantly provides feedback and flags for any detected violations during the assessment, ensuring immediate action is taken.",
  },
  {
    icon: "Newspaper",
    title: "Clear Reporting",
    description:
      "Guard AI generates clear and concise reports that highlight key insights and potential security threats, ensuring transparency in the assessment process.",
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="container py-24 sm:py-32">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <h2 className="text-lg font-semibold text-primary mb-3 tracking-wide uppercase">
          Features
        </h2>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-200 mb-6">
          What Makes Guard AI Different
        </h2>
        <h3 className="md:w-1/2 mx-auto text-lg md:text-xl text-gray-600 dark:text-gray-400">
          Guard AI revolutionizes remote assessments with AI-driven proctoring
          to ensure secure, fair, and accurate exams. Experience integrity like
          never before.
        </h3>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={{
          hidden: { opacity: 0, scale: 0.9 },
          visible: {
            opacity: 1,
            scale: 1,
            transition: { staggerChildren: 0.2 },
          },
        }}
      >
        {featureList.map(({ icon, title, description }, index) => (
          <motion.div
            key={title}
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: { opacity: 1, y: 0 },
            }}
            className="h-full"
          >
            <Card className="h-full bg-background border-0 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 rounded-lg">
              <CardHeader className="flex flex-col items-center text-center">
                <div className="bg-primary/20 p-4 rounded-full ring-8 ring-primary/10 mb-4 transition-transform duration-300 group-hover:rotate-6">
                  <Icon
                    name={icon as keyof typeof icons}
                    size={28}
                    color="hsl(var(--primary))"
                    className="text-primary"
                  />
                </div>
                <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-gray-600 dark:text-gray-400 text-center">
                {description}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};
