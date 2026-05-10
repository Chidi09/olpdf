'use client'; // Next.js App Router compatible

import { useEffect, useRef, useCallback } from 'react';
import { OlPDFEmbed } from '@olpdf/embed';
import type { DocumentModel } from '@olpdf/embed';

export interface OlpdfEditorProps {
  /** Your OLPDF instance host. Defaults to https://olpdf.xyz */
  host?: string;
  /** The document ID to load */
  documentId: string;
  /** Short-lived embed token from your backend */
  token: string;
  /** Called on every AST edit with the full updated DocumentModel */
  onModelUpdate?: (model: DocumentModel) => void;
  /** Called when an export finishes with the download URL */
  onExportComplete?: (url: string) => void;
  /** Called when a new overflow page is added */
  onPageAdded?: (pageIndex: number, width: number, height: number) => void;
  /** Called when an overflow page is removed */
  onPageRemoved?: (pageIndex: number) => void;
  /** Called once the editor iframe is ready */
  onReady?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Drop-in OLPDF editor for React and Next.js.
 *
 * @example
 * // app/editor/page.tsx
 * import { OlpdfEditor } from '@olpdf/react';
 *
 * export default function EditorPage() {
 *   return (
 *     <OlpdfEditor
 *       documentId="doc_abc123"
 *       token={serverSideToken}
 *       onModelUpdate={(model) => myDB.save(model)}
 *       className="h-screen w-full"
 *     />
 *   );
 * }
 */
export function OlpdfEditor({
  host = 'https://olpdf.xyz',
  documentId,
  token,
  onModelUpdate,
  onExportComplete,
  onPageAdded,
  onPageRemoved,
  onReady,
  className,
  style,
}: OlpdfEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Stable callback refs so the effect doesn't re-run when callbacks change
  const onModelUpdateRef = useRef(onModelUpdate);
  const onExportCompleteRef = useRef(onExportComplete);
  const onPageAddedRef = useRef(onPageAdded);
  const onPageRemovedRef = useRef(onPageRemoved);
  const onReadyRef = useRef(onReady);

  useEffect(() => { onModelUpdateRef.current = onModelUpdate; }, [onModelUpdate]);
  useEffect(() => { onExportCompleteRef.current = onExportComplete; }, [onExportComplete]);
  useEffect(() => { onPageAddedRef.current = onPageAdded; }, [onPageAdded]);
  useEffect(() => { onPageRemovedRef.current = onPageRemoved; }, [onPageRemoved]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = new OlPDFEmbed(containerRef.current, { host, documentId, token });

    editor.on('READY', () => onReadyRef.current?.());
    editor.on('MODEL_UPDATE', ({ documentModel }) => onModelUpdateRef.current?.(documentModel));
    editor.on('EXPORT_COMPLETE', ({ url }) => onExportCompleteRef.current?.(url));
    editor.on('PAGE_ADDED', ({ pageIndex, width, height }) => onPageAddedRef.current?.(pageIndex, width, height));
    editor.on('PAGE_REMOVED', ({ pageIndex }) => onPageRemovedRef.current?.(pageIndex));

    return () => editor.destroy();
  }, [host, documentId, token]);

  return <div ref={containerRef} className={className} style={{ overflow: 'hidden', ...style }} />;
}
