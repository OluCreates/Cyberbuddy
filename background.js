// background.js - With JWT token authentication

const BACKEND_URL = "https://backend-production-0f57.up.railway.app";

// Get auth token
async function getAuthToken() {
  const result = await chrome.storage.local.get(['cyberbuddy_token']);
  return result.cyberbuddy_token || null;
}

// Check if user is authenticated
async function isAuthenticated() {
  const token = await getAuthToken();
  return !!token;
}

// Capture screenshot with error handling
async function captureScreenshot() {
  try {
    console.log("[CyberBuddy] Attempting screenshot capture...");
    
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'jpeg',
      quality: 85
    });
    
    console.log("[CyberBuddy] ✓ Screenshot captured:", Math.round(dataUrl.length / 1024), "KB");
    return dataUrl;
  } catch (error) {
    console.error("[CyberBuddy] ✗ Screenshot capture failed:", error);
    throw new Error(`Screenshot failed: ${error.message}`);
  }
}

// Comprehensive analysis with JWT token
async function analyzeComprehensive(data) {
  try {
    console.log("[CyberBuddy] Sending to backend...");
    console.log("  - Screenshot:", data.screenshot ? "Yes" : "No");
    console.log("  - Images:", data.images?.length || 0);
    console.log("  - Video frames:", data.videoFrames?.length || 0);
    
    const token = await getAuthToken();
    
    if (!token) {
      return {
        error: true,
        requiresAuth: true,
        message: "Please log in to use CyberBuddy",
        overall: 'none',
        confidence: 0,
        summary: 'Authentication required'
      };
    }
    
    const response = await fetch(`${BACKEND_URL}/api/analyze-comprehensive`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    console.log("[CyberBuddy] Backend status:", response.status);

    // Handle authentication errors
    if (response.status === 401) {
      // Clear invalid token
      await chrome.storage.local.remove(['cyberbuddy_token', 'cyberbuddy_user']);
      return {
        error: true,
        requiresAuth: true,
        message: "Session expired. Please log in again.",
        overall: 'none',
        confidence: 0,
        summary: 'Authentication required'
      };
    }

    // Handle rate limiting (429)
    if (response.status === 429) {
      const errorData = await response.json();
      console.error("[CyberBuddy] Daily limit reached:", errorData.message);
      
      // Store usage info
      if (errorData.limit && errorData.used) {
        await chrome.storage.local.set({
          cyberbuddy_usage: {
            used: errorData.used,
            limit: errorData.limit,
            tier: errorData.tier
          }
        });
      }
      
      return {
        error: true,
        limitReached: true,
        message: errorData.message || "Daily scan limit reached",
        tier: errorData.tier,
        limit: errorData.limit,
        used: errorData.used,
        overall: 'none',
        confidence: 0,
        summary: 'Limit reached - upgrade to continue'
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[CyberBuddy] Backend error response:", errorText);
      console.error("[CyberBuddy] Response status:", response.status);
      console.error("[CyberBuddy] Response headers:", Object.fromEntries(response.headers.entries()));
      throw new Error(`Backend error ${response.status}: ${errorText.substring(0, 100)}`);
    }

    let result;
    try {
      const responseText = await response.text();
      console.log("[CyberBuddy] Raw response (first 200 chars):", responseText.substring(0, 200));
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error("[CyberBuddy] JSON parse error:", parseError.message);
      console.error("[CyberBuddy] Response was not JSON");
      throw new Error(`Invalid JSON response: ${parseError.message}`);
    }
    
    console.log("[CyberBuddy] ✓ Analysis complete:", result);
    
    // Store usage info if provided
    if (result.usage) {
      await chrome.storage.local.set({
        cyberbuddy_usage: result.usage
      });
      console.log("[CyberBuddy] Usage updated:", result.usage);
    }
    
    return result;
  } catch (error) {
    console.error("[CyberBuddy] ✗ Analysis failed:", error.message);
    return { 
      error: true, 
      message: error.message,
      overall: 'none',
      confidence: 0,
      summary: 'Analysis unavailable'
    };
  }
}

function setBadge(result) {
  // If result is a string (legacy), handle it
  if (typeof result === 'string') {
    let t = "H", color = "#10B981";
    if (result === "yellow") { t = "?"; color = "#F59E0B"; }
    if (result === "red")    { t = "AI"; color = "#EF4444"; }
    if (result === "none")   { t = "";  }
    chrome.action.setBadgeText({ text: t });
    if (t) chrome.action.setBadgeBackgroundColor({ color });
    return;
  }
  
  // FIXED: Backend returns text/visual directly, not in modalities object
  let hasRed = false;
  let hasYellow = false;
  
  if (result.text && result.text.verdict === "red") hasRed = true;
  if (result.visual && result.visual.verdict === "red") hasRed = true;
  if (result.images && result.images.some(img => img.verdict === "red")) hasRed = true;
  if (result.videos && result.videos.some(vid => vid.verdict === "red")) hasRed = true;
  if (result.audioFiles && result.audioFiles.some(aud => aud.verdict === "red")) hasRed = true;
  
  if (!hasRed) {
    if (result.text && result.text.verdict === "yellow") hasYellow = true;
    if (result.visual && result.visual.verdict === "yellow") hasYellow = true;
    if (result.images && result.images.some(img => img.verdict === "yellow")) hasYellow = true;
    if (result.videos && result.videos.some(vid => vid.verdict === "yellow")) hasYellow = true;
    if (result.audioFiles && result.audioFiles.some(aud => aud.verdict === "yellow")) hasYellow = true;
  }
  
  let t = "", color = "#10B981";
  if (hasRed) {
    t = "AI";
    color = "#EF4444";
  } else if (hasYellow) {
    t = "?";
    color = "#F59E0B";
  } else if (result.text?.score > 0 || result.visual?.score > 0 || result.images?.length > 0 || result.videos?.length > 0 || result.audioFiles?.length > 0) {
    t = "H";
    color = "#10B981";
  }
  
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

chrome.tabs.onActivated.addListener(async ({tabId}) => { 
  await clearTabState(tabId); 
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === "complete") await clearTabState(tabId);
});

// FIXED: Proper async message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  console.log("[CyberBuddy BG] Message received:", message.type, "from:", sender.tab?.url || sender.url || "popup");

  // Handle SCREENSHOT CAPTURE
  if (message.type === "capture_screenshot") {
    console.log("[CyberBuddy] Screenshot request received");
    
    captureScreenshot()
      .then(dataUrl => {
        console.log("[CyberBuddy] Sending screenshot back to content script");
        sendResponse({ dataUrl: dataUrl });
      })
      .catch(error => {
        console.error("[CyberBuddy] Screenshot error:", error.message);
        sendResponse({ 
          error: true, 
          message: error.message 
        });
      });
    
    return true; // CRITICAL: Keep message channel open
  }

  // Handle COMPREHENSIVE ANALYSIS
  if (message.type === "api_analyze_comprehensive") {
    console.log("[CyberBuddy] Analysis request received");
    
    analyzeComprehensive(message)
      .then(result => {
        console.log("[CyberBuddy] Sending result back to content script");
        sendResponse(result);
      })
      .catch(error => {
        console.error("[CyberBuddy] Analysis error:", error.message);
        sendResponse({ 
          error: true, 
          message: error.message,
          overall: 'none',
          confidence: 0,
          summary: 'Analysis failed'
        });
      });
    
    return true; // CRITICAL: Keep message channel open
  }

  // Handle WEBSITE AUTH UPDATE
  if (message.type === "WEBSITE_AUTH_UPDATE") {
    console.log("[CyberBuddy BG] 🔄 Received auth update from website");
    
    (async () => {
      try {
        await chrome.storage.local.set({
          cyberbuddy_token: message.token,
          cyberbuddy_user: message.user
        });
        console.log("[CyberBuddy BG] ✅ Auth synced to extension storage!");
        sendResponse({ success: true });
      } catch (error) {
        console.error("[CyberBuddy BG] ❌ Failed to sync auth:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // CRITICAL: Keep message channel open for async response
  }

  // Handle analyze_result message
  if (message.type === "analyze_result" && sender.tab?.id != null) {
    (async () => {
      try {
        const tabId = sender.tab.id;
        const res = message.result;
        const url = sender.tab.url || "";
        const title = sender.tab.title || "Untitled";

        console.log("[CyberBuddy BG] Processing analyze_result:", res);

        res.meta = { ...(res.meta||{}), url, title };
        res.ts = Date.now();

        const key = tabKey(tabId);
        await chrome.storage.local.set({
          [key]: res,
          cyberbuddy_verdict: res,
          cyberbuddy_last_scan: Date.now()
        });

        setBadge(res);

        const histKey = "cyberbuddy_history";
        const old = (await chrome.storage.local.get([histKey]))[histKey] || [];
        
        // Calculate verdict for history based on worst case
        let historyVerdict = "green"; // Default to green
        
        // FIXED: Backend returns text/visual directly, not in modalities object
        if (res.text && res.text.verdict === "red") historyVerdict = "red";
        if (res.visual && res.visual.verdict === "red") historyVerdict = "red";
        if (res.images && res.images.some(img => img.verdict === "red")) historyVerdict = "red";
        if (res.videos && res.videos.some(vid => vid.verdict === "red")) historyVerdict = "red";
        if (res.audioFiles && res.audioFiles.some(aud => aud.verdict === "red")) historyVerdict = "red";
        
        // If not red, check for yellow
        if (historyVerdict !== "red") {
          if (res.text && res.text.verdict === "yellow") historyVerdict = "yellow";
          if (res.visual && res.visual.verdict === "yellow") historyVerdict = "yellow";
          if (res.images && res.images.some(img => img.verdict === "yellow")) historyVerdict = "yellow";
          if (res.videos && res.videos.some(vid => vid.verdict === "yellow")) historyVerdict = "yellow";
          if (res.audioFiles && res.audioFiles.some(aud => aud.verdict === "yellow")) historyVerdict = "yellow";
        }
        
        // If nothing detected, set to none
        const hasAnyAnalysis = (res.text && res.text.score > 0) || 
                               (res.visual && res.visual.score > 0) ||
                               (res.images && res.images.length > 0) ||
                               (res.videos && res.videos.length > 0) ||
                               (res.audioFiles && res.audioFiles.length > 0);
        
        if (!hasAnyAnalysis) {
          historyVerdict = "none";
        }
        
        const entry = {
          url, title, ts: res.ts, 
          overall: historyVerdict,
          api_used: res.api_used || "cyberbuddy-ai"
        };
        const updated = [entry, ...old].slice(0, 25);
        await chrome.storage.local.set({ [histKey]: updated });
        
        console.log("[CyberBuddy BG] History updated with verdict:", historyVerdict);
        
        sendResponse({ success: true }); // Send response to content script
      } catch (error) {
        console.error("[CyberBuddy BG] Error processing analyze_result:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep message channel open for async response
  }

  // Handle cb_reset_for_tab message
  if (message.type === "cb_reset_for_tab" && sender.tab?.id != null) {
    (async () => {
      await clearTabState(sender.tab.id);
    })();
    return false;
  }

  return false;
});

console.log("[CyberBuddy] Background script loaded with JWT authentication");
