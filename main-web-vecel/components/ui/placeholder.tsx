const AnimationPlaceholder = () => (
  <div className="w-full h-[600px] relative animate-pulse">
    <div className="absolute top-2 lg:-top-8 left-1/2 transform -translate-x-1/2 w-[90%] mx-auto h-24 lg:h-80 bg-primary/10 rounded-full blur-xl" />
    <div className="w-full h-full flex items-center justify-center">
      <div className="space-y-8 w-full">
        <div className="h-48 w-48 mx-auto bg-primary/5 rounded-full" />
        <div className="h-6 w-64 mx-auto bg-primary/10 rounded-lg" />
      </div>
    </div>
  </div>
);

export { AnimationPlaceholder };