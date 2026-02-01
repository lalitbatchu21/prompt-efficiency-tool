import React from "react";
import ReactDOM from "react-dom/client";
import Injection from "./Injection";
import css from "../style.css?inline";

console.log("Prompt Efficiency Tool: Content script loaded");

let targetLogged = false;
let scheduled = false;
let pollId: number | null = null;
let debugLogged = false;

const HOST_ID = "prompt-efficiency-root";

const TEXTAREA_SELECTORS = [
  'textarea#prompt-textarea',
  'textarea[data-testid="prompt-textarea"]',
  'textarea[name="prompt-textarea"]'
];

const EDITABLE_SELECTORS = [
  'div#prompt-textarea[contenteditable="true"]',
  'div[contenteditable="true"][data-testid="prompt-textarea"]',
  'div[contenteditable="true"][aria-label="Message"]',
  'div[contenteditable="true"][aria-label="Message ChatGPT"]'
];

function querySelectorDeep<T extends Element>(root: ParentNode, selectors: string[]): T | null {
  for (const selector of selectors) {
    const direct = root.querySelector<T>(selector);
    if (direct) return direct;
  }

  const nodes = root.querySelectorAll<HTMLElement>("*");
  for (const node of nodes) {
    const shadowRoot = node.shadowRoot;
    if (shadowRoot) {
      const found = querySelectorDeep<T>(shadowRoot, selectors);
      if (found) return found;
    }
  }

  return null;
}

function findPromptContainer(): HTMLElement | null {
  const directPrompt = document.querySelector<HTMLElement>("#prompt-textarea");
  if (directPrompt) {
    return (
      directPrompt.closest('[class*="prosemirror-parent"]') ??
      directPrompt.closest("form") ??
      directPrompt.parentElement
    );
  }

  const textarea = querySelectorDeep<HTMLTextAreaElement>(document, TEXTAREA_SELECTORS);
  if (textarea) {
    return (
      textarea.closest('[class*="prosemirror-parent"]') ??
      textarea.closest("form") ??
      textarea.parentElement
    );
  }

  const contentEditable = querySelectorDeep<HTMLElement>(document, EDITABLE_SELECTORS);
  if (contentEditable) {
    return (
      contentEditable.closest('[class*="prosemirror-parent"]') ??
      contentEditable.closest("form") ??
      contentEditable.parentElement
    );
  }

  return null;
}

function handleScan() {
  scheduled = false;

  const container = findPromptContainer();
  if (!container && !debugLogged) {
    debugLogged = true;
    const promptEl = document.querySelector("#prompt-textarea");
    console.log("Prompt Efficiency Tool: Target not found yet", {
      promptElementFound: Boolean(promptEl)
    });
  }
  if (!container) return;

  if (!targetLogged) {
    targetLogged = true;
    console.log("Prompt Efficiency Tool: Target found");
  }

  injectUI(container);
}

function scheduleScan() {
  if (scheduled) return;
  scheduled = true;

  requestAnimationFrame(handleScan);
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      scheduleScan();
      break;
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

scheduleScan();

if (pollId === null) {
  pollId = window.setInterval(() => {
    scheduleScan();
  }, 1000);
}

function injectUI(container: HTMLElement) {
  const existing = document.getElementById(HOST_ID);
  if (existing && existing.isConnected) return;
  if (existing && !existing.isConnected) {
    existing.remove();
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.display = "inline-flex";
  host.style.alignItems = "center";
  host.style.marginLeft = "8px";
  host.style.pointerEvents = "auto";

  const root = container.closest("form") ?? container.parentElement ?? container;
  const trailing =
    root.querySelector<HTMLElement>('[class*="grid-area:trailing"]') ??
    root.querySelector<HTMLElement>('[data-testid="send-button"]')?.parentElement ??
    root.querySelector<HTMLElement>(".composer-submit-btn")?.parentElement ??
    root;

  if (trailing.firstChild) {
    trailing.insertBefore(host, trailing.firstChild);
  } else {
    trailing.appendChild(host);
  }

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;

  const mount = document.createElement("div");
  shadow.append(style, mount);

  ReactDOM.createRoot(mount).render(
    <React.StrictMode>
      <Injection />
    </React.StrictMode>
  );

}
