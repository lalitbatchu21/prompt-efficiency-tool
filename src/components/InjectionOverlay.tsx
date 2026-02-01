import React from "react";
import { Droplets, RotateCcw } from "lucide-react";

type InjectionOverlayProps = {
  onCompress: () => void;
  onUndo: () => void;
  showUndo: boolean;
};

const iconButtonBase =
  "group relative grid h-8 w-8 place-items-center rounded-full " +
  "bg-white/20 text-white transition " +
  "hover:bg-white/30 focus:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-white/60";

export function InjectionOverlay({
  onCompress,
  onUndo,
  showUndo
}: InjectionOverlayProps) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-white/10 px-2 py-1 text-white backdrop-blur-lg border border-white/20 shadow-xl">
      <button
        type="button"
        className={`${iconButtonBase} hover:shadow-[0_0_16px_rgba(255,255,255,0.45)]`}
        aria-label="Compress prompt"
        onClick={onCompress}
      >
        <Droplets className="h-4 w-4" />
      </button>
      {showUndo ? (
        <button
          type="button"
          className={`${iconButtonBase} hover:shadow-[0_0_16px_rgba(255,255,255,0.35)]`}
          aria-label="Undo compression"
          onClick={onUndo}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
