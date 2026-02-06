// Auto Refresh Ring/Notify - Popup Script (Compact)

document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const targetText = $('targetText');
  const alertRinging = $('alertRinging');
  const alertNotification = $('alertNotification');
  const intervalValue = $('intervalValue');
  const intervalUnit = $('intervalUnit');
  const autoRefresh = $('autoRefresh');
  const startBtn = $('startBtn');
  const stopBtn = $('stopBtn');
  const stopAlarmBtn = $('stopAlarmBtn');
  const statusDot = $('statusDot');
  const alarmAudio = $('alarmAudio');

  let isAlarmPlaying = false;
  let beepInterval = null;
  let audioCtx = null;

  // Load saved settings
  const saved = await chrome.storage.local.get(['targetText', 'alertMode', 'alertRinging', 'alertNotification', 'intervalValue', 'intervalUnit', 'autoRefresh']);
  if (saved.targetText) targetText.value = saved.targetText;
  if (saved.alertMode) document.querySelector(`input[name="alertMode"][value="${saved.alertMode}"]`).checked = true;
  if (saved.alertRinging !== undefined) alertRinging.checked = saved.alertRinging;
  if (saved.alertNotification !== undefined) alertNotification.checked = saved.alertNotification;
  if (saved.intervalValue) intervalValue.value = saved.intervalValue;
  if (saved.intervalUnit) intervalUnit.value = saved.intervalUnit;
  if (saved.autoRefresh !== undefined) autoRefresh.checked = saved.autoRefresh;

  // Update status
  async function updateStatus() {
    const data = await chrome.storage.local.get(['isMonitoring', 'alarmSounding']);
    if (data.alarmSounding) {
      statusDot.className = 'status-dot alarm';
      stopAlarmBtn.style.display = 'block';
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else if (data.isMonitoring) {
      statusDot.className = 'status-dot active';
      stopAlarmBtn.style.display = 'none';
      startBtn.disabled = true;
      stopBtn.disabled = false;
      stopAlarmSound();
    } else {
      statusDot.className = 'status-dot';
      stopAlarmBtn.style.display = 'none';
      startBtn.disabled = false;
      stopBtn.disabled = true;
      stopAlarmSound();
    }
  }
  await updateStatus();
  setInterval(updateStatus, 500);

  // Save settings
  function saveSettings() {
    chrome.storage.local.set({
      targetText: targetText.value,
      alertMode: document.querySelector('input[name="alertMode"]:checked').value,
      alertRinging: alertRinging.checked,
      alertNotification: alertNotification.checked,
      intervalValue: intervalValue.value,
      intervalUnit: intervalUnit.value,
      autoRefresh: autoRefresh.checked
    });
  }

  // Auto-save on change
  [targetText, intervalValue].forEach(el => el.addEventListener('input', saveSettings));
  [intervalUnit, alertRinging, alertNotification, autoRefresh].forEach(el => el.addEventListener('change', saveSettings));
  document.querySelectorAll('input[name="alertMode"]').forEach(el => el.addEventListener('change', saveSettings));

  // Start monitoring
  startBtn.addEventListener('click', async () => {
    if (!targetText.value.trim()) { targetText.focus(); return; }
    if (!alertRinging.checked && !alertNotification.checked) { alert('Select at least one alert type'); return; }

    let alertType = 'both';
    if (alertRinging.checked && !alertNotification.checked) alertType = 'ringing';
    else if (!alertRinging.checked && alertNotification.checked) alertType = 'notification';

    chrome.runtime.sendMessage({
      action: 'startMonitoring',
      settings: {
        targetText: targetText.value.trim(),
        alertMode: document.querySelector('input[name="alertMode"]:checked').value,
        alertType,
        interval: parseInt(intervalValue.value) || 10,
        unit: intervalUnit.value,
        autoRefresh: autoRefresh.checked
      }
    });
    saveSettings();
  });

  // Stop monitoring
  stopBtn.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'stopMonitoring' }));

  // Stop alarm
  stopAlarmBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stopAlarm' });
    stopAlarmSound();
    stopAlarmBtn.style.display = 'none';
  });

  // Stop alarm sound in popup
  function stopAlarmSound() {
    isAlarmPlaying = false;
    if (beepInterval) { clearInterval(beepInterval); beepInterval = null; }
  }
});
