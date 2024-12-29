import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { icons } from "lucide-react";

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
      <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
        Features
      </h2>

      <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
        What Makes Guard AI Different
      </h2>

      <h3 className="md:w-1/2 mx-auto text-xl text-center text-muted-foreground mb-8">
        Guard AI revolutionizes remote assessments with AI-driven proctoring to ensure secure, fair, and accurate exams. Experience integrity like never before.
      </h3>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {featureList.map(({ icon, title, description }) => (
          <div key={title}>
            <Card className="h-full bg-background border-0 shadow-none">
              <CardHeader className="flex justify-center items-center">
                <div className="bg-primary/20 p-2 rounded-full ring-8 ring-primary/10 mb-4">
                  <Icon
                    name={icon as keyof typeof icons}
                    size={24}
                    color="hsl(var(--primary))"
                    className="text-primary"
                  />
                </div>

                <CardTitle>{title}</CardTitle>
              </CardHeader>

              <CardContent className="text-muted-foreground text-center">
                {description}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </section>
  );
};
