"use client"

import { Extension } from "@tiptap/core";
import { Hash, Type, List, Sparkles, Table as TableIcon, Minus } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import DragHandle from "@tiptap/extension-drag-handle";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import LinkExtension from "@tiptap/extension-link";

// Custom extension for block metadata and interactions
const BlockMetadata = Extension.create({
  name: "blockMetadata",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "bulletList", "orderedList", "table", "horizontalRule"],
        attributes: {
          id: { default: null },
          type: { default: null },
        },
      },
    ];
  },
});

const RenderDataAttributes = Extension.create({
  name: "renderDataAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "bulletList", "orderedList", "table", "horizontalRule", "listItem"],
        attributes: {
          "data-block-type": {
            default: null,
            parseHTML: (element) => element.getAttribute("data-block-type"),
            renderHTML: (attributes) => {
              if (!attributes["data-block-type"]) return {};
              return { "data-block-type": attributes["data-block-type"] };
            },
          },
        },
      },
    ];
  },
});
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { useCallback, useEffect, useState, useRef } from "react";
import { DocumentModel } from "@olpdf/document-model";
import debounce from "lodash/debounce";
import { useQuery } from "@tanstack/react-query";
import StylePanel from "./editor/StylePanel";
import TemplateBrowser from "./editor/TemplateBrowser";
import VersionHistoryPanel from "./editor/VersionHistoryPanel";
import VersionDiffViewer from "./editor/VersionDiffViewer";
import FloatingToolbar from "./editor/FloatingToolbar";
import PageMinimap from "./editor/PageMinimap";
import VirtualizedPageRail from "./editor/VirtualizedPageRail";
import {
  createEmptyDocumentModel,
  documentModelToTiptap,
  tiptapToDocumentModel,
  normalizeDocumentBlocks,
} from "../lib/documentTransformers";
import { useDocumentQuery, useSaveDocumentMutation } from "@/hooks/useDocumentQueries";

interface CollaborativeEditorProps {
  documentId: string;
  userName: string;
  userColor: string;
  initialModel?: DocumentModel;
  onModelChange?: (model: DocumentModel) => void;
}

function normalizeDocumentModel(model: DocumentModel | undefined, documentId: string): DocumentModel {
  const fallback = createEmptyDocumentModel(documentId);
  if (!model) return fallback;
  return {
    ...fallback,
    ...model,
    id: model.id || documentId,
    meta: {
      ...fallback.meta,
      ...(model.meta || {}),
      title: model.meta?.title || fallback.meta.title,
    },
    styles: model.styles || {},
    blocks: normalizeDocumentBlocks(model.blocks as unknown as Array<Record<string, unknown>>) as unknown as DocumentModel["blocks"],
    page_dimensions: Array.isArray(model.page_dimensions) ? model.page_dimensions : [],
  };
}

export default function CollaborativeEditor({
  documentId, userName, userColor, initialModel, onModelChange
}: CollaborativeEditorProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [ydoc] = useState(() => new Y.Doc());
  const [activeLeftPanel, setActiveLeftPanel] = useState<'library' | 'history'>('library');
  const [connectedUsers, setConnectedUsers] = useState<
    { name: string; color: string }[]
  >([]);
  const [model, setModel] = useState<DocumentModel>(
    initialModel || createEmptyDocumentModel(documentId)
  );
  const [versionToCompare1Id, setVersionToCompare1Id] = useState<string | null>(null);
  const [versionToCompare2Id, setVersionToCompare2Id] = useState<string | null>(null);
  const [showDiffViewer, setShowDiffViewer] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showNavigationTools, setShowNavigationTools] = useState(false);
  const [commentDraft, setCommentDraft] = useState<{ visible: boolean; top: number; left: number; selectedText: string } | null>(null);
  const hasHydratedRef = useRef(false);
  const documentQuery = useDocumentQuery(documentId);

  const version1Query = useQuery<DocumentModel>({
    queryKey: ["documentVersionCompare1", versionToCompare1Id],
    queryFn: async () => {
      if (!versionToCompare1Id) return Promise.reject("No version selected for comparison 1");
      const response = await fetch(`/api/documents/${documentId}/versions/${versionToCompare1Id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch document version for comparison 1");
      }
      return response.json();
    },
    enabled: !!versionToCompare1Id && showDiffViewer,
  });

  const version2Query = useQuery<DocumentModel>({
    queryKey: ["documentVersionCompare2", versionToCompare2Id],
    queryFn: async () => {
      if (!versionToCompare2Id) return Promise.reject("No version selected for comparison 2");
      const response = await fetch(`/api/documents/${documentId}/versions/${versionToCompare2Id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch document version for comparison 2");
      }
      return response.json();
    },
    enabled: !!versionToCompare2Id && showDiffViewer,
  });

  const saveMutation = useSaveDocumentMutation(documentId);
  const hydratedModel = normalizeDocumentModel(initialModel || documentQuery.data?.document_model || model, documentId);
  const hydratedModelRef = useRef(hydratedModel);

  useEffect(() => {
    hydratedModelRef.current = hydratedModel;
  }, [hydratedModel]);

  const saveRef = useRef(
    debounce(async (nextModel: DocumentModel) => {
      try {
        await saveMutation.mutateAsync(nextModel);
        setSaveError(null);
        setIsDirty(false);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "save_failed");
      }
    }, 1000)
  );

  useEffect(() => {
    const local = new IndexeddbPersistence(`olpdf-doc-${documentId}`, ydoc);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOffline(false);
    setConnectedUsers([{ name: userName, color: userColor }]);

    return () => {
      local.destroy();
      ydoc.destroy();
    };
  }, [documentId, userName, userColor, ydoc]);

  const takeSnapshot = useCallback(async (name?: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_model: model,
          version_name: name || `Autosave: ${new Date().toLocaleString()}`,
        }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
      console.error("Failed to create snapshot:", error);
    }
  }, [documentId, model]);

  useEffect(() => {
    const interval = setInterval(() => takeSnapshot(), 300 * 1000);
    return () => clearInterval(interval);
  }, [takeSnapshot]);

  const handleCompareVersions = (versionId1: string, versionId2: string | null = null) => {
    setVersionToCompare1Id(versionId1);
    setVersionToCompare2Id(versionId2);
    setShowDiffViewer(true);
  };

  const handleRestoreVersion = async (versionId: string) => {
    const response = await fetch(`/api/documents/${documentId}/versions/${versionId}`);
    if (!response.ok) {
      return;
    }

    const restoredVersion = (await response.json()) as DocumentModel;
    setModel(restoredVersion);
    if (editor) {
      editor.commands.setContent(documentModelToTiptap(restoredVersion));
    }
  };

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [palettePos, setPalettePos] = useState({ top: 0, left: 0 });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc }),
      DragHandle, TextStyle, Color,
      LinkExtension.configure({ openOnClick: true }),
      Table.configure({ resizable: true }), TableRow, TableCell, TableHeader,
      BlockMetadata, RenderDataAttributes,
    ],
    content: documentModelToTiptap(hydratedModel),
    onUpdate: ({ editor }) => {
        if (!hasHydratedRef.current) {
          hasHydratedRef.current = true;
          return;
        }
        const baseModel = hydratedModelRef.current;
        const newModel = {
          ...baseModel,
          ...tiptapToDocumentModel(editor.getJSON(), documentId),
          meta: baseModel.meta,
          styles: baseModel.styles,
        };
        setModel(newModel);
        setIsDirty(true);
        if (onModelChange) onModelChange(newModel);
        void saveRef.current(newModel);
    },
    editorProps: {
      handleKeyDown: (view, event) => {
        if (event.key === "/") {
          const { selection } = view.state;
          const coords = view.coordsAtPos(selection.from);
          setPalettePos({ top: coords.top + 24, left: coords.left });
          setShowCommandPalette(true);
          return false;
        }
        if (event.key === "Escape") {
          setShowCommandPalette(false);
        }
        return false;
      },
    },
  }, [documentId]);

  const insertBlock = (type: string) => {
    if (!editor) return;
    editor.chain().focus().deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from }).run();

    if (type === "Heading 1") {
      editor.chain().focus().setHeading({ level: 1 }).updateAttributes("heading", { "data-block-type": "H1" }).run();
    } else if (type === "Heading 2") {
      editor.chain().focus().setHeading({ level: 2 }).updateAttributes("heading", { "data-block-type": "H2" }).run();
    } else if (type === "Heading 3") {
      editor.chain().focus().setHeading({ level: 3 }).updateAttributes("heading", { "data-block-type": "H3" }).run();
    } else if (type === "Bullet List") {
      editor.chain().focus().toggleBulletList().run();
    } else if (type === "Table") {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    } else if (type === "Divider") {
      editor.chain().focus().setHorizontalRule().run();
    } else {
      editor.chain().focus().setParagraph().updateAttributes("paragraph", { "data-block-type": "P" }).run();
    }

    setShowCommandPalette(false);
  };

  const handleSaveVersion = () => {
    const name = prompt("Enter version name:");
    if (name) takeSnapshot(name);
  };

  if (!editor) return null;

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg-base)] text-[var(--text-primary)] font-[var(--font-ui)] overflow-hidden">
        {commentDraft?.visible && (
          <div
            className="fixed z-50 animate-in fade-in zoom-in-95 duration-200"
            style={{ top: commentDraft.top, left: Math.max(16, commentDraft.left) }}
          >
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-3 w-72">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Add Comment</p>
              <textarea
                autoFocus
                placeholder="Write a comment..."
                className="w-full min-h-20 rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setCommentDraft(null); return; }
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    const body = (e.target as HTMLTextAreaElement).value.trim();
                    if (body) {
                      void fetch(`/api/bff/documents/${documentId}/comments`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ block_id: null, page_index: 0, anchor: null, position: { x: 0, y: 0, width: 0, height: 0 }, body }),
                      }).catch(() => null);
                    }
                    setCommentDraft(null);
                  }
                }}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-[10px] text-[var(--text-tertiary)]">⌘⏎ to post</span>
                <button onClick={() => setCommentDraft(null)} className="rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">Cancel</button>
              </div>
            </div>
          </div>
        )}
        <FloatingToolbar onAction={(action, selectedText) => {
          if (!editor) return;
          if (action === "bold") { editor.chain().focus().toggleBold().run(); }
          if (action === "italic") { editor.chain().focus().toggleItalic().run(); }
          if (action === "link") {
            const url = window.prompt("Enter link URL:");
            if (url) {
              try { new URL(url); editor.chain().focus().setLink({ href: url }).run(); }
              catch { editor.chain().focus().setLink({ href: `https://${url}` }).run(); }
            }
          }
          if (action === "comment") {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const rect = sel.getRangeAt(0).getBoundingClientRect();
              setCommentDraft({ visible: true, top: rect.bottom + 8, left: rect.left, selectedText: selectedText });
            }
          }
          if (action === "aiRewrite") {
            if (selectedText) {
              const url = window.prompt("AI rewrite instruction (improve, shorten, formal, casual):", "improve");
              if (url) {
                fetch(`/api/bff/ai/documents/${documentId}/instruction`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ instruction: `${url}: ${selectedText}` }),
                }).catch(() => null);
              }
            } else {
              alert("Select some text first for AI rewrite.");
            }
          }
        }} />
        {showNavigationTools && (
          <>
            <PageMinimap pageCount={Math.max(model?.page_dimensions?.length || 0, 1)} />
            <VirtualizedPageRail pageCount={Math.max(model?.page_dimensions?.length || 1, 1)} />
          </>
        )}
        {/* Command Palette */}
        {showCommandPalette && (
          <div
            className="fixed z-50 w-64 shadow-2xl animate-reveal"
            style={{ top: palettePos.top, left: palettePos.left }}
          >
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-float">
              <div className="px-3 py-2 bg-white/[0.02] border-b border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Basic Blocks</div>
              {[
                { label: "Text", icon: Type, type: "paragraph" },
                { label: "Heading 1", icon: Hash, type: "heading1" },
                { label: "Heading 2", icon: Hash, type: "heading2" },
                { label: "Heading 3", icon: Hash, type: "heading3" },
                { label: "Bullet List", icon: List, type: "list" },
                { label: "Table", icon: TableIcon, type: "table" },
                { label: "Divider", icon: Minus, type: "divider" },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => insertBlock(item.label)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--accent)]/10 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors group"
                >
                  <item.icon className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                  {item.label}
                </button>
              ))}
              <div className="px-3 py-2 bg-white/[0.02] border-t border-b border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">AI Operations</div>
              <button
                onClick={() => {
                  setShowCommandPalette(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-orange-500/10 text-sm text-orange-400 transition-colors group"
              >
                <Sparkles className="h-4 w-4 opacity-70 group-hover:opacity-100" />
                Ask Gemini to write...
              </button>
            </div>
          </div>
        )}

        <aside className="hidden w-56 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-y-auto 2xl:block">
            <div className="p-4 border-b border-[var(--border-subtle)] flex gap-2">
                <button
                    onClick={() => setActiveLeftPanel('library')}
                    className={`text-sm font-semibold tracking-wider uppercase ${activeLeftPanel === 'library' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--accent)]'}`}
                >
                    Library
                </button>
                <button
                    onClick={() => setActiveLeftPanel('history')}
                    className={`text-sm font-semibold tracking-wider uppercase ${activeLeftPanel === 'history' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--accent)]'}`}
                >
                    History
                </button>
            </div>
            {activeLeftPanel === 'library' && (
                <TemplateBrowser
                  onSelect={(selectedModel) => {
                    setModel(selectedModel);
                    if (editor) {
                      editor.commands.setContent(documentModelToTiptap(selectedModel));
                    }
                  }}
                />
            )}
            {activeLeftPanel === 'history' && (
                <VersionHistoryPanel
                  documentId={documentId}
                  onSelectVersion={handleRestoreVersion}
                  onCompareVersions={handleCompareVersions}
                  currentDocumentId={documentId}
                />
            )}
        </aside>

        <main className="min-w-0 flex-1 flex flex-col relative overflow-hidden bg-[var(--bg-base)]">
            <div className="min-h-0 flex-1 overflow-auto p-4 editor-canvas-container scrollbar-hide md:p-8 xl:p-10">
                <div className="mx-auto min-w-[760px] max-w-[850px] paper-sheet min-h-[1100px] rounded-sm relative group transition-all duration-500">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--accent)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <EditorContent 
                        editor={editor} 
                        className="prose prose-slate dark:prose-invert max-w-none p-[96px] min-h-[1100px] doc-body outline-none" 
                    />
                </div>
            </div>

        </main>

        <aside className="hidden w-64 shrink-0 border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-y-auto 2xl:block">
            <div className="p-4 border-b border-[var(--border-subtle)]">
                <h2 className="text-sm font-semibold tracking-wider uppercase text-[var(--text-secondary)]">Inspector</h2>
            </div>
            <StylePanel model={model} onChange={setModel} />
        </aside>

        {showDiffViewer &&
          (version1Query.data && (versionToCompare2Id === null || version2Query.data)) && (
            <VersionDiffViewer
              oldVersion={version1Query.data}
              newVersion={versionToCompare2Id ? (version2Query.data || createEmptyDocumentModel(documentId)) : model}
              onClose={() => {
                setShowDiffViewer(false);
                setVersionToCompare1Id(null);
                setVersionToCompare2Id(null);
              }}
            />
          )}
    </div>
  );
}
