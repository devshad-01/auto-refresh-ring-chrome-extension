const audio = document.getElementById('alarm');
let isPlaying = false;
let beepIntervalId = null;
let fallbackAudioContext = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen') {
    return;
  }

  if (msg.action === 'playAlarm') {
    playAlarm();
    sendResponse({ success: true });
  }

  if (msg.action === 'stopAlarm') {
    stopAlarm();
    sendResponse({ success: true });
  }

  return true;
});

function playAlarm() {
  if (isPlaying) {
    return;
  }

  isPlaying = true;
  audio.src = chrome.runtime.getURL('alert.mp3');
  audio.loop = true;
  audio.volume = 1.0;

  audio.play().catch(() => {
    playBeeps();
  });
}

function stopAlarm() {
  isPlaying = false;
  audio.pause();
  audio.currentTime = 0;

  if (beepIntervalId) {
    clearInterval(beepIntervalId);
    beepIntervalId = null;
  }

  if (fallbackAudioContext?.state !== 'closed') {
    fallbackAudioContext?.close();
  }

  fallbackAudioContext = null;
}

function playBeeps() {
  if (beepIntervalId) {
    return;
  }

  if (!fallbackAudioContext || fallbackAudioContext.state === 'closed') {
    fallbackAudioContext = new AudioContext();
  }

  function beep() {
    if (!isPlaying) {
      clearInterval(beepIntervalId);
      beepIntervalId = null;
      return;
    }

    const osc = fallbackAudioContext.createOscillator();
    const gain = fallbackAudioContext.createGain();
    osc.connect(gain);
    gain.connect(fallbackAudioContext.destination);
    osc.frequency.value = 880;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.5, fallbackAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, fallbackAudioContext.currentTime + 0.35);
    osc.start();
    osc.stop(fallbackAudioContext.currentTime + 0.35);
  }

  beep();
  beepIntervalId = setInterval(beep, 1000);
}
