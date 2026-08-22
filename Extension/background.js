// buySmarty Chrome Extension - Background Service Worker (Manifest V3)

const SUPPORTED_HOSTS = ['amazon.in', 'amazon.com', 'flipkart.com', 'myntra.com', 'meesho.com', 'ajio.com'];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'buysmarty-track-selection',
    title: '? Track "%s" on buySmarty',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'buysmarty-track-link',
    title: '? Analyze Deal Price on buySmarty',
    contexts: ['link']
  });

  chrome.contextMenus.create({
    id: 'buysmarty-open-dashboard',
    title: '? Open buySmarty Price Intelligence Dashboard',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let targetUrl = 'http://localhost:3000';

  if (info.menuItemId === 'buysmarty-track-selection' && info.selectionText) {
    targetUrl = `http://localhost:3000/?q=${encodeURIComponent(info.selectionText.trim())}`;
  } else if (info.menuItemId === 'buysmarty-track-link' && info.linkUrl) {
    targetUrl = `http://localhost:3000/?q=${encodeURIComponent(info.linkUrl.trim())}`;
  } else if (info.menuItemId === 'buysmarty-open-dashboard') {
    if (tab && tab.url) {
      targetUrl = `http://localhost:3000/?q=${encodeURIComponent(tab.url)}`;
    }
  }

  await chrome.tabs.create({ url: targetUrl });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const urlObj = new URL(tab.url);
      const isSupported = SUPPORTED_HOSTS.some(host => urlObj.hostname.includes(host));

      if (isSupported) {
        await chrome.action.setBadgeText({ tabId, text: '?' });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: '#6366f1' });
      } else {
        await chrome.action.setBadgeText({ tabId, text: '' });
      }
    } catch (e) {}
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_PRICE_INTELLIGENCE') {
    (async () => {
      try {
        const apiUrl = `http://localhost:3000/api/analyze?asin=${encodeURIComponent(message.url || message.query)}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('API status: ' + res.status);
        const data = await res.json();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
