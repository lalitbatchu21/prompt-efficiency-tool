import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  Droplet,
  ExternalLink,
  Github,
  Mail,
  PlayCircle,
  Undo
} from "lucide-react";
import "../style.css";
import { getStorage, setStorage } from "../utils/storage";

function App() {
  const [bottlesSaved, setBottlesSaved] = useState(0);
  const [undoEnabled, setUndoEnabled] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalWater, setTotalWater] = useState(0);
  const [totalEnergy, setTotalEnergy] = useState(0);

  useEffect(() => {
    let mounted = true;

    getStorage().then((state) => {
      if (!mounted) return;
      setBottlesSaved(state.bottlesSaved);
      setUndoEnabled(state.undoEnabled);
      setIsLoaded(true);
    });

    chrome.storage.local.get(
      { totalTokens: 0, totalWater: 0, totalEnergy: 0 },
      (items) => {
        if (!mounted) return;
        setTotalTokens(Number(items.totalTokens ?? 0));
        setTotalWater(Number(items.totalWater ?? 0));
        setTotalEnergy(Number(items.totalEnergy ?? 0));
      }
    );

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "local") return;
      if (changes.bottlesSaved) {
        setBottlesSaved(changes.bottlesSaved.newValue ?? 0);
      }
      if (changes.undoEnabled) {
        setUndoEnabled(Boolean(changes.undoEnabled.newValue));
      }
      if (changes.totalTokens) {
        setTotalTokens(Number(changes.totalTokens.newValue ?? 0));
      }
      if (changes.totalWater) {
        setTotalWater(Number(changes.totalWater.newValue ?? 0));
      }
      if (changes.totalEnergy) {
        setTotalEnergy(Number(changes.totalEnergy.newValue ?? 0));
      }
    };

    chrome.storage.onChanged.addListener(listener);

    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  const toggleTrackClasses = undoEnabled
    ? "border-emerald-300/60 bg-emerald-400/50"
    : "border-white/20 bg-white/10";
  const toggleKnobClasses = undoEnabled
    ? "translate-x-5 bg-white"
    : "translate-x-0 bg-white/60";
  const bottleMl = 500;
  const bottlesFromWater = totalWater / bottleMl;
  const bottlesLabel =
    bottlesFromWater === 1
      ? "1.00 bottle saved"
      : `${bottlesFromWater.toFixed(2)} bottles saved`;
  const phoneCharges = totalEnergy / 12;
  const chargesLabel =
    phoneCharges === 1
      ? "1 phone charge"
      : `${phoneCharges.toFixed(1)} phone charges`;

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-80 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5 text-xs uppercase tracking-wide text-white/50 shadow-2xl shadow-[inset_1px_1px_0_rgba(255,255,255,0.16)] backdrop-blur-xl">
          Loading...
        </div>
      </div>
    );
  }

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
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-white/60">
              {bottlesLabel}
            </span>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-white/60">
              {chargesLabel}
            </span>
          </div>
        </header>

        <section className="mt-5 border-t border-white/10 pt-4">
          <button
            className="flex w-full items-center justify-between"
            onClick={() => {
              const next = !undoEnabled;
              setUndoEnabled(next);
              void setStorage({ undoEnabled: next });
            }}
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

        <section className="mt-5 border-t border-white/10 pt-4">
          <p className="text-xs uppercase tracking-wide text-white/50">
            Eco stats
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-white/70">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <p className="text-[10px] uppercase tracking-wide text-white/40">
                Tokens
              </p>
              <p className="mt-1 text-sm font-semibold text-white/90">
                {Math.round(totalTokens)}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <p className="text-[10px] uppercase tracking-wide text-white/40">
                Water
              </p>
              <p className="mt-1 text-sm font-semibold text-white/90">
                {totalWater.toFixed(1)} ml
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <p className="text-[10px] uppercase tracking-wide text-white/40">
                Energy
              </p>
              <p className="mt-1 text-sm font-semibold text-white/90">
                {totalEnergy.toFixed(2)} Wh
              </p>
            </div>
          </div>
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
              <ExternalLink className="h-4 w-4" />
              Visit Website
            </a>
            <a
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-white/70 transition hover:bg-white/20 hover:text-white/90"
              href="https://github.com/lalitbatchu21/prompt-efficiency-tool"
              target="_blank"
              rel="noreferrer"
            >
              <Github className="h-4 w-4" />
              Open Source
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
