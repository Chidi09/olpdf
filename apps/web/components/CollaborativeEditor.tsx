"use client"

import { Extension } from "@tiptap/core";
import { GripVertical, Hash, Type, List, Table as TableIcon, Image as ImageIcon, Minus } from "lucide-react";
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
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { useCallback, useEffect, useState, useRef } from "react";
import { DocumentModel } from "@olpdf/document-model";
import debounce from "lodash/debounce";
import { useQuery } from "@tanstack/react-query";
import StylePanel from "./editor/StylePanel";
import PdfPreview from "./editor/PdfPreview";
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
} from "../lib/documentTransformers";
import { useDocumentQuery, useSaveDocumentMutation } from "@/hooks/useDocumentQueries";

interface CollaborativeEditorProps {
  documentId: string;
  userName: string;
  userColor: string;
  initialModel?: DocumentModel;
  onModelChange?: (model: DocumentModel) => void;
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
  const hydratedModel = initialModel || documentQuery.data?.document_model || model;

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
      DragHandle, TextStyle, Color, Table.configure({ resizable: true }), TableRow, TableCell, TableHeader,
      BlockMetadata,
    ],
    content: documentModelToTiptap(hydratedModel),
    onUpdate: ({ editor }) => {
        const newModel = {
          ...hydratedModel,
          ...tiptapToDocumentModel(editor.getJSON(), documentId),
          meta: hydratedModel.meta,
          styles: hydratedModel.styles,
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
  }, [hydratedModel]);

  const insertBlock = (type: string) => {
    if (!editor) return;
    editor.chain().focus().deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from }).run();
    
    if (type === "Heading 1") editor.chain().focus().setHeading({ level: 1 }).run();
    if (type === "Heading 2") editor.chain().focus().setHeading({ level: 2 }).run();
    if (type === "Heading 3") editor.chain().focus().setHeading({ level: 3 }).run();
    if (type === "Bullet List") editor.chain().focus().toggleBulletList().run();
    if (type === "Table") editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    if (type === "Divider") editor.chain().focus().setHorizontalRule().run();
    
    setShowCommandPalette(false);
  };

  const handleSaveVersion = () => {
    const name = prompt("Enter version name:");
    if (name) takeSnapshot(name);
  };

  if (!editor) return null;

  return (
    <div className="flex h-screen bg-[var(--bg-base)] text-[var(--text-primary)] font-[var(--font-ui)] overflow-hidden">
        <FloatingToolbar />
        <PageMinimap pageCount={Math.max(model?.page_dimensions?.length || 0, 1)} />
        <VirtualizedPageRail pageCount={Math.max(model?.page_dimensions?.length || 1, 1)} />
        {/* Command Palette */}
        {showCommandPalette && (
          <div 
            className="fixed z-50 w-64 shadow-2xl animate-reveal"
            style={{ top: palettePos.top, left: palettePos.left }}
          >
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl overflow-hidden shadow-float">
               <div className="px-3 py-2 border-b border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Blocks</div>
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
            </div>
          </div>
        )}

        <aside className="w-64 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-y-auto">
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

        <main className="flex-1 flex flex-col relative overflow-hidden bg-[var(--bg-base)]">
            <header className="h-14 border-b border-[var(--border-subtle)] bg-[var(--bg-glass)] backdrop-blur-md flex items-center justify-between px-6 z-10">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{model.meta.title}</span>
                    <div className="flex items-center gap-2">
                        {saveMutation.isPending ? (
                          <span className="text-[10px] bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded-full font-mono animate-pulse">SAVING...</span>
                        ) : isDirty ? (
                          <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full font-mono">UNSAVED</span>
                        ) : (
                          <span className="text-[10px] text-[var(--text-tertiary)] font-mono flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            SAVED
                          </span>
                        )}
                    </div>
                    {isOffline && <span className="text-[10px] bg-[var(--status-review)]/20 text-[var(--status-review)] px-2 py-0.5 rounded-full font-mono">OFFLINE</span>}
                    {saveError && <span className="text-[10px] bg-[var(--status-error)]/20 text-[var(--status-error)] px-2 py-0.5 rounded-full font-mono">SAVE FAILED</span>}
                    <button 
                      onClick={handleSaveVersion}
                      className="text-xs bg-[var(--accent)] text-[var(--text-on-accent)] px-3 py-1 rounded hover:opacity-90 transition-opacity ml-2"
                    >
                      Save Version
                    </button>
                </div>
                <div className="flex items-center gap-3">
                   {connectedUsers.slice(0, 2).map((user, index) => (
                     <div
                       key={index}
                       className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                       style={{ backgroundColor: user.color, color: "var(--text-on-accent)" }}
                       title={user.name}
                     >
                       {user.name.charAt(0)}
                     </div>
                   ))}
                   {connectedUsers.length > 2 && (
                     <div className="w-8 h-8 rounded-full bg-[var(--bg-glass)] text-[var(--text-secondary)] flex items-center justify-center text-xs font-bold border border-[var(--bg-glass-border)]" title={`${connectedUsers.length - 2} more users`}>
                       +{connectedUsers.length - 2}
                     </div>
                   )}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-12 editor-canvas-container scrollbar-hide">
                <div className="max-w-[850px] mx-auto paper-sheet min-h-[1100px] rounded-sm relative group transition-all duration-500">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--accent)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <EditorContent 
                        editor={editor} 
                        className="prose prose-slate dark:prose-invert max-w-none p-[96px] min-h-[1100px] doc-body outline-none" 
                    />
                </div>
            </div>

            <div className="h-72 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] relative group">
                <div className="absolute top-0 left-0 w-full h-1 bg-[var(--border-subtle)] group-hover:bg-[var(--accent)] transition-colors" />
                <PdfPreview documentId={documentId} />
            </div>
        </main>

        <aside className="w-72 border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-y-auto">
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
