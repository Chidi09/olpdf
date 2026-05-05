import { NextResponse } from "next/server";

type JsonRecord = Record<string, unknown>;

type MockDocument = {
  id: string;
  document_model: JsonRecord;
};

type MockChapter = {
  id: string;
  document_id: string;
  chapter_number: number;
  title: string;
  status: "draft" | "review" | "final";
  word_count: number;
};

type MockBook = {
  id: string;
  title: string;
  meta: JsonRecord;
  chapters: MockChapter[];
};

type MockAiLog = {
  id: string;
  document_id: string;
  instruction: string;
  status: "pending_review" | "accepted" | "rejected";
  created_at: string;
  tool_calls: Array<{ name: string; args: JsonRecord }>;
  diff_snapshot: { before: unknown[]; after: unknown[] };
};

type MockBlock = {
  id: string;
  type: string;
  content?: string;
  confidence_score?: number;
  needs_review?: boolean;
  style_overrides?: JsonRecord;
};

const nowIso = () => new Date().toISOString();

const createDefaultModel = (id: string) => ({
  id,
  meta: {
    title: "Mock Document",
    author: "Dev Mode",
    page_size: "A4",
    margins: { top: 72, bottom: 72, left: 72, right: 72 },
    export_standard: "pdf_a",
    layout_mode: "editable",
  },
  styles: {},
  blocks: [
    { id: "blk_1", type: "heading1", content: "Chapter Draft", confidence_score: 1, needs_review: false, style_overrides: {} },
    { id: "blk_2", type: "paragraph", content: "This is a mock paragraph for UI walkthrough.", confidence_score: 1, needs_review: false, style_overrides: {} },
  ],
});

const mockStore: {
  documents: Map<string, MockDocument>;
  books: Map<string, MockBook>;
  aiLogs: Map<string, MockAiLog[]>;
} = {
  documents: new Map(),
  books: new Map(),
  aiLogs: new Map(),
};

const seedBookId = "demo-book";
if (!mockStore.books.has(seedBookId)) {
  const ch1Doc = "demo-doc-1";
  const ch2Doc = "demo-doc-2";
  mockStore.documents.set(ch1Doc, { id: ch1Doc, document_model: createDefaultModel(ch1Doc) });
  mockStore.documents.set(ch2Doc, { id: ch2Doc, document_model: createDefaultModel(ch2Doc) });
  mockStore.books.set(seedBookId, {
    id: seedBookId,
    title: "The Iron Gate",
    meta: { author: "Demo Author", subtitle: "Mock Build" },
    chapters: [
      { id: "ch_1", document_id: ch1Doc, chapter_number: 1, title: "Arrival", status: "final", word_count: 1280 },
      { id: "ch_2", document_id: ch2Doc, chapter_number: 2, title: "The Gate", status: "review", word_count: 1842 },
    ],
  });
}

function getOrCreateDocument(id: string): MockDocument {
  const existing = mockStore.documents.get(id);
  if (existing) return existing;
  const created = { id, document_model: createDefaultModel(id) };
  mockStore.documents.set(id, created);
  return created;
}

function getOrCreateBook(id: string): MockBook {
  const existing = mockStore.books.get(id);
  if (existing) return existing;
  const created = { id, title: "Untitled Book", meta: {}, chapters: [] as MockChapter[] };
  mockStore.books.set(id, created);
  return created;
}

export function handleMock(path: string, init?: RequestInit): NextResponse | null {
  const method = (init?.method || "GET").toUpperCase();
  const bodyText = typeof init?.body === "string" ? init.body : "{}";
  const body = JSON.parse(bodyText || "{}");

  const docMatch = path.match(/^\/api\/documents\/([^/]+)$/);
  if (docMatch && method === "GET") return NextResponse.json(getOrCreateDocument(docMatch[1]));
  if (docMatch && method === "PUT") {
    const doc = getOrCreateDocument(docMatch[1]);
    doc.document_model = body as JsonRecord;
    return NextResponse.json({ status: "success", id: doc.id });
  }

  const previewMatch = path.match(/^\/api\/documents\/([^/]+)\/preview$/);
  if (previewMatch && method === "GET") return NextResponse.json({ id: previewMatch[1], preview_url: `/mock/previews/${previewMatch[1]}.pdf` });

  if (path.match(/^\/api\/documents\/([^/]+)\/preflight$/) && method === "POST") {
    return NextResponse.json([{ type: "missing_alt_text", block_id: "blk_2", detail: "Image block has no alt text", severity: "warning" }]);
  }

  const exportMatch = path.match(/^\/api\/documents\/([^/]+)\/export\/([^/]+)$/);
  if (exportMatch && method === "POST") {
    const [, id, format] = exportMatch;
    return NextResponse.json({ id, url: `/mock/exports/${id}.${format === "epub" ? "epub" : "pdf"}`, status: "ready" });
  }

  const bookMatch = path.match(/^\/api\/books\/([^/]+)$/);
  if (bookMatch && method === "GET") return NextResponse.json(getOrCreateBook(bookMatch[1]));

  if (path === "/api/templates" && method === "GET") {
    return NextResponse.json([
      { id: "tpl_1", title: "Business Proposal", category: "Business", author: "OLPDF", uses_count: 847, thumbnail_url: "", document_model: createDefaultModel("tpl_1") },
      { id: "tpl_2", title: "Technical Spec", category: "Business", author: "Engineering", uses_count: 512, thumbnail_url: "", document_model: createDefaultModel("tpl_2") },
      { id: "tpl_3", title: "Legal Notice", category: "Legal", author: "OLPDF", uses_count: 96, thumbnail_url: "", document_model: createDefaultModel("tpl_3") },
      { id: "tpl_4", title: "Novel Chapter", category: "Books", author: "Community", uses_count: 214, thumbnail_url: "", document_model: createDefaultModel("tpl_4") },
      { id: "tpl_5", title: "Academic Paper", category: "Academic", author: "University", uses_count: 318, thumbnail_url: "", document_model: createDefaultModel("tpl_5") },
      { id: "tpl_6", title: "Project Charter", category: "Business", author: "OLPDF", uses_count: 124, thumbnail_url: "", document_model: createDefaultModel("tpl_6") },
      { id: "tpl_7", title: "Terms of Service", category: "Legal", author: "LegalOps", uses_count: 45, thumbnail_url: "", document_model: createDefaultModel("tpl_7") },
      { id: "tpl_8", title: "Personal Journal", category: "Personal", author: "Community", uses_count: 612, thumbnail_url: "", document_model: createDefaultModel("tpl_8") },
      { id: "tpl_9", title: "Meeting Minutes", category: "Business", author: "OLPDF", uses_count: 941, thumbnail_url: "", document_model: createDefaultModel("tpl_9") },
      { id: "tpl_10", title: "Poetry Anthology", category: "Books", author: "ArtsDept", uses_count: 88, thumbnail_url: "", document_model: createDefaultModel("tpl_10") },
      { id: "tpl_11", title: "Research Grant", category: "Academic", author: "ScienceOrg", uses_count: 156, thumbnail_url: "", document_model: createDefaultModel("tpl_11") },
    ]);
  }

  const templateApply = path.match(/^\/api\/templates\/([^/]+)\/apply$/);
  if (templateApply && method === "POST") {
    const documentId = String(body.document_id || body.documentId || "demo-doc-1");
    const target = getOrCreateDocument(documentId);
    target.document_model = {
      ...createDefaultModel(documentId),
      meta: {
        ...createDefaultModel(documentId).meta,
        title: `Applied Template: ${templateApply[1]}`,
      },
    };
    return NextResponse.json({ status: "applied", document_id: documentId });
  }

  const chapterCreate = path.match(/^\/api\/books\/([^/]+)\/chapters$/);
  if (chapterCreate && method === "POST") {
    const book = getOrCreateBook(chapterCreate[1]);
    const newId = `ch_${book.chapters.length + 1}`;
    const document_id = `doc_${book.id}_${book.chapters.length + 1}`;
    mockStore.documents.set(document_id, { id: document_id, document_model: createDefaultModel(document_id) });
    book.chapters.push({
      id: newId,
      document_id,
      chapter_number: Number(body.chapter_number || book.chapters.length + 1),
      title: String(body.title || `Chapter ${book.chapters.length + 1}`),
      status: "draft",
      word_count: Number(body.word_count || 0),
    });
    return NextResponse.json({ id: newId, document_id, status: "created" });
  }

  const chapterUpdate = path.match(/^\/api\/books\/([^/]+)\/chapters\/([^/]+)$/);
  if (chapterUpdate && method === "PUT") {
    const book = getOrCreateBook(chapterUpdate[1]);
    const chapter = book.chapters.find((c) => c.id === chapterUpdate[2]);
    if (!chapter) return NextResponse.json({ error: "not_found" }, { status: 404 });
    chapter.title = String(body.title || chapter.title);
    chapter.status = (body.status as MockChapter["status"]) || chapter.status;
    chapter.word_count = Number(body.word_count ?? chapter.word_count);
    return NextResponse.json({ status: "success" });
  }

  const bookExport = path.match(/^\/api\/books\/([^/]+)\/export\/(pdf|epub)$/);
  if (bookExport && method === "POST") {
    const [, id, format] = bookExport;
    return NextResponse.json({ url: `/mock/exports/book-${id}.${format}`, status: "ready", size: 123456 });
  }

  if (path.match(/^\/api\/books\/([^/]+)\/consistency/) && method === "POST") {
    return NextResponse.json({
      analysis: "Found one naming inconsistency in chapter 2.",
      inconsistencies: [{ chapter_id: "ch_2", chapter_title: "The Gate", chunk_index: 1, content: "...her blue eyes met his...", issue: "Eye color conflicts with chapter 1 description." }],
      passages_checked: 4,
    });
  }

  const aiInstruction = path.match(/^\/api\/ai\/documents\/([^/]+)\/instruction$/);
  if (aiInstruction && method === "POST") {
    const document_id = aiInstruction[1];
    const instruction = String(body.instruction || "Rewrite block");
    const doc = getOrCreateDocument(document_id);
    const model = doc.document_model as JsonRecord & { blocks?: MockBlock[] };
    const before: MockBlock[] = Array.isArray(model.blocks) ? [...model.blocks] : [];
    const after = before.map((b, i) => (i === 1 ? { ...b, content: `${b.content || ""} (AI refined)` } : b));
    const log: MockAiLog = {
      id: `log_${Date.now()}`,
      document_id,
      instruction,
      status: "pending_review",
      created_at: nowIso(),
      tool_calls: [{ name: "RewriteBlock", args: { block_id: "blk_2" } }],
      diff_snapshot: { before, after },
    };
    const logs = mockStore.aiLogs.get(document_id) || [];
    logs.unshift(log);
    mockStore.aiLogs.set(document_id, logs);
    return NextResponse.json({ log_id: log.id, updated_model: { ...model, blocks: after }, tool_calls: log.tool_calls, diff_snapshot: log.diff_snapshot });
  }

  const aiLogs = path.match(/^\/api\/ai\/documents\/([^/]+)\/logs$/);
  if (aiLogs && method === "GET") return NextResponse.json(mockStore.aiLogs.get(aiLogs[1]) || []);

  const aiAccept = path.match(/^\/api\/ai\/logs\/([^/]+)\/accept$/);
  if (aiAccept && method === "POST") {
    for (const [, logs] of mockStore.aiLogs.entries()) {
      const found = logs.find((l) => l.id === aiAccept[1]);
      if (found) {
        found.status = "accepted";
        return NextResponse.json({ status: "success" });
      }
    }
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const aiReject = path.match(/^\/api\/ai\/logs\/([^/]+)\/reject$/);
  if (aiReject && method === "POST") {
    for (const [, logs] of mockStore.aiLogs.entries()) {
      const found = logs.find((l) => l.id === aiReject[1]);
      if (found) {
        found.status = "rejected";
        return NextResponse.json({ status: "success" });
      }
    }
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (path === "/api/documents/import/start" && method === "POST") {
    return NextResponse.json({ status: "queued", job_id: "mock-job-1", document_id: body.document_id || "mock-doc", queue: "mock" });
  }

  const importStatus = path.match(/^\/api\/documents\/import\/([^/]+)\/status$/);
  if (importStatus && method === "GET") return NextResponse.json({ job_id: importStatus[1], status: "processing", import_progress: 58 });

  const toolkit = path.match(/^\/api\/pdf\/([^/]+)$/);
  if (toolkit && method === "POST") {
    const op = toolkit[1];
    return NextResponse.json({
      operation: op,
      status: "completed",
      output_url: `/mock/toolkit/${op}-${Date.now()}.pdf`,
      pages_processed: 12,
    });
  }

  return null;
}
