/**
 * buySmartly — Website Authentication Sync Bridge
 * Safely synchronizes authentication state between buySmartly web app and Chrome extension.
 */

(function () {
  function isExtensionAlive() {
    try {
      return Boolean(typeof chrome !== 'undefined' && chrome?.runtime?.id && chrome?.storage?.local);
    } catch (e) {
      return false;
    }
  }

  function syncFromStorage() {
    if (!isExtensionAlive()) return;
    try {
      const storedToken = localStorage.getItem('authToken');
      const rawUser = localStorage.getItem('user') || localStorage.getItem('sba_user');

      if (storedToken && rawUser) {
        const user = JSON.parse(rawUser);
        chrome.storage.local.set({ authToken: storedToken, user: user }, () => {
          if (chrome.runtime?.lastError) {}
        });
      }
    } catch (e) {}
  }

  syncFromStorage();

  function onAuthMessage(e) {
    if (!isExtensionAlive()) {
      try { window.removeEventListener('message', onAuthMessage); } catch (_) {}
      return;
    }

    try {
      if (e.data && e.data.type === 'SBA_AUTH_SYNC') {
        if (e.data.authToken && e.data.user) {
          chrome.storage.local.set({
            authToken: e.data.authToken,
            user: e.data.user
          }, () => {
            if (chrome.runtime?.lastError) {}
          });
        } else {
          chrome.storage.local.remove(['authToken', 'user', 'sba_user', 'sba_token'], () => {
            if (chrome.runtime?.lastError) {}
          });
        }
      }
    } catch (err) {
      try { window.removeEventListener('message', onAuthMessage); } catch (_) {}
    }
  }

  window.addEventListener('message', onAuthMessage);
})();
