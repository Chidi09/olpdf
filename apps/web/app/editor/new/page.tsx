"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewEditorPage() {
  const router = useRouter();

  useEffect(() => {
    const create = async () => {
      const res = await fetch("/api/bff/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Document" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.id) {
        router.replace("/dashboard");
        return;
      }
      router.replace(`/editor/${data.id}`);
    };
    create();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] text-[var(--text-primary)]">
      <p className="text-sm font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Creating document...</p>
    </main>
  );
}
