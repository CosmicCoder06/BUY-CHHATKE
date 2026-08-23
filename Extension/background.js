// buySmartly AI Assistant — Background Service Worker (Manifest V3)

const SUPPORTED_HOSTS = ['flipkart.com', 'amazon.in', 'amazon.com', 'myntra.com', 'meesho.com', 'ajio.com'];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'buysmartly-track-selection',
    title: '✦ Track "%s" on buySmartly',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'buysmartly-track-link',
    title: '✦ Analyze Deal Price on buySmartly',
    contexts: ['link']
  });

  chrome.contextMenus.create({
    id: 'buysmartly-open-dashboard',
    title: '✦ Open buySmartly Dashboard',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let targetUrl = 'http://localhost:3000/dashboard';

  if (info.menuItemId === 'buysmartly-track-selection' && info.selectionText) {
    targetUrl = `http://localhost:3000/dashboard?product=${encodeURIComponent(info.selectionText.trim())}`;
  } else if (info.menuItemId === 'buysmartly-track-link' && info.linkUrl) {
    targetUrl = `http://localhost:3000/dashboard?product=${encodeURIComponent(info.linkUrl.trim())}`;
  } else if (info.menuItemId === 'buysmartly-open-dashboard') {
    if (tab && tab.url) {
      targetUrl = `http://localhost:3000/dashboard?product=${encodeURIComponent(tab.url)}`;
    }
  }

  await chrome.tabs.create({ url: targetUrl });
});

// Update Badge on Supported Store Product Pages
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const urlObj = new URL(tab.url);
      const isSupported = SUPPORTED_HOSTS.some(host => urlObj.hostname.includes(host));

      if (isSupported) {
        await chrome.action.setBadgeText({ tabId, text: '✦' });
        await chrome.action.setBadgeBackgroundColor({ tabId, color: '#6366f1' });
      } else {
        await chrome.action.setBadgeText({ tabId, text: '' });
      }
    } catch (e) {}
  }
});

// Message Passing Bridge for Single Source of Truth
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SBA_SET_PRODUCT_CONTEXT' && message.product) {
    chrome.storage.local.set({ currentProduct: message.product }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'SBA_GET_PRODUCT_CONTEXT') {
    chrome.storage.local.get(['currentProduct', 'authToken', 'user'], (res) => {
      sendResponse({
        product: res.currentProduct || null,
        authToken: res.authToken || null,
        user: res.user || null
      });
    });
    return true;
  }

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
