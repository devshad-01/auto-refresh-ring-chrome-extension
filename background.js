const CHECK_ALARM = 'monitor-check';
const REPEAT_NOTIFICATION_ALARM = 'repeat-notification';

const state = {
  isMonitoring: false,
  currentTabId: null,
  monitorSettings: null,
  lastTextFound: null,
  alarmSounding: false,
  lastAlertMessage: null,
  creatingOffscreen: false
};

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ isMonitoring: false, alarmSounding: false });
});

chrome.runtime.onStartup.addListener(async () => {
  await restoreState();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ success: true, ...result }))
    .catch((error) => sendResponse({ success: false, error: error.message }));
  return true;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === CHECK_ALARM) {
    await performTextCheck();
  }

  if (alarm.name === REPEAT_NOTIFICATION_ALARM) {
    await repeatNotificationTick();
  }
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId.startsWith('webAlert_')) {
    await stopAlarm();
  }
});

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'startMonitoring':
      await startMonitoring(message.settings, sender);
      return {};
    case 'stopMonitoring':
      await stopMonitoring();
      return {};
    case 'stopAlarm':
      await stopAlarm();
      return {};
    case 'getStatus':
      return {
        isMonitoring: state.isMonitoring,
        alarmSounding: state.alarmSounding
      };
    default:
      return {};
  }
}

async function restoreState() {
  const data = await chrome.storage.local.get([
    'isMonitoring',
    'currentTabId',
    'monitorSettings',
    'alarmSounding'
  ]);

  state.isMonitoring = Boolean(data.isMonitoring);
  state.currentTabId = data.currentTabId ?? null;
  state.monitorSettings = data.monitorSettings ?? null;
  state.alarmSounding = Boolean(data.alarmSounding);

  if (state.isMonitoring && state.currentTabId && state.monitorSettings) {
    scheduleCheckAlarm();
  }
}

async function startMonitoring(settings, sender) {
  if (!settings?.targetText?.trim()) {
    throw new Error('Target text is required');
  }

  const tabId = sender?.tab?.id ?? (await getActiveTabId());
  if (!tabId) {
    throw new Error('No active tab found');
  }

  state.currentTabId = tabId;
  state.monitorSettings = {
    targetText: settings.targetText.trim(),
    alertMode: settings.alertMode,
    alertType: settings.alertType,
    interval: Math.max(Number(settings.interval) || 10, 1),
    unit: settings.unit,
    autoRefresh: Boolean(settings.autoRefresh)
  };
  state.lastTextFound = null;
  state.isMonitoring = true;

  await chrome.storage.local.set({
    isMonitoring: true,
    currentTabId: state.currentTabId,
    monitorSettings: state.monitorSettings
  });

  await performTextCheck();
  scheduleCheckAlarm();
}

async function stopMonitoring() {
  state.isMonitoring = false;
  state.currentTabId = null;
  state.monitorSettings = null;
  state.lastTextFound = null;

  await chrome.alarms.clear(CHECK_ALARM);
  await chrome.storage.local.set({
    isMonitoring: false,
    currentTabId: null,
    monitorSettings: null
  });
}

async function stopAlarm() {
  state.alarmSounding = false;
  state.lastAlertMessage = null;

  await chrome.storage.local.set({ alarmSounding: false });
  await chrome.alarms.clear(REPEAT_NOTIFICATION_ALARM);

  try {
    await setupOffscreen();
    await chrome.runtime.sendMessage({ target: 'offscreen', action: 'stopAlarm' });
  } catch (_error) {
  }

  const notifications = await chrome.notifications.getAll();
  await Promise.all(
    Object.keys(notifications)
      .filter((id) => id.startsWith('webAlert_'))
      .map((id) => chrome.notifications.clear(id))
  );
}

async function performTextCheck() {
  if (!state.isMonitoring || !state.currentTabId || !state.monitorSettings) {
    return;
  }

  try {
    await chrome.tabs.get(state.currentTabId);

    if (state.monitorSettings.autoRefresh) {
      await chrome.tabs.reload(state.currentTabId);
      await waitForTabLoad(state.currentTabId, 20000);
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: state.currentTabId },
      func: (targetText) => {
        const search = targetText.toLowerCase().trim();
        const body = document.body?.innerText?.toLowerCase() || '';
        return body.includes(search);
      },
      args: [state.monitorSettings.targetText]
    });

    const textFound = Boolean(results?.[0]?.result);
    await processTextCheckResult(textFound);
  } catch (error) {
    const message = String(error?.message || '');
    const isTabGone = message.includes('No tab with id') || message.includes('cannot be edited');
    const isRestrictedPage = message.includes('Cannot access a chrome:// URL');

    if (isTabGone || isRestrictedPage) {
      await stopMonitoring();
    }
  }
}

async function processTextCheckResult(textFound) {
  if (!state.monitorSettings) {
    return;
  }

  const shouldAlert =
    (state.monitorSettings.alertMode === 'found' && textFound) ||
    (state.monitorSettings.alertMode === 'notFound' && !textFound);

  if (shouldAlert && state.lastTextFound !== textFound) {
    await triggerAlert(textFound);
  }

  state.lastTextFound = textFound;
}

async function triggerAlert(textFound) {
  state.alarmSounding = true;

  const statusLabel = textFound ? 'FOUND' : 'NOT FOUND';
  const message = `"${state.monitorSettings.targetText}" is ${statusLabel}.`;
  state.lastAlertMessage = message;

  await chrome.storage.local.set({ alarmSounding: true });

  if (state.monitorSettings.alertType === 'notification' || state.monitorSettings.alertType === 'both') {
    await showNotification(message);
    await chrome.alarms.create(REPEAT_NOTIFICATION_ALARM, { periodInMinutes: 0.1 });
  }

  if (state.monitorSettings.alertType === 'ringing' || state.monitorSettings.alertType === 'both') {
    await playAlarmSound();
  }
}

async function repeatNotificationTick() {
  const data = await chrome.storage.local.get(['alarmSounding']);
  if (!data.alarmSounding || !state.lastAlertMessage) {
    await chrome.alarms.clear(REPEAT_NOTIFICATION_ALARM);
    return;
  }

  await showNotification(state.lastAlertMessage);
}

async function showNotification(message) {
  const notificationId = `webAlert_${Date.now()}`;
  await chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: 'Auto Refresh Alert',
    message,
    priority: 2,
    requireInteraction: true
  });
}

function scheduleCheckAlarm() {
  if (!state.isMonitoring || !state.monitorSettings) {
    return;
  }

  const intervalMs = getIntervalMs(state.monitorSettings.interval, state.monitorSettings.unit);
  const periodInMinutes = Math.max(intervalMs / 60000, 0.1);

  chrome.alarms.create(CHECK_ALARM, { periodInMinutes });
}

function getIntervalMs(intervalValue, unit) {
  let seconds = intervalValue;

  if (unit === 'minutes') {
    seconds *= 60;
  } else if (unit === 'hours') {
    seconds *= 3600;
  }

  return Math.max(seconds * 1000, 1000);
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0]?.id ?? null;
}

async function setupOffscreen() {
  if (state.creatingOffscreen) {
    return;
  }

  if (typeof chrome.runtime.getContexts === 'function') {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (contexts.length > 0) {
      return;
    }
  }

  state.creatingOffscreen = true;
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play repeating alarm audio when a monitored condition is met.'
    });
  } finally {
    state.creatingOffscreen = false;
  }
}

async function playAlarmSound() {
  try {
    await setupOffscreen();
    await chrome.runtime.sendMessage({ target: 'offscreen', action: 'playAlarm' });
  } catch (_error) {
  }
}

function waitForTabLoad(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }, timeoutMs);

    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId) {
        return;
      }

      if (changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}
