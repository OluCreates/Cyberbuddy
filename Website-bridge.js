// website-bridge.js - Syncs website auth with extension
(function() {
  'use strict';
  
  console.log("[CyberBuddy Bridge] === STARTING ===");
  console.log("[CyberBuddy Bridge] URL:", window.location.href);
  
  let syncCount = 0;
  
  // Function to sync auth
  function syncAuthToExtension() {
    syncCount++;
    
    try {
      const token = localStorage.getItem('cyberbuddy_token');
      const userStr = localStorage.getItem('cyberbuddy_user');
      
      console.log(`[CyberBuddy Bridge] Sync #${syncCount} - Has token: ${!!token}`);
      
      if (!token || !userStr) {
        return; // No auth to sync
      }
      
      const user = JSON.parse(userStr);
      console.log("[CyberBuddy Bridge] 🔄 Syncing auth to extension...");
      
      // Make sure chrome.runtime exists
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        console.error("[CyberBuddy Bridge] ❌ chrome.runtime not available!");
        return;
      }
      
      // Send to extension
      chrome.runtime.sendMessage(
        {
          type: 'WEBSITE_AUTH_UPDATE',
          token: token,
          user: user
        },
        function(response) {
          if (chrome.runtime.lastError) {
            console.error("[CyberBuddy Bridge] ❌ Error:", chrome.runtime.lastError.message);
          } else {
            console.log("[CyberBuddy Bridge] ✅ Successfully synced!", response);
          }
        }
      );
      
    } catch (error) {
      console.error("[CyberBuddy Bridge] ❌ Exception:", error);
    }
  }
  
  // Run once immediately
  console.log("[CyberBuddy Bridge] Running initial sync...");
  syncAuthToExtension();
  
  // Poll every 1 second
  console.log("[CyberBuddy Bridge] Starting 1-second poll...");
  setInterval(function() {
    syncAuthToExtension();
  }, 1000);
  
  // Listen for login event from auth page
  window.addEventListener('cyberbuddy_login', function() {
    console.log("[CyberBuddy Bridge] 🎉 Login event received!");
    syncAuthToExtension();
  });
  
  console.log("[CyberBuddy Bridge] === READY ===");
  
})();