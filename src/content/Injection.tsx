import { useRef } from "react";
import { Droplet, Undo } from "lucide-react";
import { getPromptValue, setPromptValue } from "../utils/domUtils";

export default function Injection() {
  const lastPromptRef = useRef<string | null>(null);

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
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 transition-all duration-200 ease-in-out hover:bg-white/10 hover:text-zinc-100 active:scale-95"
        onClick={() => {
          const previous = lastPromptRef.current;
          if (previous !== null) {
            setPromptValue(previous);
          }
        }}
      >
        <Undo className="h-4 w-4" />
        Undo
      </button>
    </div>
  );
}
