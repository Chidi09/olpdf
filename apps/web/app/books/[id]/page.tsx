import BookWorkspace from "@/components/editor/BookWorkspace";

export default async function BookPage({ params }: { params: { id: string } }) {
  const { id } = await Promise.resolve(params);

  return (
    <BookWorkspace
      bookId={id}
    />
  );
}
