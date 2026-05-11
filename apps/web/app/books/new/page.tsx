"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";

export default function NewBookPage() {
  const router = useRouter();

  useEffect(() => {
    const create = async () => {
      const bookRes = await fetch("/api/bff/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Book" }),
      });
      const book = await bookRes.json().catch(() => ({}));
      if (!bookRes.ok || !book?.id) {
        router.replace("/dashboard");
        return;
      }

      await fetch(`/api/bff/books/${book.id}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "",
          book_id: book.id,
          document_id: "",
          chapter_number: 1,
          title: "Chapter 1",
          status: "draft",
          word_count: 0,
          sort_order: 1,
          embedding_indexed: false,
        }),
      }).catch(() => null);

      router.replace(`/books/${book.id}`);
    };
    create();
  }, [router]);

  return (
    <PageShell className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <p className="text-sm font-bold uppercase tracking-widest text-text-tertiary">Creating book workspace...</p>
      </div>
    </PageShell>
  );
}
