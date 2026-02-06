// Web Alert - Content Script
// Reads page content and checks for target text

console.log('Web Alert content script loaded');

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);

  if (message.action === 'checkForText') {
    const found = checkForText(message.targetText);
    
    // Send result back to background
    chrome.runtime.sendMessage({
      action: 'textCheckResult',
      found: found,
      tabId: null // Will be filled by background
    });

    sendResponse({ found: found });
  }

  return true;
});

// Check if target text exists in the page
function checkForText(targetText) {
  if (!targetText || targetText.trim() === '') {
    console.log('No target text specified');
    return false;
  }

  const searchText = targetText.toLowerCase().trim();

  // Method 1: Check entire document body text
  const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
  
  if (bodyText.includes(searchText)) {
    console.log('Text found in body innerText');
    return true;
  }

  // Method 2: Check all text nodes more thoroughly
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.toLowerCase().includes(searchText)) {
      console.log('Text found in text node:', node.textContent.substring(0, 100));
      return true;
    }
  }

  // Method 3: Check input values
  const inputs = document.querySelectorAll('input, textarea, select');
  for (const input of inputs) {
    if (input.value && input.value.toLowerCase().includes(searchText)) {
      console.log('Text found in input value');
      return true;
    }
  }

  // Method 4: Check shadow DOMs (for web components)
  const elementsWithShadow = document.querySelectorAll('*');
  for (const el of elementsWithShadow) {
    if (el.shadowRoot) {
      const shadowText = el.shadowRoot.textContent || '';
      if (shadowText.toLowerCase().includes(searchText)) {
        console.log('Text found in shadow DOM');
        return true;
      }
    }
  }

  console.log('Text not found on page');
  return false;
}

// Also expose for direct calls
window.webAlertCheckText = checkForText;
