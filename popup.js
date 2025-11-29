// popup.js - Simplified without usage limits or doom-scroll mode
console.log("[CyberBuddy Popup] Script starting...");

const BACKEND_URL = "https://backend-production-0f57.up.railway.app";
const WEBSITE_URL = "https://cyberbuddy.app";

console.log("[CyberBuddy Popup] Constants defined");

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

function initializeApp() {
  console.log("[CyberBuddy Popup] DOM ready, initializing...");

// View elements
const loginView = document.getElementById("loginView");
const mainView = document.getElementById("mainView");
const textPanel = document.getElementById("textPanel");
const settingsPanel = document.getElementById("settingsPanel");

console.log("[CyberBuddy Popup] Views:", { loginView, mainView, textPanel, settingsPanel });

// Main view elements
const verdict = document.getElementById("verdict");
const pills = document.getElementById("pills");
const reasons = document.getElementById("reasons");
const note = document.getElementById("note");
const scanBtn = document.getElementById("scan");
const scanText = document.getElementById("scantext");
const spinner = document.getElementById("spin");
const history = document.getElementById("history");
const resultsCard = document.getElementById("resultsCard");

// Text analysis panel elements
const openTextAnalysisBtn = document.getElementById("openTextAnalysis");
const backToMainBtn = document.getElementById("backToMain");
const textInput = document.getElementById("textInput");
const wordCountSpan = document.getElementById("wordCount");
const analyzeTextBtn = document.getElementById("analyzeText");
const analyzeTextLabel = document.getElementById("analyzeTextLabel");
const textSpin = document.getElementById("textSpin");
const textResultsCard = document.getElementById("textResultsCard");
const textVerdict = document.getElementById("textVerdict");
const textPills = document.getElementById("textPills");
const textReasons = document.getElementById("textReasons");
const textNote = document.getElementById("textNote");

// Settings panel elements
const openSettingsBtn = document.getElementById("openSettings");
const backToMainFromSettingsBtn = document.getElementById("backToMainFromSettings");
const settingsEmail = document.getElementById("settingsEmail");
const logoutBtn = document.getElementById("logoutBtn");
const blockAIToggle = document.getElementById("blockAIToggle");
const analyzeImagesToggle = document.getElementById("analyzeImagesToggle");
const analyzeVideosToggle = document.getElementById("analyzeVideosToggle");
const analyzeAudioToggle = document.getElementById("analyzeAudioToggle");

// Login button
const loginBtn = document.getElementById("loginBtn");

// Current user data
let currentUser = null;

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

// Check if user is authenticated
async function isAuthenticated() {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      console.error("[CyberBuddy] chrome.storage.local not available");
      return false;
    }
    
    const result = await chrome.storage.local.get(['cyberbuddy_token']);
    console.log("[CyberBuddy] Token check:", !!result.cyberbuddy_token);
    return !!result.cyberbuddy_token;
  } catch (error) {
    console.error("[CyberBuddy] isAuthenticated error:", error);
    return false;
  }
}

// Get user data
async function getUserData() {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      return null;
    }
    const result = await chrome.storage.local.get(['cyberbuddy_user']);
    return result.cyberbuddy_user || null;
  } catch (error) {
    console.error("[CyberBuddy] getUserData error:", error);
    return null;
  }
}

// Fetch user status from backend
async function fetchUserStatus() {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      console.error("[CyberBuddy] chrome.storage not available");
      return null;
    }
    
    const result = await chrome.storage.local.get(['cyberbuddy_token']);
    const token = result.cyberbuddy_token;
    
    if (!token) {
      console.log("[CyberBuddy] No auth token found");
      return null;
    }
    
    console.log("[CyberBuddy] Fetching user status...");
    
    const response = await fetch(`${BACKEND_URL}/api/auth/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        console.log("[CyberBuddy] Token expired, clearing auth");
        await chrome.storage.local.remove(['cyberbuddy_token', 'cyberbuddy_user']);
      }
      throw new Error(`Status check failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("[CyberBuddy] User status:", data);
    
    // Store user data
    await chrome.storage.local.set({
      cyberbuddy_user: data.user
    });
    
    currentUser = data.user;
    
    return data;
    
  } catch (error) {
    console.error("[CyberBuddy] Failed to fetch user status:", error);
    return null;
  }
}

// Initialize the popup
async function initializePopup() {
  const authenticated = await isAuthenticated();
  
  if (!authenticated) {
    showView('login');
    
    // AGGRESSIVE POLLING: Check for login every 1 second when on login screen
    console.log("[CyberBuddy] Starting login polling...");
    const loginPollInterval = setInterval(async () => {
      const nowAuthenticated = await isAuthenticated();
      if (nowAuthenticated) {
        console.log("[CyberBuddy] User logged in! Stopping poll and initializing...");
        clearInterval(loginPollInterval);
        initializePopup(); // Re-initialize
      }
    }, 1000);
    
    // Store interval ID so we can clear it if needed
    window.loginPollInterval = loginPollInterval;
    
    return;
  }
  
  // Clear any existing login poll
  if (window.loginPollInterval) {
    clearInterval(window.loginPollInterval);
    window.loginPollInterval = null;
  }
  
  // Fetch latest user status
  const status = await fetchUserStatus();
  
  if (!status) {
    showView('login');
    return;
  }
  
  // Show main view
  showView('main');
  loadCurrentResults();
  loadHistoryFromStorage();
  
  // Load content type settings (so toggles show correct state)
  loadContentTypeSettings();
}

// Show specific view
function showView(viewName) {
  loginView.classList.remove('active');
  mainView.classList.remove('active');
  textPanel.classList.remove('active');
  settingsPanel.classList.remove('active');
  
  switch(viewName) {
    case 'login':
      loginView.classList.add('active');
      break;
    case 'main':
      mainView.classList.add('active');
      break;
    case 'text':
      textPanel.classList.add('active');
      break;
    case 'settings':
      settingsPanel.classList.add('active');
      updateSettingsUI();
      break;
  }
}

// Update settings UI
async function updateSettingsUI() {
  if (currentUser) {
    settingsEmail.textContent = currentUser.email;
  }
  
  // Load block AI content toggle state
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(['cyberbuddy_block_ai']);
      const isEnabled = result.cyberbuddy_block_ai || false;
      
      if (isEnabled) {
        blockAIToggle.classList.add('active');
      } else {
        blockAIToggle.classList.remove('active');
      }
    }
  } catch (error) {
    console.error("[CyberBuddy] Load block AI setting error:", error);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

// Login button
loginBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: `${WEBSITE_URL}/auth.html` }, (tab) => {
    console.log("[CyberBuddy] Opened auth page, will check for login...");
    
    // Poll for token every 2 seconds after opening auth page
    const pollInterval = setInterval(async () => {
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          const result = await chrome.storage.local.get(['cyberbuddy_token']);
          if (result.cyberbuddy_token) {
            console.log("[CyberBuddy] Token detected! User logged in.");
            clearInterval(pollInterval);
            // Re-initialize popup
            await initializePopup();
          }
        }
      } catch (error) {
        console.error("[CyberBuddy] Poll error:", error);
      }
    }, 2000);
    
    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 300000);
  });
});

// Settings button
openSettingsBtn.addEventListener('click', () => {
  showView('settings');
  loadContentTypeSettings(); // Load content type toggle states
});

// Back from settings
backToMainFromSettingsBtn.addEventListener('click', () => {
  showView('main');
});

// Logout button
logoutBtn.addEventListener('click', async () => {
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove(['cyberbuddy_token', 'cyberbuddy_user']);
    }
  } catch (error) {
    console.error("[CyberBuddy] Logout error:", error);
  }
  currentUser = null;
  showView('login');
});

// Text analysis panel
openTextAnalysisBtn.addEventListener('click', () => {
  showView('text');
  textInput.focus();
});

backToMainBtn.addEventListener('click', () => {
  showView('main');
});

// Word counter
textInput.addEventListener('input', () => {
  const words = textInput.value.trim().split(/\s+/).filter(w => w.length > 0);
  wordCountSpan.textContent = words.length;
});

// Analyze text button
analyzeTextBtn.addEventListener('click', async () => {
  const authenticated = await isAuthenticated();
  
  if (!authenticated) {
    alert('Please log in to analyze text');
    showView('login');
    return;
  }
  
  const text = textInput.value.trim();
  
  if (!text || text.length < 10) {
    alert('Please enter at least 10 characters of text');
    return;
  }
  
  analyzeTextBtn.disabled = true;
  textSpin.style.display = 'inline-block';
  analyzeTextLabel.textContent = 'Analyzing...';
  
  try {
    const result = await chrome.storage.local.get(['cyberbuddy_token']);
    const token = result.cyberbuddy_token;
    
    const response = await fetch(`${BACKEND_URL}/api/analyze-comprehensive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        textContent: text,  // Backend expects 'textContent'
        wordCount: text.split(/\s+/).length,
        images: [],
        videos: [],
        audioRecordings: []
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analysis failed');
    }
    
    const data = await response.json();
    console.log("[CyberBuddy] Full response:", data);
    
    // Extract text result from comprehensive response
    const textResult = data.text || data;
    console.log("[CyberBuddy] Text result:", textResult);
    
    displayTextResults(textResult);
    
  } catch (error) {
    console.error("[CyberBuddy] Text analysis error:", error);
    alert(`Error: ${error.message}`);
  } finally {
    analyzeTextBtn.disabled = false;
    textSpin.style.display = 'none';
    analyzeTextLabel.textContent = 'Analyze Text';
  }
});

function displayTextResults(result) {
  textResultsCard.style.display = 'block';
  
  // Verdict
  let verdictClass = 'v-none';
  let verdictText = 'Unable to determine';
  
  if (result.verdict === 'green') {
    verdictClass = 'v-green pulsate-green';
    verdictText = '✓ Human Content';
  } else if (result.verdict === 'yellow') {
    verdictClass = 'v-yellow pulsate-yellow';
    verdictText = '⚠ Mixed/Uncertain';
  } else if (result.verdict === 'red') {
    verdictClass = 'v-red pulsate-red';
    verdictText = '⚠ AI Content Detected';
  }
  
  textVerdict.className = `verdict ${verdictClass}`;
  textVerdict.textContent = verdictText;
  
  // Confidence pill - FIXED: Invert for green verdicts
  textPills.innerHTML = '';
  if (result.score !== undefined) {
    // For green (human), invert the AI confidence score
    const rawScore = result.score;
    const displayScore = result.verdict === 'green' ? (1 - rawScore) : rawScore;
    const conf = Math.round(displayScore * 100);
    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.textContent = `${conf}% confidence`;
    textPills.appendChild(pill);
  }
  
  // Reasons - FIXED: reason is a string, not an array
  textReasons.innerHTML = '';
  if (result.reason && typeof result.reason === 'string') {
    const li = document.createElement('li');
    li.textContent = result.reason;
    li.style.fontSize = '12px';
    li.style.color = 'var(--muted)';
    textReasons.appendChild(li);
  }
}

// Block AI content toggle
if (blockAIToggle) {
  blockAIToggle.addEventListener('click', toggleBlockAIContent);
  console.log("[CyberBuddy Popup] Block AI toggle listener added");
} else {
  console.error("[CyberBuddy Popup] Block AI toggle element not found!");
}

// Content type analysis toggles
if (analyzeImagesToggle) {
  analyzeImagesToggle.addEventListener('click', () => toggleContentType('analyzeImages', analyzeImagesToggle));
  console.log("[CyberBuddy Popup] Analyze Images toggle listener added");
} else {
  console.error("[CyberBuddy Popup] Analyze Images toggle element not found!");
}

if (analyzeVideosToggle) {
  analyzeVideosToggle.addEventListener('click', () => toggleContentType('analyzeVideos', analyzeVideosToggle));
  console.log("[CyberBuddy Popup] Analyze Videos toggle listener added");
} else {
  console.error("[CyberBuddy Popup] Analyze Videos toggle element not found!");
}

if (analyzeAudioToggle) {
  analyzeAudioToggle.addEventListener('click', () => toggleContentType('analyzeAudio', analyzeAudioToggle));
  console.log("[CyberBuddy Popup] Analyze Audio toggle listener added");
} else {
  console.error("[CyberBuddy Popup] Analyze Audio toggle element not found!");
}

async function toggleContentType(settingName, toggleElement) {
  console.log(`[CyberBuddy Popup] Toggle clicked: ${settingName}`);
  try {
    const result = await chrome.storage.sync.get({ [settingName]: true });
    const isEnabled = result[settingName];
    
    console.log(`[CyberBuddy Popup] Current state of ${settingName}: ${isEnabled}`);
    
    await chrome.storage.sync.set({ [settingName]: !isEnabled });
    
    if (!isEnabled) {
      toggleElement.classList.add('active');
      console.log(`[CyberBuddy] ${settingName}: ENABLED`);
    } else {
      toggleElement.classList.remove('active');
      console.log(`[CyberBuddy] ${settingName}: DISABLED`);
    }
  } catch (error) {
    console.error(`[CyberBuddy] Error toggling ${settingName}:`, error);
  }
}

async function loadContentTypeSettings() {
  console.log("[CyberBuddy Popup] Loading content type settings...");
  try {
    const result = await chrome.storage.sync.get({
      analyzeImages: true,
      analyzeVideos: true,
      analyzeAudio: true
    });
    
    console.log("[CyberBuddy Popup] Settings loaded from storage:", result);
    
    if (analyzeImagesToggle) {
      if (result.analyzeImages) {
        analyzeImagesToggle.classList.add('active');
      } else {
        analyzeImagesToggle.classList.remove('active');
      }
      console.log(`[CyberBuddy Popup] Images toggle set to: ${result.analyzeImages ? 'ON' : 'OFF'}`);
    }
    
    if (analyzeVideosToggle) {
      if (result.analyzeVideos) {
        analyzeVideosToggle.classList.add('active');
      } else {
        analyzeVideosToggle.classList.remove('active');
      }
      console.log(`[CyberBuddy Popup] Videos toggle set to: ${result.analyzeVideos ? 'ON' : 'OFF'}`);
    }
    
    if (analyzeAudioToggle) {
      if (result.analyzeAudio) {
        analyzeAudioToggle.classList.add('active');
      } else {
        analyzeAudioToggle.classList.remove('active');
      }
      console.log(`[CyberBuddy Popup] Audio toggle set to: ${result.analyzeAudio ? 'ON' : 'OFF'}`);
    }
    
    console.log("[CyberBuddy] Content type settings loaded:", result);
  } catch (error) {
    console.error("[CyberBuddy] Error loading content type settings:", error);
  }
}

async function toggleBlockAIContent() {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      console.error("[CyberBuddy] chrome.storage not available");
      return;
    }
    
    const result = await chrome.storage.local.get(['cyberbuddy_block_ai']);
    const isEnabled = result.cyberbuddy_block_ai || false;
    
    await chrome.storage.local.set({ cyberbuddy_block_ai: !isEnabled });
    
    if (!isEnabled) {
      blockAIToggle.classList.add('active');
      console.log("[CyberBuddy] Block AI Content: ENABLED");
    } else {
      blockAIToggle.classList.remove('active');
      console.log("[CyberBuddy] Block AI Content: DISABLED");
    }
    
    // Notify content scripts about the change
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { 
          type: "block_ai_setting_changed", 
          enabled: !isEnabled 
        }, () => {
          // Ignore errors for tabs without content script
          if (chrome.runtime.lastError) return;
        });
      });
    });
    
  } catch (error) {
    console.error("[CyberBuddy] Toggle block AI error:", error);
  }
}

// Scan button
scanBtn.addEventListener('click', async () => {
  const authenticated = await isAuthenticated();
  
  if (!authenticated) {
    alert('Please log in to scan pages');
    showView('login');
    return;
  }
  
  scanBtn.disabled = true;
  spinner.style.display = 'inline-block';
  scanText.textContent = 'Scanning...';
  
  chrome.runtime.sendMessage({ type: "cb_reset_for_tab" });
  
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) {
    alert("No active tab");
    resetScanButton();
    return;
  }
  
  chrome.tabs.sendMessage(tabs[0].id, { type: "scan_media" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("[Popup] Send error:", chrome.runtime.lastError.message);
      resetScanButton();
    } else {
      console.log("[Popup] Scan initiated, polling for completion...");
      pollScanState();
    }
  });
});

function pollScanState() {
  let pollCount = 0;
  const maxPolls = 60; // Max 30 seconds (60 * 500ms)
  
  const pollInterval = setInterval(async () => {
    pollCount++;
    
    try {
      // Query the active tab for scan state
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        clearInterval(pollInterval);
        resetScanButton();
        return;
      }
      
      // Check if scan and display are complete
      chrome.tabs.sendMessage(tabs[0].id, { type: "check_scan_state" }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script might not be ready
          return;
        }
        
        if (response && !response.scanInProgress && !response.displayInProgress) {
          // Scan and display are both complete
          console.log("[Popup] ✅ Scan and display complete, resetting button");
          clearInterval(pollInterval);
          resetScanButton();
          loadCurrentResults(); // Refresh results
        }
      });
      
      // Safety timeout after 30 seconds
      if (pollCount >= maxPolls) {
        console.log("[Popup] ⏱️ Scan timeout reached, resetting button");
        clearInterval(pollInterval);
        resetScanButton();
        loadCurrentResults(); // Still try to load results
      }
      
    } catch (error) {
      console.error("[Popup] Poll error:", error);
    }
  }, 500); // Poll every 500ms
}

function resetScanButton() {
  scanBtn.disabled = false;
  spinner.style.display = 'none';
  scanText.textContent = 'Scan Page';
}


// Load current results
async function loadCurrentResults() {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      console.log("[CyberBuddy] chrome.storage not available for loading results");
      return;
    }
    
    const result = await chrome.storage.local.get(['cyberbuddy_verdict']);
    const data = result.cyberbuddy_verdict;
  
  if (!data || !data.modalities) {
    verdict.textContent = "No scan yet";
    verdict.className = "verdict v-none";
    pills.innerHTML = "";
    reasons.innerHTML = "";
    note.textContent = "";
    resultsCard.classList.remove('results-active');
    return;
  }
  
  displayResults(data);
  } catch (error) {
    console.error("[CyberBuddy] Load results error:", error);
  }
}

function displayResults(data) {
  resultsCard.classList.add('results-active');
  
  const mods = data.modalities || {};
  let overallVerdict = 'green';
  let hasRed = false;
  let hasYellow = false;
  
  // Check for red flags
  if (mods.text && mods.text.verdict === 'red') hasRed = true;
  if (mods.visual && mods.visual.verdict === 'red') hasRed = true;
  if (data.images && data.images.some(img => img.verdict === 'red')) hasRed = true;
  
  // Check for yellow flags
  if (!hasRed) {
    if (mods.text && mods.text.verdict === 'yellow') hasYellow = true;
    if (mods.visual && mods.visual.verdict === 'yellow') hasYellow = true;
    if (data.images && data.images.some(img => img.verdict === 'yellow')) hasYellow = true;
  }
  
  if (hasRed) {
    overallVerdict = 'red';
  } else if (hasYellow) {
    overallVerdict = 'yellow';
  }
  
  // Update verdict display
  let verdictText = '';
  let verdictClass = 'v-none';
  
  if (overallVerdict === 'red') {
    verdictText = '⚠ AI Content Detected';
    verdictClass = 'v-red pulsate-red';
  } else if (overallVerdict === 'yellow') {
    verdictText = '⚠ Mixed Content';
    verdictClass = 'v-yellow pulsate-yellow';
  } else {
    verdictText = '✓ Appears Human';
    verdictClass = 'v-green pulsate-green';
  }
  
  verdict.textContent = verdictText;
  verdict.className = `verdict ${verdictClass}`;
  
  // Pills
  pills.innerHTML = '';
  if (mods.text) {
    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.textContent = `📝 Text: ${mods.text.verdict}`;
    pills.appendChild(pill);
  }
  if (mods.visual) {
    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.textContent = `🖼️ Visual: ${mods.visual.verdict}`;
    pills.appendChild(pill);
  }
  
  // Reasons
  reasons.innerHTML = '';
  const allReasons = [];
  
  // FIXED: reason is a string, not an array
  if (mods.text && mods.text.reason) {
    allReasons.push(mods.text.reason);
  }
  if (mods.visual && mods.visual.reason) {
    allReasons.push(mods.visual.reason);
  }
  
  allReasons.slice(0, 3).forEach(r => {
    const li = document.createElement('li');
    li.textContent = r;
    li.style.fontSize = '12px';
    li.style.color = 'var(--muted)';
    reasons.appendChild(li);
  });
}

// Load history
async function loadHistoryFromStorage() {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.local) {
      console.log("[CyberBuddy] chrome.storage not available for loading history");
      return;
    }
    
    const result = await chrome.storage.local.get(['cyberbuddy_history']);
    const hist = result.cyberbuddy_history || [];
  
  history.innerHTML = '';
  
  if (hist.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'small';
    msg.style.textAlign = 'center';
    msg.style.padding = '20px';
    msg.textContent = 'No scans yet';
    history.appendChild(msg);
    return;
  }
  
  hist.slice(0, 5).forEach(entry => {
    const item = document.createElement('div');
    item.className = 'hist-item';
    
    const dot = document.createElement('div');
    dot.className = `dot ${entry.overall}`;
    
    const link = document.createElement('a');
    link.className = 'link';
    link.href = entry.url;
    link.textContent = entry.title || entry.url;
    link.target = '_blank';
    
    item.appendChild(dot);
    item.appendChild(link);
    history.appendChild(item);
  });
  } catch (error) {
    console.error("[CyberBuddy] Load history error:", error);
  }
}

// Listen for storage changes
if (chrome && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      // CRITICAL: Detect when user logs in
      if (changes.cyberbuddy_token) {
        console.log("[CyberBuddy] Token changed, re-initializing...");
        // User just logged in or out
        initializePopup();
      }
      
      if (changes.cyberbuddy_verdict) {
        loadCurrentResults();
      }
      if (changes.cyberbuddy_history) {
        loadHistoryFromStorage();
      }
    }
  });
}

// Initialize on load
initializePopup().catch(error => {
  console.error("[CyberBuddy] Initialization error:", error);
  // Show login view on error
  showView('login');
});

// Re-check auth when popup becomes visible (user clicks extension icon)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    console.log("[CyberBuddy] Popup became visible, checking auth...");
    initializePopup();
  }
});

// Also check when window gains focus
window.addEventListener('focus', () => {
  console.log("[CyberBuddy] Window focused, checking auth...");
  initializePopup();
});

console.log("[CyberBuddy] Popup initialized");

} // End of initializeApp function
