import { useEffect, useRef, useState } from "react";
import { Check, Droplet, Undo } from "lucide-react";
import { getPromptValue, setPromptValue } from "../utils/domUtils";
import { getGeminiPromptValue, setGeminiPromptValue } from "../utils/geminiDomUtils";
import { logEcoStats, processSavings } from "../utils/ecoStats";
import { getStorage } from "../utils/storage";

const HOSTNAME = window.location.hostname;
const IS_GEMINI = HOSTNAME === "gemini.google.com";
const IS_CLAUDE = HOSTNAME.includes("claude.ai");

export default function Injection() {
  const lastPromptRef = useRef<string | null>(null);
  const [undoEnabled, setUndoEnabled] = useState(true);
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [undoSpinning, setUndoSpinning] = useState(false);

  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "is",
    "are",
    "was",
    "were",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with"
  ]);

  const querySelectorDeep = <T extends Element>(
    root: ParentNode,
    selectors: string[]
  ): T | null => {
    for (const selector of selectors) {
      const direct = root.querySelector<T>(selector);
      if (direct) return direct;
    }

    const nodes = root.querySelectorAll<HTMLElement>("*");
    for (const node of nodes) {
      const shadowRoot = node.shadowRoot;
      if (!shadowRoot) continue;
      const found = querySelectorDeep<T>(shadowRoot, selectors);
      if (found) return found;
    }

    return null;
  };

  const getClaudeEditor = (): HTMLElement | null =>
    querySelectorDeep<HTMLElement>(document, [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][data-slate-editor="true"]',
      'div[contenteditable="true"][data-lexical-editor="true"]',
      'div[contenteditable="true"]'
    ]);

  const readClaudePrompt = () => {
    const editor = getClaudeEditor();
    if (!editor) return "";
    return editor.innerText ?? editor.textContent ?? "";
  };

  const writeClaudePrompt = (value: string) => {
    const editor = getClaudeEditor();
    if (!editor) return;

    const selectAllEditor = (): boolean => {
      const selection = window.getSelection();
      if (!selection) return false;
      selection.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.addRange(range);
      return true;
    };

    const dispatchBeforeInput = (inputType: string, data?: string) => {
      if (typeof InputEvent === "undefined") return;
      const event = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType,
        data
      });
      editor.dispatchEvent(event);
    };

    try {
      editor.focus();
      selectAllEditor();
      dispatchBeforeInput("deleteByCut");
      document.execCommand("delete", false);

      if (value.length === 0) {
        const clearEvent =
          typeof InputEvent !== "undefined"
            ? new InputEvent("input", {
                bubbles: true,
                cancelable: true,
                inputType: "deleteContentBackward"
              })
            : new Event("input", { bubbles: true });
        editor.dispatchEvent(clearEvent);
        return;
      }

      let updated = false;
      if (typeof DataTransfer !== "undefined" && typeof ClipboardEvent !== "undefined") {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData("text/plain", value);
        const pasteEvent = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer
        });
        updated = editor.dispatchEvent(pasteEvent);
      }

      if (!updated) {
        dispatchBeforeInput("insertText", value);
        document.execCommand("insertText", false, value);
      }

      const inputEvent =
        typeof InputEvent !== "undefined"
          ? new InputEvent("input", {
              bubbles: true,
              cancelable: true,
              inputType: "insertText",
              data: value
            })
          : new Event("input", { bubbles: true });
      editor.dispatchEvent(inputEvent);
    } catch {
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  const readPrompt = () =>
    IS_CLAUDE ? readClaudePrompt() : IS_GEMINI ? getGeminiPromptValue() : getPromptValue();
  const writePrompt = (value: string) => {
    if (IS_CLAUDE) {
      writeClaudePrompt(value);
    } else if (IS_GEMINI) {
      setGeminiPromptValue(value);
    } else {
      setPromptValue(value);
    }
  };

  const handleCompress = () => {
    const originalText = readPrompt();
    console.log(`Read: ${originalText}`);
    lastPromptRef.current = originalText;

    const words = originalText.split(/\s+/).filter(Boolean);
    const filtered = words.filter((word) => !stopWords.has(word.toLowerCase()));
    const compressedText = filtered.join(" ");

    const savings = processSavings(originalText, compressedText);
    console.log(
      "Compressed:",
      originalText.length,
      "->",
      compressedText.length,
      "Savings:",
      savings
    );

    writePrompt(compressedText);
    void logEcoStats(savings);

    setStatus("success");
    window.setTimeout(() => setStatus("idle"), 2000);
  };

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

  useEffect(() => {
    if (!IS_CLAUDE) return;

    const host = document.getElementById("prompt-efficiency-root");
    if (!host) return;

    const locate = () => {
      const sendButton =
        document.querySelector<HTMLButtonElement>('button[aria-label*="Send"]') ??
        document.querySelectorAll<HTMLButtonElement>("button").item(
          document.querySelectorAll("button").length - 1
        );
      const container = sendButton?.parentElement ?? sendButton?.closest("div");
      if (!container || host.parentElement === container) return;

      container.insertBefore(host, sendButton ?? container.firstChild);
    };

    locate();
    const observer = new MutationObserver(() => locate());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const geminiClass = IS_GEMINI ? "eco-btn-gemini" : "";
  const claudeClass = IS_CLAUDE ? "eco-btn-claude" : "";

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
          className={`pet-ghost inline-flex items-center gap-2 rounded-lg bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all duration-200 ease-in-out hover:bg-white/10 hover:text-zinc-100 active:scale-90 transition-transform duration-100 ${geminiClass} ${claudeClass} ${
            status === "success" ? "text-emerald-400" : "text-zinc-400"
          }`}
          onClick={handleCompress}
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
            className={`pet-ghost inline-flex items-center gap-2 rounded-lg bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 transition-all duration-200 ease-in-out hover:bg-white/10 hover:text-zinc-100 active:scale-90 transition-transform duration-100 ${geminiClass} ${claudeClass}`}
            onClick={() => {
              setUndoSpinning(true);
              window.setTimeout(() => setUndoSpinning(false), 400);
              const previous = lastPromptRef.current;
              if (previous !== null) {
                console.log("Undo: restoring previous prompt");
                writePrompt(previous);
                return;
              }

              const current = readPrompt();
              if (current.endsWith(" [Verified]")) {
                const restored = current.replace(/\\s\\[Verified\\]$/, "");
                console.log("Undo: stripping verified suffix");
                writePrompt(restored);
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
