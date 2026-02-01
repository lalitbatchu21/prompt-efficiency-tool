const STORAGE_KEYS = {
  totalWaterSaved: "totalWaterSaved",
  undoStack: "undoStack"
} as const;

const UNDO_STACK_LIMIT = 10;

type StorageSchema = {
  totalWaterSaved: number;
  undoStack: string[];
};

export async function loadTotalWaterSaved(): Promise<number> {
  const result = (await chrome.storage.local.get(
    STORAGE_KEYS.totalWaterSaved
  )) as Partial<StorageSchema>;
  const value = result.totalWaterSaved;
  return typeof value === "number" ? value : 0;
}

export async function saveTotalWaterSaved(value: number): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.totalWaterSaved]: value
  });
}

export async function loadUndoStack(): Promise<string[]> {
  const result = (await chrome.storage.local.get(
    STORAGE_KEYS.undoStack
  )) as Partial<StorageSchema>;
  const value = result.undoStack;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function saveUndoStack(stack: string[]): Promise<void> {
  const trimmed = stack.slice(-UNDO_STACK_LIMIT);
  await chrome.storage.local.set({
    [STORAGE_KEYS.undoStack]: trimmed
  });
}

export async function pushUndoStack(item: string): Promise<string[]> {
  const current = await loadUndoStack();
  const next = [...current, item].slice(-UNDO_STACK_LIMIT);
  await saveUndoStack(next);
  return next;
}
