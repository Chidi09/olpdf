import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type BackLinkProps = {
  href?: string;
  label?: string;
  className?: string;
};

export default function BackLink({ href = "/dashboard", label = "Back", className = "" }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}
