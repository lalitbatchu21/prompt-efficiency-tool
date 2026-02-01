export function setNativeValue(
  element: HTMLTextAreaElement,
  value: string
): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  );
  const valueSetter = descriptor?.set;
  if (!valueSetter) {
    throw new Error("Failed to access native textarea value setter.");
  }

  valueSetter.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

export function findChatGPTTextarea(): HTMLTextAreaElement | null {
  const primary = document.querySelector(
    'textarea[id="prompt-textarea"]'
  ) as HTMLTextAreaElement | null;
  if (primary) return primary;

  return document.querySelector(
    'textarea[data-id="root"]'
  ) as HTMLTextAreaElement | null;
}

export function findChatGPTInput(): HTMLElement | null {
  const input = findChatGPTTextarea();
  if (input?.parentElement) return input.parentElement;

  const composer = document.querySelector(
    'div[class*="composer-parent"]'
  ) as HTMLElement | null;
  if (composer) return composer;

  return document.querySelector("form") as HTMLElement | null;
}

export function findChatGPTInputWrapper(): HTMLElement | null {
  return findChatGPTInput();
}

export function applyOverlayPositioning(host: HTMLElement): void {
  host.style.position = "absolute";
  host.style.bottom = "12px";
  host.style.right = "12px";
}
