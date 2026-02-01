import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import {
  Droplet,
  ExternalLink,
  Mail,
  PlayCircle,
  Undo
} from "lucide-react";
import "../style.css";

function App() {
  const [undoEnabled, setUndoEnabled] = useState(true);

  const toggleTrackClasses = undoEnabled
    ? "border-emerald-300/60 bg-emerald-400/50"
    : "border-white/20 bg-white/10";
  const toggleKnobClasses = undoEnabled
    ? "translate-x-5 bg-white"
    : "translate-x-0 bg-white/60";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-80 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5 text-white shadow-2xl shadow-[inset_1px_1px_0_rgba(255,255,255,0.16)] backdrop-blur-xl">
        <header className="space-y-3">
          <div className="flex items-center gap-2">
            <Droplet className="h-5 w-5 text-white/70" />
            <h1 className="text-base font-semibold tracking-wide">
              Prompt Efficiency Tool
            </h1>
          </div>
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-white/60">
            0 bottles saved
          </span>
        </header>

        <section className="mt-5 border-t border-white/10 pt-4">
          <button
            className="flex w-full items-center justify-between"
            onClick={() => setUndoEnabled((value) => !value)}
            type="button"
            aria-pressed={undoEnabled}
            aria-label="Enable Undo"
          >
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Undo
                className={
                  undoEnabled ? "h-4 w-4 text-emerald-300" : "h-4 w-4 text-white/50"
                }
              />
              <span>Enable Undo</span>
            </div>
            <span
              className={`relative h-6 w-11 rounded-full border transition hover:brightness-110 ${toggleTrackClasses}`}
              aria-hidden="true"
            >
              <span
                className={`absolute left-1 top-1 h-4 w-4 rounded-full shadow-md transition ${toggleKnobClasses}`}
              />
            </span>
          </button>
        </section>

        <footer className="mt-5 border-t border-white/10 pt-4 text-xs text-white/60">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-white/50" />
            <span>sreekarbatchu@gmail.com</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <a
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-white/70 transition hover:bg-white/20 hover:text-white/90"
              href="#"
            >
              <PlayCircle className="h-4 w-4" />
              Watch Tutorial
            </a>
            <a
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-white/70 transition hover:bg-white/20 hover:text-white/90"
              href="#"
            >
              <ExternalLink className="h-4 w-4" />
              Visit Website
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
