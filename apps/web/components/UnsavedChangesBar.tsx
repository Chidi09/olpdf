"use client";

import { ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { GlassPanel } from "@/components/ui/Glass";
import { Button } from "@/components/ui/button";
import { useDirtyStore } from "@/store/useDirtyStore";

export function UnsavedChangesBar({ onSave }: { onSave?: () => Promise<void> }) {
  const { isDirty, isSaving, setDirty, setSaving } = useDirtyStore();

  if (!isDirty) return null;

  const handleReset = () => {
    setDirty(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave?.();
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <GlassPanel className="flex items-center gap-6 px-4 py-3 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          Careful — you have unsaved changes!
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 text-xs">
            <ArrowUturnLeftIcon className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
          <Button variant="default" size="sm" onClick={handleSave} isLoading={isSaving} className="h-8 text-xs bg-white text-black">
            Save Changes
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
