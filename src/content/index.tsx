import React from "react";
import ReactDOM from "react-dom/client";
import Injection from "./Injection";
import { findGeminiEditable } from "../utils/geminiDomUtils";
import css from "../style.css?inline";
import contentCss from "./styles.css?inline";

console.log("Prompt Efficiency Tool: Content script loaded");

let targetLogged = false;
let scheduled = false;
let pollId: number | null = null;
let debugLogged = false;

const HOST_ID = "prompt-efficiency-root";

const HOSTNAME = window.location.hostname;
const IS_CHATGPT = HOSTNAME === "chatgpt.com" || HOSTNAME.endsWith(".chatgpt.com");
const IS_GEMINI = HOSTNAME === "gemini.google.com";
const IS_CLAUDE = HOSTNAME === "claude.ai" || HOSTNAME.endsWith(".claude.ai");
const IS_SUPPORTED = IS_CHATGPT || IS_GEMINI || IS_CLAUDE;
const SITE_LABEL = IS_GEMINI
  ? "Gemini"
  : IS_CHATGPT
    ? "ChatGPT"
    : IS_CLAUDE
      ? "Claude"
      : "Unknown";

const CHATGPT_TEXTAREA_SELECTORS = [
  'textarea#prompt-textarea',
  'textarea[data-testid="prompt-textarea"]',
  'textarea[name="prompt-textarea"]'
];

const CHATGPT_EDITABLE_SELECTORS = [
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

type InjectionTarget = {
  parent: HTMLElement;
  insertBefore?: ChildNode | null;
};

function findChatGPTPromptContainer(): HTMLElement | null {
  const directPrompt = document.querySelector<HTMLElement>("#prompt-textarea");
  if (directPrompt) {
    return (
      directPrompt.closest('[class*="prosemirror-parent"]') ??
      directPrompt.closest("form") ??
      directPrompt.parentElement
    );
  }

  const textarea = querySelectorDeep<HTMLTextAreaElement>(
    document,
    CHATGPT_TEXTAREA_SELECTORS
  );
  if (textarea) {
    return (
      textarea.closest('[class*="prosemirror-parent"]') ??
      textarea.closest("form") ??
      textarea.parentElement
    );
  }

  const contentEditable = querySelectorDeep<HTMLElement>(
    document,
    CHATGPT_EDITABLE_SELECTORS
  );
  if (contentEditable) {
    return (
      contentEditable.closest('[class*="prosemirror-parent"]') ??
      contentEditable.closest("form") ??
      contentEditable.parentElement
    );
  }

  return null;
}

function resolveChatGPTTarget(): InjectionTarget | null {
  const container = findChatGPTPromptContainer();
  if (!container) return null;

  const root = container.closest("form") ?? container.parentElement ?? container;
  const trailing =
    root.querySelector<HTMLElement>('[class*="grid-area:trailing"]') ??
    root.querySelector<HTMLElement>('[data-testid="send-button"]')?.parentElement ??
    root.querySelector<HTMLElement>(".composer-submit-btn")?.parentElement ??
    root;

  return { parent: trailing, insertBefore: trailing.firstChild };
}

function resolveGeminiTarget(): InjectionTarget | null {
  const sendButton = querySelectorDeep<HTMLButtonElement>(document, [
    'button[aria-label="Send message"]'
  ]);

  if (sendButton) {
    const container =
      sendButton.closest<HTMLElement>('div[class*="send-button-container"]') ??
      sendButton.parentElement;
    if (container) {
      return { parent: container, insertBefore: sendButton };
    }
  }

  const sendContainer = querySelectorDeep<HTMLElement>(document, [
    'div[class*="send-button-container"]'
  ]);
  if (sendContainer) {
    return { parent: sendContainer, insertBefore: sendContainer.firstChild };
  }

  const editable = findGeminiEditable();
  if (!editable) return null;

  const wrapper =
    (editable.closest("rich-textarea") as HTMLElement | null) ??
    (editable.closest("form") as HTMLElement | null) ??
    editable.parentElement;
  if (!wrapper) return null;

  return { parent: wrapper, insertBefore: wrapper.firstChild };
}

function resolveClaudeTarget(): InjectionTarget | null {
  const sendContainer = querySelectorDeep<HTMLElement>(document, [
    'div[class*="overflow-hidden"][class*="shrink-0"][class*="p-1"]'
  ]);
  if (sendContainer) {
    const sendButton = sendContainer.querySelector<HTMLElement>("button");
    return { parent: sendContainer, insertBefore: sendButton ?? sendContainer.firstChild };
  }

  const sendButton = querySelectorDeep<HTMLButtonElement>(document, [
    'button[aria-label*="Send"]',
    'button[data-testid*="send"]',
    'button[type="submit"]'
  ]);
  if (sendButton) {
    const container = sendButton.parentElement ?? sendButton;
    return { parent: container, insertBefore: sendButton };
  }

  const editor = querySelectorDeep<HTMLElement>(document, ['div[contenteditable="true"]']);
  if (!editor) return null;
  const wrapper = (editor.closest("form") as HTMLElement | null) ?? editor.parentElement;
  if (!wrapper) return null;

  return { parent: wrapper, insertBefore: wrapper.firstChild };
}

function resolveInjectionTarget(): InjectionTarget | null {
  if (IS_CHATGPT) return resolveChatGPTTarget();
  if (IS_GEMINI) return resolveGeminiTarget();
  if (IS_CLAUDE) return resolveClaudeTarget();
  return null;
}

function handleScan() {
  scheduled = false;

  const target = resolveInjectionTarget();
  if (!target && !debugLogged) {
    debugLogged = true;
    const promptEl = IS_GEMINI
      ? findGeminiEditable()
      : IS_CLAUDE
        ? querySelectorDeep<HTMLElement>(document, ['div[contenteditable="true"]'])
        : querySelectorDeep<HTMLElement>(document, [
            ...CHATGPT_TEXTAREA_SELECTORS,
            ...CHATGPT_EDITABLE_SELECTORS
          ]);
    console.log("Prompt Efficiency Tool: Target not found yet", {
      site: SITE_LABEL,
      promptElementFound: Boolean(promptEl)
    });
  }
  if (!target) return;

  if (!targetLogged) {
    targetLogged = true;
    console.log("Prompt Efficiency Tool: Target found", { site: SITE_LABEL });
  }

  injectUI(target);
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

if (IS_SUPPORTED) {
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
} else {
  console.log("Prompt Efficiency Tool: Unsupported host", { host: HOSTNAME });
}

function injectUI(target: InjectionTarget) {
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

  const parent = target.parent;
  const insertBefore = target.insertBefore ?? null;
  if (insertBefore && insertBefore.parentElement === parent) {
    parent.insertBefore(host, insertBefore);
  } else if (parent.firstChild) {
    parent.insertBefore(host, parent.firstChild);
  } else {
    parent.appendChild(host);
  }

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `${css}\n${contentCss}`;

  const mount = document.createElement("div");
  shadow.append(style, mount);

  ReactDOM.createRoot(mount).render(
    <React.StrictMode>
      <Injection />
    </React.StrictMode>
  );

}
