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
const GROK_PADDING_ATTRIBUTE = "data-eco-grok-padding";

const HOSTNAME = window.location.hostname;
const IS_CHATGPT = HOSTNAME === "chatgpt.com" || HOSTNAME.endsWith(".chatgpt.com");
const IS_GEMINI = HOSTNAME === "gemini.google.com";
const IS_CLAUDE = HOSTNAME === "claude.ai" || HOSTNAME.endsWith(".claude.ai");
const IS_GROK = HOSTNAME === "grok.com" || HOSTNAME.endsWith(".grok.com");
const IS_DEEPSEEK = HOSTNAME === "chat.deepseek.com";
const IS_SUPPORTED = IS_CHATGPT || IS_GEMINI || IS_CLAUDE || IS_GROK || IS_DEEPSEEK;
const SITE_LABEL = IS_GEMINI
  ? "Gemini"
  : IS_CHATGPT
    ? "ChatGPT"
    : IS_CLAUDE
      ? "Claude"
      : IS_GROK
        ? "Grok"
        : IS_DEEPSEEK
          ? "DeepSeek"
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

function resolveGrokTarget(): InjectionTarget | null {
  const modelSelect = querySelectorDeep<HTMLButtonElement>(document, [
    "button#model-select-trigger",
    'button[aria-label="Model select"]'
  ]);
  if (modelSelect) {
    const row =
      modelSelect.closest<HTMLElement>('[class*="ms-auto"][class*="flex"]') ??
      modelSelect.closest<HTMLElement>('[class*="flex"][class*="gap"]') ??
      modelSelect.parentElement;
    if (row) {
      let anchor: HTMLElement | null = modelSelect;
      while (anchor && anchor.parentElement !== row) {
        anchor = anchor.parentElement;
      }
      return { parent: row, insertBefore: anchor ?? row.firstChild };
    }
  }

  const sendButton = querySelectorDeep<HTMLButtonElement>(document, [
    'button[aria-label="Submit"]',
    'button[type="submit"]'
  ]);
  if (sendButton) {
    const container = sendButton.parentElement ?? sendButton;
    if (container) {
      container.style.position ||= "relative";
      container.style.zIndex = "2";
    }
    return { parent: container, insertBefore: sendButton };
  }

  const editor = querySelectorDeep<HTMLElement>(document, ['div[contenteditable="true"]']);
  if (!editor) return null;
  const wrapper = (editor.closest("form") as HTMLElement | null) ?? editor.parentElement;
  if (!wrapper) return null;

  return { parent: wrapper, insertBefore: wrapper.firstChild };
}

function resolveDeepSeekTarget(): InjectionTarget | null {
  const editor = querySelectorDeep<HTMLTextAreaElement>(document, [
    'textarea[placeholder*="DeepSeek"]',
    "textarea"
  ]);
  if (editor) {
    let scope: HTMLElement | null = editor.parentElement;
    while (scope && scope !== document.body) {
      const hasIcon = scope.querySelector(
        'div[class*="ds-icon-button--sizing-container"]'
      );
      const hasToggle = scope.querySelector('div[class*="ds-toggle-button"]');
      if (hasIcon && hasToggle) break;
      scope = scope.parentElement;
    }
    if (scope) {
      const scopedIcon = scope.querySelector<HTMLElement>(
        'div[class*="ds-icon-button--sizing-container"]'
      );
      if (scopedIcon) {
        const row =
          scopedIcon.parentElement ??
          scopedIcon.closest<HTMLElement>('[class*="flex"][class*="items-center"]') ??
          scopedIcon.closest<HTMLElement>("div");
        if (row && row !== scopedIcon) {
          return { parent: row, insertBefore: scopedIcon };
        }
      }
    }
  }

  const iconButton = querySelectorDeep<HTMLElement>(document, [
    'div[class*="ds-icon-button--sizing-container"]',
    'div[class*="ds-icon-button"]'
  ]);
  if (iconButton) {
    const row =
      iconButton.parentElement ??
      iconButton.closest<HTMLElement>('[class*="flex"][class*="items-center"]') ??
      iconButton.closest<HTMLElement>("div");
    if (row && row !== iconButton) {
      return { parent: row, insertBefore: iconButton };
    }
  }

  const sendButton = querySelectorDeep<HTMLElement>(document, [
    'button[aria-label*="Send"]',
    'button[type="submit"]'
  ]);
  if (sendButton) {
    const container = sendButton.parentElement ?? sendButton;
    return { parent: container, insertBefore: sendButton };
  }

  const fallbackEditor = querySelectorDeep<HTMLElement>(document, [
    "textarea",
    'div[contenteditable="true"]'
  ]);
  if (!fallbackEditor) return null;
  const wrapper =
    (fallbackEditor.closest("form") as HTMLElement | null) ??
    fallbackEditor.parentElement;
  if (!wrapper) return null;

  return { parent: wrapper, insertBefore: wrapper.firstChild };
}

function findGrokPaddingContainer(row: HTMLElement) {
  return (
    row.closest<HTMLElement>('div[style*="padding-inline-end"]') ??
    row.closest<HTMLElement>('div[style*="padding-right"]') ??
    row.closest<HTMLElement>('div[class*="ps-"][class*="pe-"]') ??
    row.closest<HTMLElement>('div[class*="ps-"]')
  );
}

function updateGrokPadding(row: HTMLElement, container?: HTMLElement | null) {
  const target = container ?? findGrokPaddingContainer(row);
  if (!target) return;

  const rowRect = row.getBoundingClientRect();
  const containerRect = target.getBoundingClientRect();
  const rightGap = Math.max(0, Math.ceil(containerRect.right - rowRect.right));
  const contentWidth = Math.max(Math.ceil(row.scrollWidth), Math.ceil(rowRect.width));
  const paddingValue = `${Math.max(0, contentWidth + rightGap + 8)}px`;

  target.style.setProperty("padding-inline-end", paddingValue, "important");
  target.style.setProperty("padding-right", paddingValue, "important");
}

function ensureGrokPadding(row: HTMLElement) {
  if (row.dataset.ecoGrokPadding === "true") return;
  const container = findGrokPaddingContainer(row);
  if (!container) return;
  row.dataset.ecoGrokPadding = "true";

  const applyPadding = () => updateGrokPadding(row, container);
  const schedule = () => requestAnimationFrame(applyPadding);
  schedule();

  const resizeObserver = new ResizeObserver(() => schedule());
  resizeObserver.observe(row);

  const mutationObserver = new MutationObserver(() => schedule());
  mutationObserver.observe(row, { childList: true, subtree: true, attributes: true });

  const containerObserver = new MutationObserver(() => schedule());
  containerObserver.observe(container, { attributes: true, attributeFilter: ["style", "class"] });
}

function resolveInjectionTarget(): InjectionTarget | null {
  if (IS_CHATGPT) return resolveChatGPTTarget();
  if (IS_GEMINI) return resolveGeminiTarget();
  if (IS_CLAUDE) return resolveClaudeTarget();
  if (IS_GROK) return resolveGrokTarget();
  if (IS_DEEPSEEK) return resolveDeepSeekTarget();
  return null;
}

function handleScan() {
  scheduled = false;

  const target = resolveInjectionTarget();
  if (!target && !debugLogged) {
    debugLogged = true;
    const promptEl = IS_GEMINI
      ? findGeminiEditable()
      : IS_CLAUDE || IS_GROK || IS_DEEPSEEK
        ? querySelectorDeep<HTMLElement>(document, ['div[contenteditable="true"]', "textarea"])
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
  if (IS_GROK) {
    host.style.marginRight = "8px";
    host.style.alignSelf = "center";
  } else if (IS_DEEPSEEK) {
    host.style.marginLeft = "6px";
    host.style.overflow = "visible";
  } else {
    host.style.marginLeft = "8px";
  }
  host.style.pointerEvents = "auto";

  const parent = target.parent;
  if (IS_GROK) {
    ensureGrokPadding(parent);
  } else if (IS_DEEPSEEK) {
    parent.style.overflow = "visible";
  }
  const insertBefore = target.insertBefore ?? null;
  if (insertBefore && insertBefore.parentElement === parent) {
    parent.insertBefore(host, insertBefore);
  } else if (parent.firstChild) {
    parent.insertBefore(host, parent.firstChild);
  } else {
    parent.appendChild(host);
  }
  if (IS_GROK) {
    requestAnimationFrame(() => {
      ensureGrokPadding(parent);
      updateGrokPadding(parent);
    });
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
