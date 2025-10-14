// background.js  â€” no network; just store results & manage UI state

function setBadge(verdict) {
  let t = "G", color = "#2ecc71";
  if (verdict === "yellow") { t = "Y"; color = "#f1c40f"; }
  if (verdict === "red")    { t = "R"; color = "#e74c3c"; }
  if (verdict === "none")   { t = "";  }
  chrome.action.setBadgeText({ text: t });
  if (t) chrome.action.setBadgeBackgroundColor({ color });
}
function tabKey(tabId){ return `cyberbuddy_tab_${tabId}`; }

async function clearTabState(tabId){
  const key = tabKey(tabId);
  const existing = await chrome.storage.local.get([key]);
  if (existing[key]) await chrome.storage.local.remove([key]);
  await chrome.storage.local.remove(["cyberbuddy_verdict","cyberbuddy_last_scan"]);
  setBadge("none");
}

// Reset when switching tabs or loading a new page
chrome.tabs.onActivated.addListener(async ({tabId}) => { await clearTabState(tabId); });
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === "complete") await clearTabState(tabId);
});

// Messages from content_script / popup
chrome.runtime.onMessage.addListener(async (message, sender) => {
  if (!message) return;

  // Content script announces new page load â†’ reset this tab
  if (message.type === "cb_reset_for_tab" && sender.tab?.id != null) {
    await clearTabState(sender.tab.id);
    return;
  }

  // Content script says scanning started â†’ tell popup right away
  if (message.type === "cb_scan_started") {
    chrome.runtime.sendMessage({ type: "scan_status", status: "started" });
    return;
  }

  // Content script sends computed analysis (all local)
  if (message.type === "analyze_result" && sender.tab?.id != null) {
    const tabId = sender.tab.id;
    const res = message.result;
    const url = sender.tab.url || "";
    const title = sender.tab.title || "Untitled";

    // Attach meta & timestamps
    res.meta = { ...(res.meta||{}), url, title };
    res.ts = Date.now();

    // Store per-tab result (for popup)
    const key = tabKey(tabId);
    await chrome.storage.local.set({
      [key]: res,
      cyberbuddy_verdict: res,
      cyberbuddy_last_scan: Date.now()
    });

    // Update badge
    setBadge(res.overall || "none");

    // Append to history (last 25)
    const histKey = "cyberbuddy_history";
    const old = (await chrome.storage.local.get([histKey]))[histKey] || [];
    const entry = {
      url, title, ts: res.ts, overall: res.overall, winner: res.winner,
      score_text: res.modalities?.text?.score || 0,
      score_visual: res.modalities?.visual?.score || 0
    };
    const updated = [entry, ...old].slice(0, 25);
    await chrome.storage.local.set({ [histKey]: updated });

    // Tell popup we're done
    chrome.runtime.sendMessage({ type: "scan_status", status: "done" });
  }
});