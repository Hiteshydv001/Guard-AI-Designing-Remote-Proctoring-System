import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { icons } from "lucide-react";

interface BenefitsProps {
  icon: string;
  title: string;
  description: string;
}

const benefitList: BenefitsProps[] = [
  {
    icon: "ShieldCheck",
    title: "Enhance Security",
    description:
      "Guard AI's robust monitoring system ensures a secure environment for online assessments, protecting both students and institutions from cheating and fraud.",
  },
  {
    icon: "BarChart",
    title: "Increase Trustworthiness",
    description:
      "With AI-driven proctoring, Guard AI helps build trust by providing accurate, real-time monitoring and reporting of online exams.",
  },
  {
    icon: "TrendingUp",
    title: "Boost Performance",
    description:
      "Guard AI's intelligent algorithms allow for more efficient proctoring, resulting in faster, more accurate assessments and improved performance.",
  },
  {
    icon: "Users",
    title: "Improve User Experience",
    description:
      "With seamless integration and a user-friendly interface, Guard AI enhances the experience for both examiners and examinees, making online assessments smoother and more reliable.",
  },
];

export const BenefitsSection = () => {
  return (
    <section id="benefits" className="container py-24 sm:py-32">
      <div className="grid lg:grid-cols-2 place-items-center lg:gap-24">
        <div>
          <h2 className="text-lg text-primary mb-2 tracking-wider">Benefits</h2>

          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Your Shortcut to Secure and Smart Online Assessments
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Guard AI is redefining the future of online exams by ensuring
            security, boosting trust, and delivering seamless experiences for
            both institutions and students.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 w-full">
          {benefitList.map(({ icon, title, description }, index) => (
            <Card
              key={title}
              className="bg-muted/50 dark:bg-card hover:bg-background transition-all delay-75 group/number"
            >
              <CardHeader>
                <div className="flex justify-between">
                  <Icon
                    name={icon as keyof typeof icons}
                    size={32}
                    color="hsl(var(--primary))"
                    className="mb-6 text-primary"
                  />
                  <span className="text-5xl text-muted-foreground/15 font-medium transition-all delay-75 group-hover/number:text-muted-foreground/30">
                    0{index + 1}
                  </span>
                </div>

                <CardTitle>{title}</CardTitle>
              </CardHeader>

              <CardContent className="text-muted-foreground">
                {description}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
