import React from "react";
import BookWorkspace from "@/components/editor/BookWorkspace";

export default async function BookPage({ params }: { params: { id: string } }) {
  const { id } = params;

  // In a real app, we'd get the user from the session
  const userName = "Divine Adoyi";
  const userColor = "#e6a449";

  return (
    <BookWorkspace
      bookId={id}
      userName={userName}
      userColor={userColor}
    />
  );
}
