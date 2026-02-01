import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { InjectionOverlay } from "../components/InjectionOverlay";
import { StatsModal } from "../components/StatsModal";
import { compressPrompt } from "../utils/compressionUtils";
import {
  applyOverlayPositioning,
  findChatGPTInput,
  findChatGPTTextarea,
  setNativeValue
} from "../utils/domUtils";
import {
  loadTotalWaterSaved,
  loadUndoStack,
  pushUndoStack,
  saveTotalWaterSaved,
  saveUndoStack
} from "../utils/storageUtils";
import css from "./index.css?inline";

const MAIN_HOST_ID = "pet-root";
const OVERLAY_HOST_ID = "pet-overlay-root";
const MAIN_APP_ID = "pet-app";
const OVERLAY_APP_ID = "pet-overlay-app";
const STYLE_TAG_ID = "pet-style";
const SHOW_UNDO_KEY = "showUndo";

function ensureMainHost(): HTMLDivElement {
  let host = document.getElementById(MAIN_HOST_ID) as HTMLDivElement | null;
  if (!host) {
    host = document.createElement("div");
    host.id = MAIN_HOST_ID;
    document.body.appendChild(host);
  }

  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.zIndex = "2147483646";
  host.style.pointerEvents = "none";

  return host;
}

function ensureShadow(host: HTMLDivElement): ShadowRoot {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  if (!shadow.getElementById(STYLE_TAG_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_TAG_ID;
    style.textContent = css;
    shadow.appendChild(style);
  }
  return shadow;
}

function ensureAppRoot(shadow: ShadowRoot, id: string): HTMLDivElement {
  let root = shadow.getElementById(id) as HTMLDivElement | null;
  if (!root) {
    root = document.createElement("div");
    root.id = id;
    shadow.appendChild(root);
  }
  return root;
}

function ensureOverlayHost(wrapper: HTMLElement): HTMLDivElement {
  let host = document.getElementById(OVERLAY_HOST_ID) as HTMLDivElement | null;
  if (!host) {
    host = document.createElement("div");
    host.id = OVERLAY_HOST_ID;
  }

  if (host.parentElement !== wrapper) {
    wrapper.appendChild(host);
  }

  const wrapperStyle = window.getComputedStyle(wrapper);
  if (wrapperStyle.position === "static") {
    wrapper.style.position = "relative";
  }

  applyOverlayPositioning(host);
  host.style.zIndex = "2147483646";
  host.style.pointerEvents = "auto";
  host.style.display = "block";

  return host;
}

async function loadShowUndo(): Promise<boolean> {
  const result = (await chrome.storage.local.get(SHOW_UNDO_KEY)) as {
    showUndo?: boolean;
  };
  return typeof result.showUndo === "boolean" ? result.showUndo : true;
}

async function saveShowUndo(value: boolean): Promise<void> {
  await chrome.storage.local.set({
    [SHOW_UNDO_KEY]: value
  });
}

function App({ mainHost }: { mainHost: HTMLDivElement }): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [bottlesSaved, setBottlesSaved] = useState(0);
  const [showUndo, setShowUndo] = useState(true);
  const [overlayRoot, setOverlayRoot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    loadTotalWaterSaved().then((value) => {
      if (mounted) setBottlesSaved(value);
    });
    loadShowUndo().then((value) => {
      if (mounted) setShowUndo(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    mainHost.style.pointerEvents = isOpen ? "auto" : "none";
  }, [isOpen, mainHost]);

  const closeStats = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handler = (message: unknown) => {
      if (!message || typeof message !== "object") return;
      const type = (message as { type?: string }).type;
      if (type === "PET_TOGGLE_STATS") {
        setIsOpen((prev) => !prev);
      } else if (type === "TOGGLE_MODAL") {
        setIsOpen(true);
      } else if (type === "PET_OPEN_STATS") {
        setIsOpen(true);
      } else if (type === "PET_CLOSE_STATS") {
        setIsOpen(false);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => {
      chrome.runtime.onMessage.removeListener(handler);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const scan = () => {
      if (!active) return;
      const wrapper = findChatGPTInput();
      if (!wrapper) {
        const existing = document.getElementById(
          OVERLAY_HOST_ID
        ) as HTMLDivElement | null;
        if (existing) existing.style.display = "none";
        setOverlayRoot(null);
        return;
      }

      const host = ensureOverlayHost(wrapper);
      const shadow = ensureShadow(host);
      const root = ensureAppRoot(shadow, OVERLAY_APP_ID);
      setOverlayRoot(root);
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    return () => {
      active = false;
      observer.disconnect();
    };
  }, []);

  const handleCompress = useCallback(async () => {
    const input = findChatGPTTextarea();
    if (!input) return;

    const original = input.value;
    const compressed = compressPrompt(original);
    if (compressed === original) return;

    await pushUndoStack(original);
    setNativeValue(input, compressed);

    const saved = Math.max(0, original.length - compressed.length);
    if (saved > 0) {
      const nextTotal = (await loadTotalWaterSaved()) + saved;
      await saveTotalWaterSaved(nextTotal);
      setBottlesSaved(nextTotal);
    }
  }, []);

  const handleUndo = useCallback(async () => {
    if (!showUndo) return;
    const input = findChatGPTTextarea();
    if (!input) return;

    const stack = await loadUndoStack();
    if (stack.length === 0) return;

    const previous = stack[stack.length - 1];
    const next = stack.slice(0, -1);
    await saveUndoStack(next);
    setNativeValue(input, previous);
  }, [showUndo]);

  const handleToggleUndo = useCallback(async (next: boolean) => {
    setShowUndo(next);
    await saveShowUndo(next);
  }, []);

  const overlay = useMemo(() => {
    if (!overlayRoot) return null;
    return createPortal(
      <InjectionOverlay
        onCompress={handleCompress}
        onUndo={handleUndo}
        showUndo={showUndo}
      />,
      overlayRoot
    );
  }, [handleCompress, handleUndo, overlayRoot, showUndo]);

  return (
    <>
      {overlay}
      <StatsModal
        isOpen={isOpen}
        bottlesSaved={bottlesSaved}
        showUndo={showUndo}
        onToggleUndo={handleToggleUndo}
        onClose={closeStats}
      />
    </>
  );
}

function mount(): void {
  const mainHost = ensureMainHost();
  const shadow = ensureShadow(mainHost);
  const rootEl = ensureAppRoot(shadow, MAIN_APP_ID);

  const root = createRoot(rootEl);
  root.render(<App mainHost={mainHost} />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
