// Offscreen document for playing alarm sounds
const audio = document.getElementById('alarm');
let audioCtx = null;
let beepInterval = null;
let isPlaying = false;

// Listen for messages from background (check target field)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only respond to messages targeted at offscreen
  if (msg.target !== 'offscreen') return;
  
  if (msg.action === 'playAlarm') {
    playAlarm();
    sendResponse({ success: true });
  } else if (msg.action === 'stopAlarm') {
    stopAlarm();
    sendResponse({ success: true });
  }
  return true;
});

function playAlarm() {
  if (isPlaying) return;
  isPlaying = true;
  
  // Always use beeps for reliability (mp3 might not work)
  playBeeps();
}

function stopAlarm() {
  isPlaying = false;
  audio.pause();
  audio.currentTime = 0;
  if (beepInterval) {
    clearInterval(beepInterval);
    beepInterval = null;
  }
}

function playBeeps() {
  if (beepInterval) return;
  
  audioCtx = audioCtx || new AudioContext();
  
  function beep() {
    if (!isPlaying) {
      clearInterval(beepInterval);
      beepInterval = null;
      return;
    }
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  }
  
  beep();
  beepInterval = setInterval(beep, 1000);
}

console.log('Offscreen audio player ready');
