import { ReactNode } from "react";
import { FolderSearch } from "lucide-react";

export function EmptyState({ 
  title, 
  description, 
  icon,
  action 
}: { 
  title: string; 
  description: string; 
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-[var(--border-subtle)] rounded-2xl bg-black/5">
      <div className="text-[var(--text-tertiary)] mb-4">
        {icon || <FolderSearch className="h-12 w-12" />}
      </div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
