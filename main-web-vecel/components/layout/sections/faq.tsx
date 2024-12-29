import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FAQProps {
  question: string;
  answer: string;
  value: string;
}

const FAQList: FAQProps[] = [
  {
    question: "What is Guard AI?",
    answer:
      "Guard AI is an advanced AI-driven proctoring solution designed to ensure secure and fair remote assessments, leveraging real-time integrity checks, facial recognition, and anomaly detection.",
    value: "item-1",
  },
  {
    question: "How does Guard AI detect cheating?",
    answer:
      "Guard AI uses facial recognition, motion detection, and AI-powered anomaly detection to monitor candidates during assessments and identify any suspicious behavior.",
    value: "item-2",
  },
  {
    question: "Is Guard AI compatible with mobile devices?",
    answer:
      "Yes, Guard AI is fully mobile-friendly, ensuring seamless proctoring on smartphones and tablets, enabling remote monitoring anytime, anywhere.",
    value: "item-3",
  },
  {
    question: "How can I contribute to the Guard AI project?",
    answer:
      "To contribute to Guard AI, visit our GitHub repository. You can submit issues, suggest features, or fork the project and create a pull request with your improvements. We welcome contributions from developers and AI enthusiasts.",
    value: "item-4",
  },
  {
    question: "Where can I find the Guard AI GitHub repository?",
    answer:
      "You can find the Guard AI GitHub repository at [GitHub Link]. Explore the code, open issues, or start contributing to the project by forking and creating pull requests.",
    value: "item-5",
  },
];

export const FAQSection = () => {
  return (
    <section id="faq" className="container md:w-[700px] py-24 sm:py-32">
      <div className="text-center mb-8">
        <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
          FAQs
        </h2>

        <h2 className="text-3xl md:text-4xl text-center font-bold">
          Common Questions about Guard AI
        </h2>
      </div>

      <Accordion type="single" collapsible className="AccordionRoot">
        {FAQList.map(({ question, answer, value }) => (
          <AccordionItem key={value} value={value}>
            <AccordionTrigger className="text-left">
              {question}
            </AccordionTrigger>

            <AccordionContent>{answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};
