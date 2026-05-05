-- Enable RLS and policies on all application tables.

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_edit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own documents" ON documents;
CREATE POLICY "Users own documents"
ON documents FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own books" ON books;
CREATE POLICY "Users own books"
ON books FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own chapters via books" ON book_chapters;
CREATE POLICY "Users own chapters via books"
ON book_chapters FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM books
    WHERE books.id = book_chapters.book_id
      AND books.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM books
    WHERE books.id = book_chapters.book_id
      AND books.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users own templates" ON templates;
CREATE POLICY "Users own templates"
ON templates FOR ALL
USING (creator_id = auth.uid() OR is_public = true)
WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Users own ai logs via documents" ON ai_edit_logs;
CREATE POLICY "Users own ai logs via documents"
ON ai_edit_logs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = ai_edit_logs.document_id
      AND documents.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = ai_edit_logs.document_id
      AND documents.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users own page metadata via documents" ON page_metadata;
CREATE POLICY "Users own page metadata via documents"
ON page_metadata FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = page_metadata.document_id
      AND documents.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = page_metadata.document_id
      AND documents.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users own assets via documents" ON assets;
CREATE POLICY "Users own assets via documents"
ON assets FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = assets.document_id
      AND documents.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = assets.document_id
      AND documents.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users own chapter embeddings via books" ON chapter_embeddings;
CREATE POLICY "Users own chapter embeddings via books"
ON chapter_embeddings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM books
    WHERE books.id = chapter_embeddings.book_id
      AND books.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM books
    WHERE books.id = chapter_embeddings.book_id
      AND books.user_id = auth.uid()
  )
);
