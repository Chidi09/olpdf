"use client";

import { useMemo, useState } from "react";

export interface EditorComment {
  id: string;
  block_id?: string | null;
  page_index: number;
  body: string;
  parent_id?: string | null;
  resolved?: boolean;
  position?: { x?: number; y?: number; width?: number; height?: number };
}

interface CommentSidebarProps {
  openThreadKey: string | null;
  comments: EditorComment[];
  onClose: () => void;
  onResolveThread: (commentIds: string[]) => void;
  onAddReply: (body: string, parentId?: string) => void;
}

export function CommentSidebar({ openThreadKey, comments, onClose, onResolveThread, onAddReply }: CommentSidebarProps) {
  const [reply, setReply] = useState("");

  const threadComments = useMemo(() => {
    if (!openThreadKey) return [];
    return comments.filter((c) => {
      const key = c.block_id ?? `page_${c.page_index}`;
      return key === openThreadKey;
    });
  }, [comments, openThreadKey]);

  if (!openThreadKey) return null;

  const roots = threadComments.filter((c) => !c.parent_id);

  return (
    <aside className="fixed right-4 top-24 z-50 w-[340px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Comments</h3>
        <button onClick={onClose} className="rounded px-2 py-1 text-xs hover:bg-[var(--bg-glass-subtle)]">Close</button>
      </div>

      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {roots.map((root) => {
          const replies = threadComments.filter((c) => c.parent_id === root.id);
          return (
            <div key={root.id} className="rounded-lg border border-[var(--border-subtle)] p-2">
              <div className="text-xs text-[var(--text-primary)]">{root.body}</div>
              {replies.length > 0 && (
                <div className="mt-2 space-y-1 border-l border-[var(--border-subtle)] pl-2">
                  {replies.map((replyItem) => (
                    <div key={replyItem.id} className="text-xs text-[var(--text-secondary)]">
                      {replyItem.body}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 space-y-2">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply..."
          className="h-20 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2 text-xs"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const root = roots[0];
              if (!reply.trim()) return;
              onAddReply(reply.trim(), root?.id);
              setReply("");
            }}
            className="rounded bg-[var(--accent)] px-2 py-1 text-xs text-white"
          >
            Reply
          </button>
          <button
            onClick={() => onResolveThread(threadComments.map((c) => c.id))}
            className="rounded px-2 py-1 text-xs hover:bg-[var(--bg-glass-subtle)]"
          >
            Resolve
          </button>
        </div>
      </div>
    </aside>
  );
}
