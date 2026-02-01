chrome.action.onClicked.addListener(async (tab) => {
  const tabId = tab.id;
  if (typeof tabId !== "number") return;
  chrome.tabs.sendMessage(tabId, { type: "TOGGLE_MODAL" });
});
