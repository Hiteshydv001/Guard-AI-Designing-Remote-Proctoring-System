"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "../ui/button";

export const ToggleTheme = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Button
      onClick={() => setTheme(dark ? "light" : "dark")}
      size="icon-sm"
      variant="ghost"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="shrink-0"
    >
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </Button>
  );
};
