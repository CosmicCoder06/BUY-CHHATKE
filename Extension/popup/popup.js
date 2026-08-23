/**
 * buySmartly AI Assistant — Popup Hub Controller
 * Single Source of Truth & Strict Authentication State
 */

document.addEventListener('DOMContentLoaded', async () => {
  const activeTab = await getActiveTab();
  await initAuthState(activeTab);
  bindToggles();
});

async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch (e) {
    return null;
  }
}

async function initAuthState(tab) {
  const userStatusLbl = document.getElementById('sbaUserStatusLbl');
  const userEmailEl = document.getElementById('sbaUserEmail');
  const authActionBtn = document.getElementById('sbaAuthActionBtn');
  const logoutBtn = document.getElementById('sbaLogoutBtn');
  const activeStoreTxt = document.getElementById('sbaActiveStoreTxt');
  const launchWebBtn = document.getElementById('sbaLaunchWebBtn');
  const launchBtnText = document.getElementById('sbaLaunchBtnText');

  return new Promise((resolve) => {
    chrome.storage.local.get(['authToken', 'user', 'currentProduct'], (res) => {
      const isAuth = Boolean(res.authToken && res.user);
      const user = res.user;
      const product = res.currentProduct;
      const targetProductUrl = product?.productUrl || product?.url || tab?.url || '';
      const encodedUrl = encodeURIComponent(targetProductUrl);
      const dashboardUrl = () => {
        if (!targetProductUrl) return 'http://localhost:3000/dashboard';
        const p = new URLSearchParams({ product: targetProductUrl });
        if (Number(product?.currentPrice) > 0) {
          p.set('livePrice', product.currentPrice);
          p.set('liveTitle', product.productTitle || product.title || '');
          p.set('liveImage', product.productImage || product.image || '');
          p.set('liveMrp', product.originalPrice || '');
        }
        return `http://localhost:3000/dashboard?${p.toString()}`;
      };

      // Context detector text
      if (activeStoreTxt) {
        if (product && product.platform && (product.productTitle || product.title)) {
          const t = product.productTitle || product.title;
          const p = product.currentPrice || 0;
          activeStoreTxt.textContent = `🟢 ${product.platform}: ${t.slice(0, 24)}... (₹${Number(p).toLocaleString('en-IN')})`;
        } else if (tab?.url) {
          const urlLower = tab.url.toLowerCase();
          if (urlLower.includes('flipkart.com') && urlLower.includes('/p/')) activeStoreTxt.textContent = '🟢 Flipkart Product Active';
          else if ((urlLower.includes('amazon.in') || urlLower.includes('amazon.com')) && urlLower.includes('/dp/')) activeStoreTxt.textContent = '🟢 Amazon India Product Active';
          else if (urlLower.includes('myntra.com') && urlLower.includes('/buy')) activeStoreTxt.textContent = '🟢 Myntra Product Active';
          else if (urlLower.includes('meesho.com') && urlLower.includes('/p/')) activeStoreTxt.textContent = '🟢 Meesho Product Active';
          else if (urlLower.includes('ajio.com') && urlLower.includes('/p/')) activeStoreTxt.textContent = '🟢 Ajio Product Active';
          else activeStoreTxt.textContent = 'Ready on Flipkart, Amazon, Myntra, Meesho, Ajio';
        } else {
          activeStoreTxt.textContent = 'Ready on Flipkart, Amazon, Myntra, Meesho, Ajio';
        }
      }

      if (isAuth) {
        // ════════ AUTHENTICATED STATE ════════
        userStatusLbl.textContent = `Welcome, ${user.name || 'Shopper'} ⭐`;
        userEmailEl.textContent = 'buySmartly Analysis Ready';
        userEmailEl.classList.remove('is-locked');
        authActionBtn.textContent = 'Dashboard ↗';
        if (logoutBtn) logoutBtn.style.display = 'block';

        authActionBtn.onclick = () => {
          window.open(dashboardUrl(), '_blank');
        };

        if (logoutBtn) {
          logoutBtn.onclick = () => {
            chrome.storage.local.remove(['authToken', 'user', 'sba_user', 'sba_token'], () => {
              initAuthState(tab);
            });
          };
        }

        if (launchWebBtn) {
          launchBtnText.textContent = targetProductUrl ? 'Open buySmartly Dashboard' : 'Open buySmartly Dashboard';
          launchWebBtn.onclick = () => {
            window.open(dashboardUrl(), '_blank');
          };
        }
      } else {
        // ════════ STRICT LOCKED STATE ════════
        userStatusLbl.textContent = '🔒 Authentication Required';
        userEmailEl.textContent = 'Login to unlock buySmartly Intelligence';
        userEmailEl.classList.add('is-locked');
        authActionBtn.textContent = 'Login Now ↵';
        if (logoutBtn) logoutBtn.style.display = 'none';

        authActionBtn.onclick = () => {
          window.open(`http://localhost:3000/login?source=extension&redirect=${encodedUrl}`, '_blank');
        };

        if (launchWebBtn) {
          launchBtnText.textContent = 'Login Now to Unlock buySmartly';
          launchWebBtn.onclick = () => {
            window.open(`http://localhost:3000/login?source=extension&redirect=${encodedUrl}`, '_blank');
          };
        }
      }

      resolve();
    });
  });
}

function bindToggles() {
  const toggleIds = ['toggleHistory', 'toggleLookAlike', 'toggleAlerts', 'toggleFloatingDock', 'toggleFakeDetector'];
  toggleIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [id]: el.checked });
        }
      });
    }
  });
}
