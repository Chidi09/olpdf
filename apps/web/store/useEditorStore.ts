import { create } from "zustand";
import type { DocumentModel, DocumentBlock } from "@olpdf/document-model";

type AiLog = {
  id: string;
  instruction: string;
  status: "pending_review" | "accepted" | "rejected";
  created_at: string;
  tool_calls: Array<{ name: string; args: Record<string, unknown> }>;
  diff_snapshot?: { before: DocumentBlock[]; after: DocumentBlock[] };
};

interface EditorState {
  instruction: string;
  currentModel: DocumentModel | null;
  isRunningAi: boolean;
  showHistory: boolean;
  activeAiLog: AiLog | null;
  setInstruction: (instruction: string) => void;
  setCurrentModel: (model: DocumentModel | null) => void;
  setIsRunningAi: (running: boolean) => void;
  setShowHistory: (show: boolean) => void;
  setActiveAiLog: (log: AiLog | null) => void;
  reset: () => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  instruction: "",
  currentModel: null,
  isRunningAi: false,
  showHistory: false,
  activeAiLog: null,
  setInstruction: (instruction) => set({ instruction }),
  setCurrentModel: (currentModel) => set({ currentModel }),
  setIsRunningAi: (isRunningAi) => set({ isRunningAi }),
  setShowHistory: (showHistory) => set({ showHistory }),
  setActiveAiLog: (activeAiLog) => set({ activeAiLog }),
  reset: () => set({ instruction: "", currentModel: null, isRunningAi: false, showHistory: false, activeAiLog: null }),
}));
