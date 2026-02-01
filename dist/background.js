chrome.action.onClicked.addListener(async n=>{const e=n.id;typeof e=="number"&&chrome.tabs.sendMessage(e,{type:"TOGGLE_MODAL"})});
