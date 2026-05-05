import { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export function ErrorState({ 
  title = "Something went wrong", 
  message, 
  onRetry 
}: { 
  title?: string; 
  message?: string; 
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-[var(--border-subtle)] rounded-2xl bg-red-500/5">
      <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
      <h3 className="text-lg font-bold text-red-500 mb-2">{title}</h3>
      {message && <p className="text-sm text-red-400/80 max-w-md mb-6">{message}</p>}
      {onRetry && (
        <button 
          onClick={onRetry}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-bold rounded"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
