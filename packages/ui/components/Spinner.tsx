import { Loader2 } from "lucide-react";

export function Spinner({ className = "", size = "md" }: { className?: string, size?: "sm" | "md" | "lg" | "xl" }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-12 w-12"
  };

  return (
    <Loader2 className={`animate-spin text-[var(--accent)] ${sizeClasses[size]} ${className}`} />
  );
}
