"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
        router.replace("/books");
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
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] text-[var(--text-primary)]">
      <p className="text-sm font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Creating book workspace...</p>
    </main>
  );
}
