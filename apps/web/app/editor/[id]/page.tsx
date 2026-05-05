import DocumentWorkspace from "@/components/editor/DocumentWorkspace";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocumentWorkspace documentId={id} />;
}
