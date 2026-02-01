import { useEffect, useRef, useState } from "react";
import { Check, Droplet, Undo } from "lucide-react";
import { getPromptValue, setPromptValue } from "../utils/domUtils";
import { getStorage } from "../utils/storage";

export default function Injection() {
  const lastPromptRef = useRef<string | null>(null);
  const [undoEnabled, setUndoEnabled] = useState(true);
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [undoSpinning, setUndoSpinning] = useState(false);

  useEffect(() => {
    let mounted = true;

    getStorage().then((state) => {
      if (!mounted) return;
      setUndoEnabled(state.undoEnabled);
    });

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "local") return;
      if (changes.undoEnabled) {
        setUndoEnabled(Boolean(changes.undoEnabled.newValue));
      }
    };

    chrome.storage.onChanged.addListener(listener);

    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

    return (
      <div className="pointer-events-auto flex items-center gap-1 pet-fade-in">
      <style>{`
        .pet-fade-in {
          animation: pet-fade-in 240ms ease-out;
        }
        @keyframes pet-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pet-ghost {
          position: relative;
          overflow: hidden;
        }
        .pet-ghost::after {
          content: "";
          position: absolute;
          inset: 0;
          opacity: 0;
          background: radial-gradient(circle at center, rgba(255,255,255,0.35), transparent 65%);
          transition: opacity 200ms ease;
        }
        .pet-ghost:active::after {
          opacity: 1;
        }
        .pet-tooltip {
          pointer-events: none;
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 160ms ease, transform 160ms ease;
        }
        .pet-group:hover .pet-tooltip {
          opacity: 1;
          transform: translateY(0);
        }
        .rotate-360 {
          transform: rotate(360deg);
        }
      `}</style>

      <div className="relative pet-group">
        <button
          type="button"
          className={`pet-ghost inline-flex items-center gap-2 rounded-lg bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all duration-200 ease-in-out hover:bg-white/10 hover:text-zinc-100 active:scale-90 transition-transform duration-100 ${
            status === "success" ? "text-emerald-400" : "text-zinc-400"
          }`}
          onClick={() => {
            const text = getPromptValue();
            console.log(`Read: ${text}`);
            lastPromptRef.current = text;
            setPromptValue(`${text} [Verified]`);
            setStatus("success");
            window.setTimeout(() => setStatus("idle"), 2000);
          }}
        >
          {status === "success" ? <Check className="h-4 w-4" /> : <Droplet className="h-4 w-4" />}
          {status === "success" ? "Saved" : "Compress"}
        </button>
        <div className="pet-tooltip absolute -top-8 left-1/2 -translate-x-1/2 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[10px] uppercase tracking-wide text-white/80 shadow-lg">
          Compress prompt
        </div>
      </div>

      {undoEnabled ? (
        <div className="relative pet-group">
          <button
            type="button"
            className="pet-ghost inline-flex items-center gap-2 rounded-lg bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 transition-all duration-200 ease-in-out hover:bg-white/10 hover:text-zinc-100 active:scale-90 transition-transform duration-100"
            onClick={() => {
              setUndoSpinning(true);
              window.setTimeout(() => setUndoSpinning(false), 400);
              const previous = lastPromptRef.current;
              if (previous !== null) {
                console.log("Undo: restoring previous prompt");
                setPromptValue(previous);
                return;
              }

              const current = getPromptValue();
              if (current.endsWith(" [Verified]")) {
                const restored = current.replace(/\\s\\[Verified\\]$/, "");
                console.log("Undo: stripping verified suffix");
                setPromptValue(restored);
              } else {
                console.log("Undo: no previous prompt captured");
              }
            }}
          >
            <Undo className={`h-4 w-4 transition-transform duration-300 ${undoSpinning ? "rotate-360" : ""}`} />
            Undo
          </button>
          <div className="pet-tooltip absolute -top-8 left-1/2 -translate-x-1/2 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[10px] uppercase tracking-wide text-white/80 shadow-lg">
            Restore last prompt
          </div>
        </div>
      ) : null}
    </div>
  );
}
