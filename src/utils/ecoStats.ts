export type EcoTotals = {
  totalTokens: number;
  totalWater: number;
  totalEnergy: number;
};

type EcoPayload = {
  tokens: number;
  waterMl: number;
  energyWh: number;
};

const WORKER_URL = "https://backend.lalitbatchu.workers.dev";
const DEFAULT_TOTALS: EcoTotals = {
  totalTokens: 0,
  totalWater: 0,
  totalEnergy: 0
};

export function calculateEcoStats(originalLength: number, compressedLength: number) {
  const tokens = Math.max(0, (originalLength - compressedLength) / 4);
  const waterMl = tokens * 0.05;
  const energyWh = tokens * 0.006;

  return { tokens, waterMl, energyWh };
}

export function processSavings(originalText: string, compressedText: string) {
  return calculateEcoStats(originalText.length, compressedText.length);
}

export async function logEcoStats(payload: EcoPayload): Promise<void> {
  const { tokens, waterMl, energyWh } = payload;
  if (tokens <= 0 && waterMl <= 0 && energyWh <= 0) {
    return;
  }

  const totals = await new Promise<EcoTotals>((resolve) => {
    chrome.storage.local.get(DEFAULT_TOTALS, (items) => {
      resolve({
        totalTokens: Number(items.totalTokens ?? DEFAULT_TOTALS.totalTokens),
        totalWater: Number(items.totalWater ?? DEFAULT_TOTALS.totalWater),
        totalEnergy: Number(items.totalEnergy ?? DEFAULT_TOTALS.totalEnergy)
      });
    });
  });

  const nextTotals: EcoTotals = {
    totalTokens: totals.totalTokens + tokens,
    totalWater: totals.totalWater + waterMl,
    totalEnergy: totals.totalEnergy + energyWh
  };

  const bottleMl = 500;
  const bottlesSaved = nextTotals.totalWater / bottleMl;

  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ ...nextTotals, bottlesSaved }, () => resolve());
  });

  try {
    chrome.runtime.sendMessage({ type: "eco-log", payload }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("EcoStats cloud log failed", chrome.runtime.lastError);
        // Fallback to direct fetch from content script.
        fetch(WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch((error) => {
          console.error("EcoStats cloud log failed", error);
        });
        return;
      }
      if (!response?.ok) {
        console.error("EcoStats cloud log failed", response);
      }
    });
  } catch (error) {
    console.error("EcoStats cloud log failed", error);
  }
}
