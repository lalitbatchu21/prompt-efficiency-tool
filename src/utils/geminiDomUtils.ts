const GEMINI_EDITABLE_SELECTORS = [
  'div[contenteditable="true"][aria-label*="Enter a prompt here"]',
  ".ql-editor",
  "rich-textarea"
];

const GEMINI_NESTED_EDITABLE_SELECTORS = [
  'div[contenteditable="true"]',
  '[contenteditable="true"]',
  ".ql-editor"
];

function querySelectorDeep<T extends Element>(
  root: ParentNode,
  selectors: string[]
): T | null {
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

export function findGeminiEditable(): HTMLElement | null {
  const direct = querySelectorDeep<HTMLElement>(document, GEMINI_EDITABLE_SELECTORS);
  if (!direct) return null;

  if (direct.isContentEditable) {
    return direct;
  }

  const nested = querySelectorDeep<HTMLElement>(direct, GEMINI_NESTED_EDITABLE_SELECTORS);
  if (nested) return nested;

  return null;
}

export function getGeminiPromptValue(): string {
  const el = findGeminiEditable();
  if (!el) return "";
  return el.innerText ?? el.textContent ?? "";
}

export function setGeminiPromptValue(newValue: string): void {
  const el = findGeminiEditable();
  if (!el) return;

  try {
    el.focus();
  } catch {
  }

  el.innerText = newValue;

  try {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);
  } catch {
  }

  try {
    document.execCommand("insertText", false, newValue);
  } catch {
  }

  el.dispatchEvent(new Event("input", { bubbles: true }));
}
