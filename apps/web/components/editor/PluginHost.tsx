'use client'

import { useEffect, useRef } from 'react';
import type { DocumentBlock } from '@olpdf/document-model';

interface PluginHostProps {
  bundleUrl: string;
  documentId: string;
  blocks: DocumentBlock[];
  onUpdateBlock: (blockId: string, content: string) => void;
  onEmitNotification: (message: string, type: 'info' | 'error') => void;
}

export function PluginHost({ 
  bundleUrl, 
  documentId, 
  blocks, 
  onUpdateBlock,
  onEmitNotification 
}: PluginHostProps) {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // 1. Create the sandbox worker
    // The worker code itself acts as the SDK entry point
    const workerCode = `
      const blocks = [];
      
      const olpdf = {
        getBlocks: () => blocks,
        updateBlock: (id, content) => {
          self.postMessage({ type: 'UPDATE_BLOCK', payload: { id, content } });
        },
        notify: (message, type = 'info') => {
          self.postMessage({ type: 'NOTIFY', payload: { message, type } });
        }
      };

      self.onmessage = async (e) => {
        const { type, payload } = e.data;
        
        if (type === 'INIT') {
          try {
            // In a real env, we'd use importScripts or a bundler
            // For the demo/sandbox, we assume the bundleUrl is valid
            importScripts(payload.bundleUrl);
            self.postMessage({ type: 'READY' });
          } catch (err) {
            self.postMessage({ type: 'ERROR', payload: err.message });
          }
        }
        
        if (type === 'SYNC_BLOCKS') {
          blocks.length = 0;
          blocks.push(...payload);
        }

        // Hook execution
        if (type === 'EXECUTE_HOOK') {
          if (typeof self[payload.hookName] === 'function') {
            try {
              await self[payload.hookName](olpdf, payload.args);
            } catch (err) {
              olpdf.notify('Plugin Error: ' + err.message, 'error');
            }
          }
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'UPDATE_BLOCK') {
        onUpdateBlock(payload.id, payload.content);
      } else if (type === 'NOTIFY') {
        onEmitNotification(payload.message, payload.type);
      } else if (type === 'READY') {
        // Plugin ready
      } else if (type === 'ERROR') {
        onEmitNotification('Failed to load plugin: ' + payload, 'error');
      }
    };

    worker.postMessage({ type: 'INIT', payload: { bundleUrl } });

    return () => {
      worker.terminate();
    };
  }, [bundleUrl]);

  // Sync blocks whenever they change
  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'SYNC_BLOCKS', payload: blocks });
    }
  }, [blocks]);

  return null; // Headless component
}
