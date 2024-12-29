import GithubIcon from "@/components/icons/github-icon";
import LinkedInIcon from "@/components/icons/linkedin-icon";
import XIcon from "@/components/icons/x-icon";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";

interface TeamProps {
  imageUrl: string;
  firstName: string;
  lastName: string;
  positions: string[];
  socialNetworks: SocialNetworkProps[];
}

interface SocialNetworkProps {
  name: string;
  url: string;
}

export const TeamSection = () => {
  const teamList: TeamProps[] = [
    {
      imageUrl: "https://avatars.githubusercontent.com/u/114931638?v=4",
      firstName: "Hitesh",
      lastName: "Kumar",
      positions: ["Data Scientist", "ML / AI/ GenAI/ DL"],
      socialNetworks: [
        { name: "LinkedIn", url: "https://www.linkedin.com/in/hitesh-kumar-aiml/" },
        { name: "Github", url: "https://github.com/Hiteshydv001" },
        { name: "X", url: "https://x.com/Hitesh_0003" },
      ],
    },

    {
      imageUrl: "https://avatars.githubusercontent.com/u/176273975?v=4",
      firstName: "Mohd",
      lastName: "Mashruf",
      positions: ["Full Stack Web developer", "Java"],
      socialNetworks: [
        { name: "LinkedIn", url: "https://www.linkedin.com/in/mohammad-mashruf-324490252/" },
        { name: "Github", url: "https://github.com/MohammadMashruf" },
      ],
    },

    {
      imageUrl: "https://avatars.githubusercontent.com/u/179235293?v=4",
      firstName: "Chander",
      lastName: "Kumar",
      positions: ["Frontend Developer", "Java"],
      socialNetworks: [
        { name: "LinkedIn", url: "https://www.linkedin.com/in/chander-kumar-6b07572b5/" },
        { name: "Github", url: "https://github.com/BHAGAT-0102" },
      ],
    },

    {
      imageUrl: "https://github.com/github.png?size=460",
      firstName: "Amarnath",
      lastName: "Kumar",
      positions: ["AI/ ML/ DL ", "GenAI"],
      socialNetworks: [
        { name: "LinkedIn", url: "" },
        { name: "Github", url: "" },
      ],
    },
    // Additional team members here...
  ];

  const socialIcon = (socialName: string) => {
    switch (socialName) {
      case "LinkedIn":
        return <LinkedInIcon />;
      case "Github":
        return <GithubIcon />;
      case "X":
        return <XIcon />;
    }
  };

  return (
    <section id="team" className="container lg:w-[75%] py-24 sm:py-32">
      <div className="text-center mb-8">
        <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
          Team
        </h2>
        <h2 className="text-3xl md:text-4xl text-center font-bold">
          The Company Dream Team
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {teamList.map(
          (
            { imageUrl, firstName, lastName, positions, socialNetworks },
            index
          ) => (
            <Card
              key={index}
              className="bg-muted/60 dark:bg-card flex flex-col h-full overflow-hidden group/hoverimg"
            >
              <CardHeader className="p-0 gap-0">
                <div className="h-full overflow-hidden">
                  <Image
                    src={imageUrl}
                    alt=""
                    width={300}
                    height={300}
                    className="w-full aspect-square object-cover saturate-0 transition-all duration-200 ease-linear size-full group-hover/hoverimg:saturate-100 group-hover/hoverimg:scale-[1.01]"
                  />
                </div>
                <CardTitle className="py-6 pb-4 px-6">
                  {firstName}
                  <span className="text-primary ml-2">{lastName}</span>
                </CardTitle>
              </CardHeader>
              {positions.map((position, index) => (
                <CardContent
                  key={index}
                  className={`pb-0 text-muted-foreground ${
                    index === positions.length - 1 && "pb-6"
                  }`}
                >
                  {position}
                  {index < positions.length - 1 && <span>,</span>}
                </CardContent>
              ))}

              <CardFooter className="space-x-4 mt-auto">
                {socialNetworks.map(({ name, url }, index) => (
                  <Link
                    key={index}
                    href={url}
                    target="_blank"
                    className="hover:opacity-80 transition-all"
                  >
                    {socialIcon(name)}
                  </Link>
                ))}
              </CardFooter>
            </Card>
          )
        )}
      </div>

      <div className="text-center mt-16">
        <h3 className="text-2xl font-bold">🌟 Contributors</h3>
        <p className="text-muted-foreground mt-2">
          Thanks to these wonderful people:
        </p>
        <a href="https://github.com/Hiteshydv001/Guard-AI/graphs/contributors" target="_blank" rel="noopener noreferrer">
          <img
            src="https://contrib.rocks/image?repo=Hiteshydv001/Guard-AI"
            alt="Contributors"
            className="mx-auto mt-4"
          />
        </a>
      </div>
    </section>
  );
};
