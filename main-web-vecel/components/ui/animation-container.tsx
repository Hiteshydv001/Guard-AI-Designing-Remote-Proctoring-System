import Lottie from "lottie-react";
import { AnimationPlaceholder } from "./placeholder";
import { useEffect, useState } from "react";


interface AnimationItem {
  animation: any; // Replace 'any' with the specific type if you know it (e.g., `object`)
  text: string;
}

// Modified AnimationContainer with placeholder
const AnimationContainer = ({ 
  animationDataPaths, 
  currentIndex, 
  isTextFading 
}: { 
  animationDataPaths: AnimationItem[];
  currentIndex: number;
  isTextFading: boolean;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Reset loaded state when animation changes
    setIsLoaded(false);
  }, [currentIndex]);

  if (animationDataPaths.length === 0) return null;

  return (
    <div className="relative w-full md:w-[1200px] mx-auto rounded-lg">
      <div className="relative w-full h-[600px]">
        {/* Placeholder */}
        {!isLoaded && <AnimationPlaceholder />}
        
        {/* Actual Animation */}
        <div className={`absolute inset-0 transition-opacity duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}>
          <Lottie
            animationData={animationDataPaths[currentIndex].animation}
            loop={true}
            className="w-full h-full"
            onDOMLoaded={() => {
              // Add a small delay to ensure smooth transition
              setTimeout(() => setIsLoaded(true), 100);
            }}
          />
            <div className="absolute bottom-8 left-0 right-0 text-center">
                <h3
                className={`text-2xl font-bold text-primary bg-background/80 inline-block px-6 py-3 rounded-lg
                transition-all duration-500 ease-in-out transform
                ${isTextFading ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"}`}
                >
                {animationDataPaths[currentIndex].text}
                </h3>
            </div>
        </div>
      </div>

      {/* Gradient overlay */}
      <div className="absolute bottom-0 left-0 w-full h-20 md:h-28 bg-gradient-to-b from-background/0 via-background/50 to-background rounded-lg" />
    </div>
  );
};

export { AnimationContainer };