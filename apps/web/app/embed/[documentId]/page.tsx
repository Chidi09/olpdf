import { notFound } from "next/navigation";
import EmbedClient from "./EmbedClient";

interface EmbedPageProps {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ token?: string; origin?: string }>;
}

export function parseParentOrigin(origin: string | undefined): string {
  if (!origin || origin === "*") throw new Error("origin is required");
  const url = new URL(origin);
  return url.origin;
}

export default async function EmbedPage({ params, searchParams }: EmbedPageProps) {
  const { documentId } = await params;
  const { token, origin } = await searchParams;

  if (!documentId || !token) {
    notFound();
  }

  let parentOrigin: string;
  try {
    parentOrigin = parseParentOrigin(origin);
  } catch {
    notFound();
  }

  return (
    <EmbedClient
      documentId={documentId}
      token={token}
      parentOrigin={parentOrigin}
    />
  );
}
