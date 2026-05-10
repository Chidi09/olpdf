import { notFound } from "next/navigation";
import EmbedClient from "./EmbedClient";

interface EmbedPageProps {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ token?: string; origin?: string }>;
}

export default async function EmbedPage({ params, searchParams }: EmbedPageProps) {
  const { documentId } = await params;
  const { token, origin } = await searchParams;

  if (!documentId || !token) {
    notFound();
  }

  return (
    <EmbedClient
      documentId={documentId}
      token={token}
      parentOrigin={origin ?? "*"}
    />
  );
}
