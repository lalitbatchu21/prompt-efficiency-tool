const WORKER_URL = "https://backend.lalitbatchu.workers.dev";

console.log("Prompt Efficiency Tool: background service worker loaded");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "eco-log") return;
  console.log("Prompt Efficiency Tool: eco-log received", message.payload);

  fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message.payload ?? {})
  })
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      console.error("EcoStats cloud log failed", error);
      sendResponse({ ok: false });
    });

  return true;
});
