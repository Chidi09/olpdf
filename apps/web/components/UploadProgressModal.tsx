"use client";

type Props = {
  open: boolean;
  title?: string;
  status: string;
  progress: number;
  error?: string | null;
  onClose: () => void;
};

export default function UploadProgressModal({ open, title = "Importing PDF", status, progress, error, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl">
        <h3 className="text-lg font-black">{title}</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Status: {status}</p>
        <div className="mt-4 h-2 w-full rounded-full bg-[var(--bg-base)] overflow-hidden">
          <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
        <p className="mt-2 text-xs font-bold text-[var(--text-tertiary)]">{progress}%</p>
        {error && <p className="mt-3 text-xs font-bold text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-sm font-bold">Close</button>
        </div>
      </div>
    </div>
  );
}
