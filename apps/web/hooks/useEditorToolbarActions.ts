"use client";

import { useState } from "react";
import type { DocumentBlock, DocumentModel } from "@olpdf/document-model";

export function useEditorToolbarActions(args: {
  model: DocumentModel;
  onModelChange?: (model: DocumentModel) => void;
  getCurrentModel: () => DocumentModel;
  setCurrentModel: (model: DocumentModel) => void;
  saveModel: (model: DocumentModel) => void;
  documentId: string;
}) {
  const { model, onModelChange, getCurrentModel, setCurrentModel, saveModel, documentId } = args;
  const [history, setHistory] = useState<DocumentModel[]>([]);
  const [redoStack, setRedoStack] = useState<DocumentModel[]>([]);

  const pushToHistory = (nextModel: DocumentModel) => {
    setHistory((prev) => [...prev.slice(-49), getCurrentModel()]);
    setRedoStack([]);
    onModelChange?.(nextModel);
  };

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack((r) => [getCurrentModel(), ...r]);
    setHistory((h) => h.slice(0, -1));
    onModelChange?.(prev);
    saveModel(prev);
    setCurrentModel(prev);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory((h) => [...h, getCurrentModel()]);
    setRedoStack((r) => r.slice(1));
    onModelChange?.(next);
    saveModel(next);
    setCurrentModel(next);
  };

  const saveVersionSnapshot = async () => {
    await fetch(`/api/bff/documents/${documentId}/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_model: getCurrentModel(),
        version_name: `Suggest mode ${new Date().toLocaleString()}`,
      }),
    });
  };

  const convertBlockToField = (blockId: string, fieldType: "text" | "multiline" | "checkbox" | "radio" | "select" | "date" | "signature") => {
    const current = getCurrentModel();
    const nextBlocks = (current.blocks ?? []).map((b) => {
      if (b.id !== blockId) return b;
      const label = b.content || "Field";
      return {
        ...b,
        type: "field",
        field_type: fieldType,
        field_id: `field_${blockId}`,
        label,
        required: false,
        placeholder: label,
        default_value: "",
        content: "",
      } as DocumentBlock;
    });
    const nextModel = { ...current, blocks: nextBlocks };
    pushToHistory(nextModel);
    saveModel(nextModel);
    setCurrentModel(nextModel);
  };

  return { history, redoStack, pushToHistory, undo, redo, saveVersionSnapshot, convertBlockToField };
}
