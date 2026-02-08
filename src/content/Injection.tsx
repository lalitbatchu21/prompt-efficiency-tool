import { useEffect, useRef, useState } from "react";
import { Check, Droplet, Undo } from "lucide-react";
import { getPromptValue, setPromptValue } from "../utils/domUtils";
import { getGeminiPromptValue, setGeminiPromptValue } from "../utils/geminiDomUtils";
import { logEcoStats, processSavings } from "../utils/ecoStats";
import { getStorage } from "../utils/storage";

const HOSTNAME = window.location.hostname;
const IS_GEMINI = HOSTNAME === "gemini.google.com";
const IS_CLAUDE = HOSTNAME.includes("claude.ai");
const IS_GROK = HOSTNAME === "grok.com" || HOSTNAME.endsWith(".grok.com");
const IS_DEEPSEEK = HOSTNAME === "chat.deepseek.com";
const IS_PERPLEXITY =
  HOSTNAME === "perplexity.ai" || HOSTNAME === "www.perplexity.ai";

export default function Injection() {
  const undoStackRef = useRef<string[]>([]);
  const lastFocusedEditorRef = useRef<HTMLElement | HTMLTextAreaElement | null>(null);
  const [undoEnabled, setUndoEnabled] = useState(true);
  const [status, setStatus] = useState<"idle" | "success">("idle");
  const [undoSpinning, setUndoSpinning] = useState(false);
  const statusTimeoutRef = useRef<number | null>(null);

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

  const isElementVisible = (element: Element | null): element is HTMLElement => {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const findEditorNearHost = <T extends Element>(selectors: string[]): T | null => {
    const host = document.getElementById("prompt-efficiency-root");
    if (!host) return null;

    let node: HTMLElement | null = host;
    while (node) {
      const found = querySelectorDeep<T>(node, selectors);
      if (found && found.id !== "prompt-efficiency-root") return found;
      node = node.parentElement;
    }

    return null;
  };

  const matchesEditable = (node: EventTarget | null): node is HTMLElement => {
    if (!(node instanceof HTMLElement)) return false;
    if (node.tagName === "TEXTAREA") return true;
    if (node.classList.contains("ProseMirror")) return true;
    return node.isContentEditable;
  };

  const getClaudeEditor = (): HTMLElement | null =>
    querySelectorDeep<HTMLElement>(document, [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][data-slate-editor="true"]',
      'div[contenteditable="true"][data-lexical-editor="true"]',
      'div[contenteditable="true"]'
    ]);

  const getGrokEditor = (): HTMLElement | HTMLTextAreaElement | null => {
    const selectors = [
      "textarea",
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][data-slate-editor="true"]',
      'div[contenteditable="true"][data-lexical-editor="true"]',
      'div[contenteditable="true"]'
    ];
    const scoped = findEditorNearHost<HTMLElement>(selectors);
    if (scoped) return scoped;
    return querySelectorDeep<HTMLElement>(document, selectors);
  };

  const getDeepSeekEditor = (): HTMLElement | HTMLTextAreaElement | null => {
    const selectors = [
      "textarea",
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ];
    const scoped = findEditorNearHost<HTMLElement>(selectors);
    if (scoped) return scoped;
    return querySelectorDeep<HTMLElement>(document, selectors);
  };

  const getPerplexityEditor = (): HTMLElement | HTMLTextAreaElement | null => {
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;
    const anchorElement =
      anchorNode instanceof HTMLElement
        ? anchorNode
        : anchorNode?.parentElement ?? null;
    const fromSelection = anchorElement?.closest<HTMLElement>(
      '#ask-input[contenteditable="true"], div[data-lexical-editor="true"][contenteditable="true"], div[contenteditable="true"][role="textbox"], div[contenteditable="true"]'
    );
    if (fromSelection && isElementVisible(fromSelection)) {
      return fromSelection;
    }

    const askInput = document.getElementById("ask-input");
    if (
      askInput instanceof HTMLElement &&
      askInput.isContentEditable &&
      isElementVisible(askInput)
    ) {
      return askInput;
    }

    if (matchesEditable(document.activeElement) && isElementVisible(document.activeElement)) {
      return document.activeElement;
    }

    if (lastFocusedEditorRef.current?.isConnected && isElementVisible(lastFocusedEditorRef.current)) {
      return lastFocusedEditorRef.current;
    }

    const lexicalById = Array.from(
      document.querySelectorAll<HTMLElement>(
        '#ask-input[data-lexical-editor="true"][contenteditable="true"]'
      )
    ).find(isElementVisible);
    if (lexicalById) return lexicalById;

    const lexicalGeneric = Array.from(
      document.querySelectorAll<HTMLElement>(
        'div[data-lexical-editor="true"][contenteditable="true"]'
      )
    ).find(isElementVisible);
    if (lexicalGeneric) return lexicalGeneric;

    const lexicalByIdAny = document.querySelector<HTMLElement>(
      '#ask-input[data-lexical-editor="true"][contenteditable="true"]'
    );
    if (lexicalByIdAny) return lexicalByIdAny;

    const lexicalGenericAny = document.querySelector<HTMLElement>(
      'div[data-lexical-editor="true"][contenteditable="true"]'
    );
    if (lexicalGenericAny) return lexicalGenericAny;

    const selectors = [
      ".ProseMirror",
      '#ask-input[contenteditable="true"]',
      'div[data-lexical-editor="true"][contenteditable="true"]',
      "textarea",
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ];
    const scoped = findEditorNearHost<HTMLElement>(selectors);
    if (scoped) return scoped;
    return querySelectorDeep<HTMLElement>(document, selectors);
  };

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

  const readGrokPrompt = () => {
    const editor = getGrokEditor();
    if (!editor) {
      console.warn("Prompt Efficiency Tool: Grok editor not found");
      return "";
    }
    if (editor instanceof HTMLTextAreaElement) {
      return editor.value ?? "";
    }
    return editor.innerText ?? editor.textContent ?? "";
  };

  const readDeepSeekPrompt = () => {
    const editor = getDeepSeekEditor();
    if (!editor) {
      console.warn("Prompt Efficiency Tool: DeepSeek editor not found");
      return "";
    }
    if (editor instanceof HTMLTextAreaElement) {
      return editor.value ?? "";
    }
    return editor.innerText ?? editor.textContent ?? "";
  };

  const readPerplexityPrompt = () => {
    const editor = getPerplexityEditor();
    if (!editor) {
      console.warn("Prompt Efficiency Tool: Perplexity editor not found");
      return "";
    }
    if (editor instanceof HTMLTextAreaElement) {
      return editor.value ?? "";
    }
    return editor.innerText ?? editor.textContent ?? "";
  };

  const writeGrokPrompt = (value: string) => {
    const editor = getGrokEditor();
    if (!editor) {
      console.warn("Prompt Efficiency Tool: Grok editor not found");
      return;
    }

    if (editor instanceof HTMLTextAreaElement) {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      );
      const setter = descriptor?.set;
      if (setter) {
        setter.call(editor, value);
      } else {
        editor.value = value;
      }
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    try {
      editor.focus();
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection.addRange(range);
      }

      document.execCommand("selectAll", false);
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

  const writeDeepSeekPrompt = (value: string) => {
    const editor = getDeepSeekEditor();
    if (!editor) {
      console.warn("Prompt Efficiency Tool: DeepSeek editor not found");
      return;
    }

    if (editor instanceof HTMLTextAreaElement) {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      );
      const setter = descriptor?.set;
      if (setter) {
        setter.call(editor, value);
      } else {
        editor.value = value;
      }
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    try {
      editor.focus();
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection.addRange(range);
      }

      document.execCommand("selectAll", false);
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

      document.execCommand("insertText", false, value);
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

  const writePerplexityPrompt = (value: string) => {
    const editor = getPerplexityEditor();
    if (!editor) {
      console.warn("Prompt Efficiency Tool: Perplexity editor not found");
      return;
    }

    if (editor instanceof HTMLTextAreaElement) {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      );
      const setter = descriptor?.set;
      if (setter) {
        setter.call(editor, value);
      } else {
        editor.value = value;
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
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
    const expected = normalize(value);
    const current = () => normalize(editor.innerText ?? editor.textContent ?? "");
    const selectAll = (): boolean => {
      editor.focus();
      const selection = window.getSelection();
      if (!selection) return false;
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    };
    const ensureFullEditorSelection = (): boolean => {
      editor.focus();
      document.execCommand("selectAll", false);
      const selectedViaCommand = normalize(window.getSelection()?.toString() ?? "");
      const currentText = current();
      if (currentText.length === 0 || selectedViaCommand === currentText) return true;

      if (!selectAll()) return false;
      const selectedViaRange = normalize(window.getSelection()?.toString() ?? "");
      return currentText.length === 0 || selectedViaRange === currentText;
    };
    const dispatchInput = (inputType: string, data: string | null) => {
      if (typeof InputEvent !== "undefined") {
        editor.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            inputType,
            data
          })
        );
      } else {
        editor.dispatchEvent(new Event("input", { bubbles: true }));
      }
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const replaceWithPaste = (): boolean => {
      if (!ensureFullEditorSelection()) return false;
      if (typeof DataTransfer === "undefined" || typeof ClipboardEvent === "undefined") {
        return false;
      }

      if (value.length === 0) {
        if (typeof InputEvent !== "undefined") {
          editor.dispatchEvent(
            new InputEvent("beforeinput", {
              bubbles: true,
              cancelable: true,
              inputType: "deleteByCut"
            })
          );
        }
        const deleted = document.execCommand("delete", false);
        dispatchInput("deleteContentBackward", null);
        return deleted;
      }

      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", value);
      if (typeof InputEvent !== "undefined") {
        editor.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertFromPaste",
            data: value
          })
        );
      }
      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
      });
      return editor.dispatchEvent(pasteEvent);
    };
    const replaceWithExec = (): boolean => {
      if (!ensureFullEditorSelection()) return false;
      if (typeof InputEvent !== "undefined") {
        editor.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "deleteByCut"
          })
        );
      }
      const deleted = document.execCommand("delete", false);

      if (value.length === 0) {
        dispatchInput("deleteContentBackward", null);
        return deleted;
      }

      // Ensure insertion starts from an empty editor to prevent accidental appends.
      const selection = window.getSelection();
      if (selection) {
        const startRange = document.createRange();
        startRange.selectNodeContents(editor);
        startRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(startRange);
      }

      if (typeof InputEvent !== "undefined") {
        editor.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: value
          })
        );
      }
      const inserted = document.execCommand("insertText", false, value);
      dispatchInput("insertText", value);
      return inserted;
    };
    const moveCaretToEnd = () => {
      const selection = window.getSelection();
      if (!selection) return;
      const newRange = document.createRange();
      newRange.selectNodeContents(editor);
      newRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(newRange);
    };

    try {
      editor.focus();
      const replacedWithPaste = replaceWithPaste();
      moveCaretToEnd();

      // Lexical can reconcile asynchronously; re-check on the next frame.
      requestAnimationFrame(() => {
        if (current() === expected) return;
        const replacedWithExec = replaceWithExec();
        moveCaretToEnd();
        requestAnimationFrame(() => {
          if (current() !== expected) {
            console.warn("Prompt Efficiency Tool: Perplexity write mismatch", {
              replacedWithPaste,
              replacedWithExec,
              expectedLength: expected.length,
              actualLength: current().length
            });
          }
        });
      });
    } catch (error) {
      console.error("Prompt Efficiency Tool: Failed to write Perplexity prompt", error);
    }
  };

  const readPrompt = () =>
    IS_GROK
      ? readGrokPrompt()
      : IS_DEEPSEEK
        ? readDeepSeekPrompt()
        : IS_PERPLEXITY
          ? readPerplexityPrompt()
        : IS_CLAUDE
          ? readClaudePrompt()
          : IS_GEMINI
            ? getGeminiPromptValue()
            : getPromptValue();
  const writePrompt = (value: string) => {
    if (IS_GROK) {
      writeGrokPrompt(value);
    } else if (IS_DEEPSEEK) {
      writeDeepSeekPrompt(value);
    } else if (IS_PERPLEXITY) {
      writePerplexityPrompt(value);
    } else if (IS_CLAUDE) {
      writeClaudePrompt(value);
    } else if (IS_GEMINI) {
      setGeminiPromptValue(value);
    } else {
      setPromptValue(value);
    }
  };

  const pushUndoSnapshot = (prompt: string) => {
    const stack = undoStackRef.current;
    if (stack[stack.length - 1] !== prompt) {
      stack.push(prompt);
      console.log("Undo stack: snapshot pushed", {
        depth: stack.length,
        promptLength: prompt.length
      });
    } else {
      console.log("Undo stack: duplicate snapshot skipped", {
        depth: stack.length,
        promptLength: prompt.length
      });
    }
    if (stack.length > 20) {
      stack.shift();
      console.log("Undo stack: oldest snapshot dropped", { depth: stack.length });
    }
  };

  const normalizePromptText = (value: string) => value.replace(/\s+/g, " ").trim();

  const verifyPromptText = (expected: string, stage: string) => {
    const actual = normalizePromptText(readPrompt());
    const expectedNormalized = normalizePromptText(expected);
    const matches = actual === expectedNormalized;
    console.log("Undo verify", {
      stage,
      matches,
      expectedLength: expectedNormalized.length,
      actualLength: actual.length,
      expected: expectedNormalized,
      actual
    });
    return matches;
  };

  const handleUndo = () => {
    const stack = undoStackRef.current;
    const previous = stack[stack.length - 1] ?? null;
    console.log("Undo: requested", {
      depth: stack.length,
      hasSnapshot: previous !== null
    });

    if (previous === null) {
      const current = readPrompt();
      if (current.endsWith(" [Verified]")) {
        const restored = current.replace(/\\s\\[Verified\\]$/, "");
        console.log("Undo: stripping verified suffix");
        writePrompt(restored);
      } else {
        console.log("Undo: no previous prompt captured");
      }
      return;
    }

    writePrompt(previous);

    const completeRestore = (stage: string) => {
      if (!verifyPromptText(previous, stage)) return false;
      stack.pop();
      setStatus("idle");
      console.log("Undo: restored previous prompt", {
        depth: stack.length,
        stage
      });
      return true;
    };

    if (completeRestore("immediate")) return;

    requestAnimationFrame(() => {
      if (completeRestore("raf")) return;
      console.log("Undo: retrying restore after raf mismatch");
      writePrompt(previous);
      window.setTimeout(() => {
        if (completeRestore("timeout-120ms")) return;
        console.warn("Undo: restore failed, keeping snapshot for retry", {
          depth: stack.length
        });
      }, 120);
    });
  };

  const handleCompress = () => {
    const originalText = readPrompt();
    console.log(`Read: ${originalText}`);
    if (!originalText.trim()) {
      setStatus("idle");
      return;
    }

    const words = originalText.split(/\s+/).filter(Boolean);
    const filtered = words.filter((word) => !stopWords.has(word.toLowerCase()));
    const compressedText = filtered.join(" ");
    if (compressedText === originalText) {
      setStatus("idle");
      return;
    }

    pushUndoSnapshot(originalText);

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
    console.log("Compress: write requested", {
      stackDepth: undoStackRef.current.length,
      originalLength: originalText.length,
      compressedLength: compressedText.length
    });
    void logEcoStats(savings);

    setStatus("success");
    if (statusTimeoutRef.current !== null) {
      window.clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatus("idle");
      statusTimeoutRef.current = null;
    }, 2000);
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
      if (statusTimeoutRef.current !== null) {
        window.clearTimeout(statusTimeoutRef.current);
      }
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    if (!IS_PERPLEXITY) return;

    const handleFocus = (event: FocusEvent) => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      for (const item of path) {
        if (matchesEditable(item)) {
          lastFocusedEditorRef.current = item as HTMLElement;
          return;
        }
      }
      if (matchesEditable(event.target)) {
        lastFocusedEditorRef.current = event.target as HTMLElement;
      }
    };

    document.addEventListener("focusin", handleFocus, true);
    return () => document.removeEventListener("focusin", handleFocus, true);
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
  const grokClass = IS_GROK ? "eco-btn-grok" : "";
  const deepseekClass = IS_DEEPSEEK ? "eco-btn-deepseek" : "";
  const perplexityClass = IS_PERPLEXITY ? "eco-btn-perplexity" : "";
  const showCustomTooltip = !IS_DEEPSEEK;

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
        .pet-group {
          position: relative;
          overflow: visible;
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
          white-space: nowrap;
          max-width: none;
          z-index: 9999;
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
          className={`pet-ghost inline-flex items-center gap-2 rounded-lg bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all duration-200 ease-in-out hover:bg-white/10 hover:text-zinc-100 active:scale-90 transition-transform duration-100 ${geminiClass} ${claudeClass} ${grokClass} ${deepseekClass} ${
            status === "success" ? "text-emerald-400" : "text-zinc-400"
          } ${perplexityClass}`}
          onClick={handleCompress}
          title="Compress prompt"
        >
          {status === "success" ? <Check className="h-4 w-4" /> : <Droplet className="h-4 w-4" />}
          {status === "success" ? "Saved" : "Compress"}
        </button>
        {showCustomTooltip ? (
          <div className="pet-tooltip absolute -top-8 left-1/2 -translate-x-1/2 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[10px] uppercase tracking-wide text-white/80 shadow-lg">
            Compress prompt
          </div>
        ) : null}
      </div>

      {undoEnabled ? (
        <div className="relative pet-group">
          <button
            type="button"
            className={`pet-ghost inline-flex items-center gap-2 rounded-lg bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 transition-all duration-200 ease-in-out hover:bg-white/10 hover:text-zinc-100 active:scale-90 transition-transform duration-100 ${geminiClass} ${claudeClass} ${grokClass} ${deepseekClass} ${perplexityClass}`}
            onClick={() => {
              setUndoSpinning(true);
              window.setTimeout(() => setUndoSpinning(false), 400);
              handleUndo();
            }}
            title="Restore last prompt"
          >
            <Undo className={`h-4 w-4 transition-transform duration-300 ${undoSpinning ? "rotate-360" : ""}`} />
            Undo
          </button>
          {showCustomTooltip ? (
            <div className="pet-tooltip absolute -top-8 left-1/2 -translate-x-1/2 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[10px] uppercase tracking-wide text-white/80 shadow-lg">
              Restore last prompt
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
