# Auto Refresh Alert

[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome%20Extension-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-0F9D58)](https://developer.chrome.com/docs/extensions/mv3/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=111)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A  Chrome extension that monitors any open webpage for target text and triggers persistent alerts when a condition is matched.

## Highlights

- Reliable interval checks using `chrome.alarms` (MV3-friendly).
- Supports two trigger modes:
  - Alert when text is found
  - Alert when text is not found
- Supports alert channels:
  - Desktop notifications
  - Continuous ringing alarm (offscreen audio)
- Optional auto-refresh before each check.
- Persists monitoring state in local storage.
- Clean popup UI with accessible controls and real-time status indicator.

## Tech Stack

<p>
  <img alt="Chrome" src="https://cdn.simpleicons.org/googlechrome/4285F4" width="22" />
  <img alt="JavaScript" src="https://cdn.simpleicons.org/javascript/F7DF1E" width="22" />
  <img alt="HTML5" src="https://cdn.simpleicons.org/html5/E34F26" width="22" />
  <img alt="CSS3" src="https://cdn.simpleicons.org/css/1572B6" width="22" />
</p>

- Chrome Extensions Manifest V3
- JavaScript (Service Worker + UI logic)
- Offscreen document API for audio playback
- Chrome Storage, Alarms, Notifications, Scripting APIs

## Architecture

- `background.js`: core monitoring engine, schedule management, alert orchestration.
- `popup.html` + `popup.css` + `popup.js`: user configuration and runtime controls.
- `offscreen.html` + `offscreen.js`: persistent alarm sound playback and fallback beep generation.
- `manifest.json`: extension metadata, permissions, and entrypoints.

## Installation (Local)

1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the project folder (`auto-refresh-ring-chrome-extension`).

## Usage

1. Open the webpage you want to monitor.
2. Click the extension icon.
3. Enter target text.
4. Select trigger condition and alert channels.
5. Set interval + optional auto-refresh.
6. Click **Start monitoring**.
7. Click **Stop alarm** to acknowledge alerts, or **Stop** to end monitoring.

## Permissions

- `storage`: save settings and monitoring status.
- `alarms`: schedule recurring checks in MV3 service worker.
- `notifications`: show persistent desktop alerts.
- `scripting`: evaluate page text in the active tab.
- `offscreen`: play alarm audio from an offscreen document.
- `host_permissions: <all_urls>`: monitor user-selected pages.


## Roadmap

- Per-tab monitoring profiles.
- Match options (exact, regex, case-sensitive).
- Snooze and cooldown for repeating alerts.
- Chrome Web Store packaging + publishing workflow.

## License

MIT
