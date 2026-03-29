document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);

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
  const feedback = $('feedback');

  await loadSavedSettings();
  await updateStatus();

  const statusTimerId = setInterval(updateStatus, 1000);
  window.addEventListener('unload', () => clearInterval(statusTimerId));

  [targetText, intervalValue].forEach((element) => {
    element.addEventListener('input', saveSettings);
  });

  [intervalUnit, alertRinging, alertNotification, autoRefresh].forEach((element) => {
    element.addEventListener('change', saveSettings);
  });

  document.querySelectorAll('input[name="alertMode"]').forEach((element) => {
    element.addEventListener('change', saveSettings);
  });

  startBtn.addEventListener('click', async () => {
    clearFeedback();

    const text = targetText.value.trim();
    if (!text) {
      setFeedback('Enter text to monitor before starting.', 'error');
      targetText.focus();
      return;
    }

    if (!alertRinging.checked && !alertNotification.checked) {
      setFeedback('Enable at least one alert channel.', 'error');
      return;
    }

    const numericInterval = Math.max(Number.parseInt(intervalValue.value, 10) || 10, 1);
    intervalValue.value = String(numericInterval);

    const alertType =
      alertRinging.checked && alertNotification.checked
        ? 'both'
        : alertRinging.checked
          ? 'ringing'
          : 'notification';

    const response = await chrome.runtime.sendMessage({
      action: 'startMonitoring',
      settings: {
        targetText: text,
        alertMode: document.querySelector('input[name="alertMode"]:checked').value,
        alertType,
        interval: numericInterval,
        unit: intervalUnit.value,
        autoRefresh: autoRefresh.checked
      }
    });

    if (!response?.success) {
      setFeedback(response?.error || 'Failed to start monitoring.', 'error');
      return;
    }

    await saveSettings();
    setFeedback('Monitoring started.', 'success');
    await updateStatus();
  });

  stopBtn.addEventListener('click', async () => {
    clearFeedback();
    await chrome.runtime.sendMessage({ action: 'stopMonitoring' });
    setFeedback('Monitoring stopped.', 'success');
    await updateStatus();
  });

  stopAlarmBtn.addEventListener('click', async () => {
    clearFeedback();
    await chrome.runtime.sendMessage({ action: 'stopAlarm' });
    setFeedback('Alarm stopped.', 'success');
    await updateStatus();
  });

  async function loadSavedSettings() {
    const saved = await chrome.storage.local.get([
      'targetText',
      'alertMode',
      'alertRinging',
      'alertNotification',
      'intervalValue',
      'intervalUnit',
      'autoRefresh'
    ]);

    targetText.value = saved.targetText || '';

    if (saved.alertMode) {
      const modeInput = document.querySelector(`input[name="alertMode"][value="${saved.alertMode}"]`);
      if (modeInput) {
        modeInput.checked = true;
      }
    }

    alertRinging.checked = saved.alertRinging !== undefined ? saved.alertRinging : true;
    alertNotification.checked = saved.alertNotification !== undefined ? saved.alertNotification : true;
    intervalValue.value = saved.intervalValue || '10';
    intervalUnit.value = saved.intervalUnit || 'seconds';
    autoRefresh.checked = Boolean(saved.autoRefresh);
  }

  async function updateStatus() {
    const status = await chrome.runtime.sendMessage({ action: 'getStatus' });
    const isMonitoring = Boolean(status?.isMonitoring);
    const isAlarmSounding = Boolean(status?.alarmSounding);

    if (isAlarmSounding) {
      statusDot.className = 'status-dot alarm';
      stopAlarmBtn.style.display = 'block';
      startBtn.disabled = true;
      stopBtn.disabled = false;
      return;
    }

    if (isMonitoring) {
      statusDot.className = 'status-dot active';
      stopAlarmBtn.style.display = 'none';
      startBtn.disabled = true;
      stopBtn.disabled = false;
      return;
    }

    statusDot.className = 'status-dot';
    stopAlarmBtn.style.display = 'none';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }

  async function saveSettings() {
    await chrome.storage.local.set({
      targetText: targetText.value,
      alertMode: document.querySelector('input[name="alertMode"]:checked').value,
      alertRinging: alertRinging.checked,
      alertNotification: alertNotification.checked,
      intervalValue: intervalValue.value,
      intervalUnit: intervalUnit.value,
      autoRefresh: autoRefresh.checked
    });
  }

  function setFeedback(message, type) {
    feedback.textContent = message;
    feedback.className = `feedback ${type}`;
  }

  function clearFeedback() {
    feedback.textContent = '';
    feedback.className = 'feedback';
  }
});
