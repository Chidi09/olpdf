import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid";
import { InlineSpinner } from "@/components/ui/MicroUI";

interface ImportStatusProps {
  status: string;
  progress: number;
  error: string | null;
  filename?: string;
  onCancel?: () => void;
}

function normalizeStatus(status: string): "idle" | "creating" | "reading" | "processing" | "ready" | "failed" {
  if (status === "idle") return "idle";
  if (status.includes("create")) return "creating";
  if (status.includes("read")) return "reading";
  if (status === "ready" || status === "completed" || status === "success") return "ready";
  if (status === "failed" || status === "error") return "failed";
  return "processing";
}

export function ImportStatusToast({ status, progress, error, filename = "Document", onCancel }: ImportStatusProps) {
  const normalized = normalizeStatus(status);
  if (normalized === "idle") return null;

  const isComplete = normalized === "ready";
  const isError = normalized === "failed";
  const isAborted = status === "aborted";

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 overflow-hidden rounded-lg border border-[#222] bg-[#0A0A0A] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#222] bg-[#050505] px-4 py-3">
        <span className="mr-2 truncate text-xs font-semibold text-[#ededed]">{filename}</span>
        {isComplete ? (
          <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
        ) : isError || isAborted ? (
          <ExclamationCircleIcon className="h-4 w-4 text-red-500" />
        ) : (
          <div className="inline-flex items-center gap-2">
            {onCancel && (
              <button onClick={onCancel} className="text-[10px] text-[#888] transition-colors hover:text-red-400">Cancel</button>
            )}
            <InlineSpinner className="h-4 w-4 text-[#888]" />
          </div>
        )}
      </div>

      <div className="space-y-2 bg-[#000] p-4 font-mono text-[10px] tracking-wide">
        <div className="text-[#888]">
          &gt; Initializing document block... done
        </div>
        <div className={progress >= 30 ? "text-[#888]" : "text-[#444]"}>
          &gt; Reading binary stream... {progress >= 30 && "done"}
        </div>
        <div className={progress >= 45 ? "text-orange-400" : "text-[#444]"}>
          &gt; Extracting semantic DOM... {progress}
          {progress < 100 && progress >= 45 && <span className="animate-pulse">_</span>}
        </div>
        {isAborted && <div className="mt-2 text-red-500">&gt; Operation aborted by user.</div>}
        {isError && <div className="mt-2 text-red-500">[Error]: {error}</div>}
      </div>

      {!isComplete && !isError && !isAborted && (
        <div className="h-0.5 w-full bg-[#222]">
          <div className="h-full bg-orange-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
        </div>
      )}
      {isAborted && (
        <div className="h-0.5 w-full bg-[#222]">
          <div className="h-full bg-red-500" style={{ width: `${Math.min(progress, 95)}%` }} />
        </div>
      )}
    </div>
  );
}
