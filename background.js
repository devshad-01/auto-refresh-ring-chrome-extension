// Auto Refresh Ring/Notify - Background Service Worker
// Fast, persistent text monitoring with offscreen audio

let isMonitoring = false;
let checkIntervalId = null;
let currentTabId = null;
let lastTextFound = null;
let alarmSounding = false;
let monitorSettings = null;
let creatingOffscreen = false;

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isMonitoring: false, alarmSounding: false });
});

// Restore monitoring on startup
chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get(['isMonitoring', 'currentTabId', 'monitorSettings']);
  if (data.isMonitoring && data.currentTabId && data.monitorSettings) {
    currentTabId = data.currentTabId;
    monitorSettings = data.monitorSettings;
    isMonitoring = true;
    startCheckLoop();
  }
});

// Create offscreen document for audio playback
async function setupOffscreen() {
  if (creatingOffscreen) return;
  
  // Check if already exists using getContexts
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  
  if (existingContexts.length > 0) return;
  
  creatingOffscreen = true;
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play alarm sound when alert triggers'
    });
  } catch (e) {
    // Ignore errors
  }
  creatingOffscreen = false;
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startMonitoring':
      startMonitoring(message.settings);
      sendResponse({ success: true });
      break;
    case 'stopMonitoring':
      stopMonitoring();
      sendResponse({ success: true });
      break;
    case 'stopAlarm':
      stopAlarm();
      sendResponse({ success: true });
      break;
    case 'getStatus':
      sendResponse({ isMonitoring, alarmSounding });
      break;
    case 'textCheckResult':
      processTextCheckResult(message.found);
      sendResponse({ success: true });
      break;
  }
  return true;
});

// Start monitoring
async function startMonitoring(settings) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs.length) return;

  currentTabId = tabs[0].id;
  monitorSettings = settings;
  isMonitoring = true;
  lastTextFound = null;

  await chrome.storage.local.set({ isMonitoring: true, currentTabId, monitorSettings: settings });

  // Immediate first check
  performTextCheck();
  
  // Start the check loop
  startCheckLoop();
}

// Calculate interval in ms
function getIntervalMs() {
  if (!monitorSettings) return 5000;
  let ms = monitorSettings.interval * 1000;
  if (monitorSettings.unit === 'minutes') ms *= 60;
  else if (monitorSettings.unit === 'hours') ms *= 3600;
  return Math.max(ms, 1000);
}

// Start persistent check loop
function startCheckLoop() {
  stopCheckLoop();
  const intervalMs = getIntervalMs();
  checkIntervalId = setInterval(() => {
    if (isMonitoring) performTextCheck();
  }, intervalMs);
}

// Stop check loop
function stopCheckLoop() {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
}

// Stop monitoring
async function stopMonitoring() {
  isMonitoring = false;
  stopCheckLoop();
  currentTabId = null;
  lastTextFound = null;
  monitorSettings = null;
  await chrome.storage.local.set({ isMonitoring: false });
}

// Stop alarm
async function stopAlarm() {
  alarmSounding = false;
  await chrome.storage.local.set({ alarmSounding: false });
  
  // Stop offscreen audio
  try {
    await setupOffscreen();
    await chrome.runtime.sendMessage({ target: 'offscreen', action: 'stopAlarm' });
  } catch (e) {}
  
  // Stop repeated notifications
  if (repeatId) {
    clearInterval(repeatId);
    repeatId = null;
  }
  
  // Clear notifications
  const notifications = await chrome.notifications.getAll();
  for (const id of Object.keys(notifications)) {
    await chrome.notifications.clear(id);
  }
}

// Perform text check - FAST direct injection
async function performTextCheck() {
  if (!isMonitoring || !currentTabId || !monitorSettings) return;

  try {
    await chrome.tabs.get(currentTabId);

    if (monitorSettings.autoRefresh) {
      await chrome.tabs.reload(currentTabId);
      await new Promise(r => setTimeout(r, 1500));
    }

    // Direct script execution - much faster than content script messaging
    const results = await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      func: (targetText) => {
        const search = targetText.toLowerCase().trim();
        const body = document.body?.innerText?.toLowerCase() || '';
        return body.includes(search);
      },
      args: [monitorSettings.targetText]
    });

    if (results?.[0]) processTextCheckResult(results[0].result);
  } catch (err) {
    if (err.message?.includes('No tab')) stopMonitoring();
  }
}

// Process result
function processTextCheckResult(textFound) {
  if (!monitorSettings) return;

  let shouldAlert = false;
  if (monitorSettings.alertMode === 'found' && textFound) shouldAlert = true;
  else if (monitorSettings.alertMode === 'notFound' && !textFound) shouldAlert = true;

  if (shouldAlert && lastTextFound !== textFound) {
    triggerAlert(textFound);
  }
  lastTextFound = textFound;
}

// Trigger alert
async function triggerAlert(textFound) {
  alarmSounding = true;
  await chrome.storage.local.set({ alarmSounding: true });

  const status = textFound ? 'FOUND' : 'NOT FOUND';
  const msg = `"${monitorSettings.targetText}" is ${status}!`;

  // Desktop Notification
  if (monitorSettings.alertType === 'notification' || monitorSettings.alertType === 'both') {
    showNotification(msg);
    // Start repeating notifications every 4 seconds
    startRepeatingNotifications(msg);
  }

  // Ringing alarm via offscreen document
  if (monitorSettings.alertType === 'ringing' || monitorSettings.alertType === 'both') {
    await playAlarmSound();
  }
}

// Play alarm using offscreen document
async function playAlarmSound() {
  try {
    await setupOffscreen();
    await new Promise(r => setTimeout(r, 100));
    await chrome.runtime.sendMessage({ target: 'offscreen', action: 'playAlarm' });
  } catch (e) {
    // Offscreen failed, notifications will still work
  }
}

// Show notification with embedded icon
function showNotification(message) {
  const notifId = 'webAlert_' + Date.now();
  chrome.notifications.create(notifId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon.png'),
    title: 'ALERT TRIGGERED!',
    message: message,
    priority: 2,
    requireInteraction: true
  });
}

// Repeat notifications
let repeatId = null;
function startRepeatingNotifications(msg) {
  if (repeatId) clearInterval(repeatId);
  repeatId = setInterval(async () => {
    const data = await chrome.storage.local.get(['alarmSounding']);
    if (!data.alarmSounding) { 
      clearInterval(repeatId); 
      repeatId = null; 
      return; 
    }
    showNotification(msg);
  }, 4000);
}

// Click notification to stop alarm
chrome.notifications.onClicked.addListener((id) => {
  if (id.startsWith('webAlert_')) stopAlarm();
});

console.log('Auto Refresh Ring/Notify background loaded');
