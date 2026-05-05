import Link from "next/link";
import { EmptyState } from "@olpdf/ui";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[var(--bg-base)] p-6">
      <EmptyState
        icon={<FileQuestion className="h-16 w-16 text-[var(--text-tertiary)]" />}
        title="Page Not Found"
        description="We couldn't find the page or document you're looking for. It might have been moved or deleted."
        action={
          <Link href="/" className="px-6 py-2 bg-[var(--accent)] text-[var(--text-on-accent)] font-bold rounded-full">
            Return Home
          </Link>
        }
      />
    </div>
  );
}
