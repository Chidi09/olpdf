
import React from "react";
import { cn } from "../utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "solid" | "glass";
}

export const Card = ({ variant = "solid", className, ...props }: CardProps) => {
  const baseStyles = "rounded-[var(--radius-lg)] border transition-all duration-300";
  const variants = {
    solid: "bg-[var(--bg-surface)] border-[var(--border-subtle)]",
    glass: "bg-[var(--bg-glass)] backdrop-blur-md border-[var(--bg-glass-border)] shadow-xl"
  };
  
  return (
    <div 
      className={cn(baseStyles, variants[variant], className)} 
      {...props} 
    />
  );
};

