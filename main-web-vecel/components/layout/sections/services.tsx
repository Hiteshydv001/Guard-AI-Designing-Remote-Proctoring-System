import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ServiceProps {
  title: string;
  description: string;
}

const serviceList: ServiceProps[] = [
  {
    title: "AI-Powered Proctoring",
    description:
      "Utilize advanced AI algorithms to monitor exam integrity and prevent cheating in real-time.",
  },
  {
    title: "Facial Recognition Technology",
    description:
      "Secure and verify identity using facial recognition to ensure authorized access to exams.",
  },
  {
    title: "Automated Reporting & Analytics",
    description:
      "Generate automated reports with detailed analytics to assess student behavior during exams.",
  },
  {
    title: "Real-Time Monitoring",
    description:
      "Monitor candidates live during the exam to prevent any misconduct and provide immediate alerts.",
  },
];

export const ServicesSection = () => {
  return (
    <section id="services" className="container py-24 sm:py-32">
      <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
        Our Services
      </h2>

      <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
        Guard AI Proctoring Solutions
      </h2>
      <h3 className="md:w-1/2 mx-auto text-xl text-center text-muted-foreground mb-8">
        We provide cutting-edge AI-based proctoring tools that ensure a fair, secure, and reliable exam experience for both institutions and students.
      </h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4 w-full lg:w-[60%] mx-auto">
        {serviceList.map(({ title, description }) => (
          <Card
            key={title}
            className="bg-muted/60 dark:bg-card h-full relative"
          >
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
};
