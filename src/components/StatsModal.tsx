import React, { useEffect, useState } from "react";
import { GlassPanel } from "./GlassPanel";

type StatsModalProps = {
  isOpen: boolean;
  bottlesSaved: number;
  showUndo: boolean;
  onClose: () => void;
  onToggleUndo: (next: boolean) => void;
  onTutorial?: () => void;
};

export function StatsModal({
  isOpen,
  bottlesSaved,
  showUndo,
  onClose,
  onToggleUndo,
  onTutorial
}: StatsModalProps) {
  const [localShowUndo, setLocalShowUndo] = useState(showUndo);

  useEffect(() => {
    setLocalShowUndo(showUndo);
  }, [showUndo]);

  const handleToggle = async (next: boolean) => {
    setLocalShowUndo(next);
    await chrome.storage.local.set({ showUndo: next });
    onToggleUndo(next);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <GlassPanel className="max-w-md w-full mx-4 text-white">
        <div className="flex items-start justify-between border-b border-white/20 px-5 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-wide">
              Prompt Efficiency Tool
            </h2>
            <span className="text-xs uppercase tracking-[0.2em] text-white/70">
              {bottlesSaved} Bottles Saved
            </span>
          </div>
          <button
            type="button"
            className="rounded-full px-2 py-1 text-white/80 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="Close"
            onClick={onClose}
          >
            x
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
            Settings
          </div>
          <label className="mt-4 flex items-center justify-between gap-4 text-sm text-white/90">
            <span>Enable Undo Button</span>
            <span className="relative inline-flex items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={localShowUndo}
                onChange={(event) => handleToggle(event.target.checked)}
              />
              <span className="h-6 w-11 rounded-full border border-white/30 bg-white/20 transition peer-checked:bg-white/40" />
              <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white/80 transition-transform peer-checked:translate-x-5" />
            </span>
          </label>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/20 px-5 py-4 text-sm">
          <a
            className="text-white/70 transition hover:text-white"
            href="mailto:sreekarbatchu@gmail.com"
          >
            sreekarbatchu@gmail.com
          </a>
          <button
            type="button"
            className="rounded-full border border-white/30 px-4 py-1.5 text-white/90 transition hover:border-white/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            onClick={onTutorial}
          >
            Tutorial
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
