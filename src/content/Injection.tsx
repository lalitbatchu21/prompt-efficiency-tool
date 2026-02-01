import { useEffect, useRef, useState } from "react";
import { Droplet, Undo } from "lucide-react";
import { getPromptValue, setPromptValue } from "../utils/domUtils";
import { getStorage } from "../utils/storage";

export default function Injection() {
  const lastPromptRef = useRef<string | null>(null);
  const [undoEnabled, setUndoEnabled] = useState(true);

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
    <div className="pointer-events-auto flex items-center gap-1">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 transition-all duration-200 ease-in-out hover:bg-white/10 hover:text-zinc-100 active:scale-95"
        onClick={() => {
          const text = getPromptValue();
          console.log(`Read: ${text}`);
          lastPromptRef.current = text;
          setPromptValue(`${text} [Verified]`);
        }}
      >
        <Droplet className="h-4 w-4" />
        Compress
      </button>
      {undoEnabled ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 transition-all duration-200 ease-in-out hover:bg-white/10 hover:text-zinc-100 active:scale-95"
          onClick={() => {
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
          <Undo className="h-4 w-4" />
          Undo
        </button>
      ) : null}
    </div>
  );
}
