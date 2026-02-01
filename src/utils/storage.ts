export type StorageState = {
  bottlesSaved: number;
  undoEnabled: boolean;
};

const DEFAULT_STATE: StorageState = {
  bottlesSaved: 0,
  undoEnabled: true
};

export function getStorage(): Promise<StorageState> {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_STATE, (items) => {
      resolve({
        bottlesSaved: Number(items.bottlesSaved ?? DEFAULT_STATE.bottlesSaved),
        undoEnabled: Boolean(items.undoEnabled ?? DEFAULT_STATE.undoEnabled)
      });
    });
  });
}

export async function setStorage(patch: Partial<StorageState>): Promise<StorageState> {
  const current = await getStorage();
  const next = { ...current, ...patch };

  await new Promise<void>((resolve) => {
    chrome.storage.local.set(next, () => resolve());
  });

  return next;
}
