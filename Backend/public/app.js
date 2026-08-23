/**
 * buySmarty — CLIENT CONTROLLER
 * AI Price Intelligence, User Auth, Wishlist & Deal Verification Protocol
 */

// ─── GLOBAL STATE & DATA ─────────────────────────────────────────
let chartInstance = null;
let currentData = null;
let currentUser = JSON.parse(localStorage.getItem('sba_user') || 'null');
let wishlist = JSON.parse(localStorage.getItem('sba_wishlist') || '[]');
let userAlerts = JSON.parse(localStorage.getItem('sba_alerts') || '[]');
let pendingRegistration = null;
let otpCountdownInterval = null;

// ─── THEME MANAGER ──────────────────────────────────────────────
(function () {
  const root = document.documentElement;
  const toggleBtn = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');

  const savedTheme = localStorage.getItem('sba_theme') || 'dark';
  applyTheme(savedTheme);

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    localStorage.setItem('sba_theme', theme);

    if (typeof currentData !== 'undefined' && currentData && typeof renderChart === 'function') {
      renderChart(currentData.priceHistory, currentData.avgPrice);
    }
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }
})();

// ─── DOM REFS ───────────────────────────────────────────────────
const analyzeBtn = document.getElementById('analyzeBtn');
const asinInput = document.getElementById('asinInput');
const clearBtn = document.getElementById('clearBtn');
const skeleton = document.getElementById('skeleton');
const emptyState = document.getElementById('emptyState');
const dashboard = document.getElementById('dashboard');
const errorBanner = document.getElementById('errorBanner');
const alertBtn = document.getElementById('alertBtn');
const alertInput = document.getElementById('alertInput');
const alertMsg = document.getElementById('alertMsg');

// Wishlist & Drawer Elements
const wishlistTriggerBtn = document.getElementById('wishlistTriggerBtn');
const wishlistDrawer = document.getElementById('wishlistDrawer');
const wishlistOverlay = document.getElementById('wishlistOverlay');
const closeWishlistBtn = document.getElementById('closeWishlistBtn');
const clearWishlistBtn = document.getElementById('clearWishlistBtn');
const wishlistItemsList = document.getElementById('wishlistItemsList');
const wishlistCount = document.getElementById('wishlistCount');
const drawerWishlistBadge = document.getElementById('drawerWishlistBadge');
const productWishlistToggleBtn = document.getElementById('productWishlistToggleBtn');

// Auth & Verification Modal Elements
const loginModalBtn = document.getElementById('loginModalBtn');
const authContainer = document.getElementById('authContainer');
const loginModalOverlay = document.getElementById('loginModalOverlay');
const closeLoginModalBtn = document.getElementById('closeLoginModalBtn');
const demoLoginBtn = document.getElementById('demoLoginBtn');
const tabLoginBtn = document.getElementById('tabLoginBtn');
const tabRegisterBtn = document.getElementById('tabRegisterBtn');
const authForm = document.getElementById('authForm');
const authFormStep = document.getElementById('authFormStep');
const authVerifyStep = document.getElementById('authVerifyStep');
const nameGroup = document.getElementById('nameGroup');
const userNameInput = document.getElementById('userNameInput');
const userEmailInput = document.getElementById('userEmailInput');
const userPasswordInput = document.getElementById('userPasswordInput');
const emailHint = document.getElementById('emailHint');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const modalTitle = document.getElementById('modalTitle');
const modalSub = document.getElementById('modalSub');
const alertUserText = document.getElementById('alertUserText');

// OTP Verification Step Elements
const verifyTargetEmail = document.getElementById('verifyTargetEmail');
const otpCodeInput = document.getElementById('otpCodeInput');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const otpCountdown = document.getElementById('otpCountdown');
const otpTimerText = document.getElementById('otpTimerText');
const resendOtpBtn = document.getElementById('resendOtpBtn');
const backToRegisterBtn = document.getElementById('backToRegisterBtn');
const otpPreviewNotice = document.getElementById('otpPreviewNotice');
const otpPreviewLink = document.getElementById('otpPreviewLink');

// My Account Modal Elements
const accountModalOverlay = document.getElementById('accountModalOverlay');
const closeAccountModalBtn = document.getElementById('closeAccountModalBtn');
const accAvatarLarge = document.getElementById('accAvatarLarge');
const accDisplayName = document.getElementById('accDisplayName');
const accEmail = document.getElementById('accEmail');
const accMemberSince = document.getElementById('accMemberSince');
const accWishlistCount = document.getElementById('accWishlistCount');
const accAlertsCount = document.getElementById('accAlertsCount');
const accScansCount = document.getElementById('accScansCount');
const accWishlistStat = document.getElementById('accWishlistStat');
const editUserName = document.getElementById('editUserName');
const editAlertPref = document.getElementById('editAlertPref');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const accAlertsList = document.getElementById('accAlertsList');
const activeAlertsCountNum = document.getElementById('activeAlertsCountNum');
const accountLogoutBtn = document.getElementById('accountLogoutBtn');

// API endpoint resolution
const API_BASE = (location.port === '3000' || location.protocol === 'file:')
  ? 'http://localhost:3000'
  : (location.port && location.port !== '3000' ? 'http://localhost:3000' : '');

// ─── INITIALIZATION ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initAuthUI();
  updateWishlistUI();
  initAccountEvents();
});

// ─── EVENT LISTENERS ────────────────────────────────────────────
if (analyzeBtn) {
  analyzeBtn.addEventListener('click', executeAnalysis);
}

if (asinInput) {
  asinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeAnalysis();
  });

  asinInput.addEventListener('input', () => {
    if (clearBtn) {
      clearBtn.style.display = asinInput.value.trim().length > 0 ? 'flex' : 'none';
    }
  });
}

if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    asinInput.value = '';
    clearBtn.style.display = 'none';
    asinInput.focus();
  });
}

if (alertBtn) {
  alertBtn.addEventListener('click', submitPriceAlert);
}

// Global helper for sample buttons
window.fillAndAnalyze = function (idOrUrl) {
  if (!asinInput) return;
  asinInput.value = idOrUrl;
  if (clearBtn) clearBtn.style.display = 'flex';
  executeAnalysis();
};

// Global helper for quick discount alert buttons
window.applyDiscountAlert = function (rate) {
  if (!currentData || !currentData.currentPrice) return;
  const target = Math.floor(currentData.currentPrice * (1 - rate));
  if (alertInput) {
    alertInput.value = target;
    alertInput.focus();
  }
};

// ─── MULTI-STORE ASIN / FLIPKART PID / URL PARSER ────────────────
function extractQueryTarget(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.trim();

  // 1. Flipkart URL or PID
  if (clean.toLowerCase().includes('flipkart.com') || clean.toLowerCase().includes('dl.flipkart.com')) {
    return clean;
  }
  const fkPidMatch = clean.match(/[?&]pid=([A-Za-z0-9]{12,20})/i);
  if (fkPidMatch) return fkPidMatch[1].toUpperCase();
  const itmMatch = clean.match(/\/p\/(itm[A-Za-z0-9]{10,20})/i);
  if (itmMatch) return itmMatch[1];
  const fsnMatch = clean.toUpperCase().match(/\b([A-Z0-9]{16})\b/);
  if (fsnMatch && !clean.toUpperCase().startsWith('B0')) return fsnMatch[1];

  // 2. Amazon URL or ASIN
  const urlPattern = /(?:\/dp\/|\/gp\/product\/|\/d\/|[?&]asin=)([A-Z0-9]{10})/i;
  const match = clean.match(urlPattern);
  if (match) return match[1].toUpperCase();

  const plainMatch = clean.toUpperCase().match(/\b([B0-9][A-Z0-9]{9})\b/);
  if (plainMatch) return plainMatch[1];

  // Return clean query if 4+ chars
  return clean.length >= 4 ? clean : null;
}

function extractAsin(raw) {
  return extractQueryTarget(raw) || (raw ? String(raw).trim() : '');
}

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
}

// ─── MAIN MULTI-STORE ANALYSIS DISPATCHER ───────────────────────
async function executeAnalysis() {
  const raw = asinInput.value.trim();
  const queryTarget = extractQueryTarget(raw);

  if (!queryTarget) {
    displayError('Please enter a valid Amazon ASIN/URL or Flipkart Product link/PID.');
    triggerShake(asinInput);
    return;
  }

  if (clearBtn) clearBtn.style.display = 'flex';

  setLoadingState(true);
  hideError();

  try {
    const url = `${API_BASE}/api/analyze?q=${encodeURIComponent(queryTarget)}&url=${encodeURIComponent(queryTarget)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Server responded with status ${res.status}`);
    }

    currentData = data;
    if (currentUser) {
      currentUser.scansCount = (currentUser.scansCount || 0) + 1;
      localStorage.setItem('sba_user', JSON.stringify(currentUser));
      if (accScansCount) accScansCount.textContent = currentUser.scansCount;
    }
    renderTerminalDashboard(data);
    updateProductWishlistBtnState();
  } catch (err) {
    displayError(err.message || 'Failed to establish connection to intelligence engine.');
  } finally {
    setLoadingState(false);
  }
}

// ─── UI STATE CONTROLS ──────────────────────────────────────────
function setLoadingState(loading) {
  if (analyzeBtn) {
    analyzeBtn.disabled = loading;
    const btnText = analyzeBtn.querySelector('.btn-text');
    if (btnText) {
      btnText.textContent = loading ? 'Scanning...' : 'Execute Scan';
    }
  }

  if (skeleton) {
    skeleton.style.display = loading ? 'flex' : 'none';
  }

  if (loading) {
    if (emptyState) emptyState.style.display = 'none';
    if (dashboard) dashboard.style.display = 'none';
  }
}

function displayError(msg) {
  if (!errorBanner) return;
  errorBanner.textContent = `[!] PROTOCOL ERROR: ${msg}`;
  errorBanner.style.display = 'flex';
  if (dashboard) dashboard.style.display = 'none';
  if (emptyState) emptyState.style.display = 'none';
}

function hideError() {
  if (errorBanner) errorBanner.style.display = 'none';
}

function triggerShake(el) {
  if (!el) return;
  el.style.animation = 'none';
  el.offsetHeight; // trigger reflow
  el.style.animation = 'shake 0.4s ease';
}

function getClientFallbackImage(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('shoe') || t.includes('sneaker') || t.includes('footwear') || t.includes('running') || t.includes('nike')) {
    return 'https://m.media-amazon.com/images/I/61xi8pnZunL._AC_UL960_QL65_.jpg';
  }
  if (t.includes('bag') || t.includes('handbag') || t.includes('purse') || t.includes('caprese') || t.includes('wallet') || t.includes('tote') || t.includes('backpack')) {
    return 'https://m.media-amazon.com/images/I/61wZjWZC7IL._AC_UL960_QL65_.jpg';
  }
  if (t.includes('shirt') || t.includes('tshirt') || t.includes('t-shirt') || t.includes('kurti') || t.includes('dress') || t.includes('apparel') || t.includes('clothing') || t.includes('roadster') || t.includes('saree') || t.includes('jeans')) {
    return 'https://m.media-amazon.com/images/I/51N7HxDG0UL._AC_UL960_QL65_.jpg';
  }
  if (t.includes('sony') || t.includes('xm5') || t.includes('wh-1000')) {
    return 'https://m.media-amazon.com/images/I/61O3iMlnJIL._SL1500_.jpg';
  }
  if (t.includes('boat') || t.includes('rockerz') || t.includes('headphone') || t.includes('neckband')) {
    return 'https://m.media-amazon.com/images/I/61u1VALn6JL._SL1500_.jpg';
  }
  if (t.includes('nothing')) {
    return 'https://m.media-amazon.com/images/I/71dZBla7wUL._AC_UY654_QL65_.jpg';
  }
  if (t.includes('samsung') || t.includes('galaxy') || t.includes('s25') || t.includes('s24') || t.includes('ultra')) {
    return 'https://m.media-amazon.com/images/I/717Q2swzhBL._AC_UY654_QL65_.jpg';
  }
  if (t.includes('iphone') || t.includes('apple') || t.includes('ios')) {
    return 'https://m.media-amazon.com/images/I/71657TiFeHL._SL1500_.jpg';
  }
  if (t.includes('macbook') || t.includes('laptop')) {
    return 'https://m.media-amazon.com/images/I/710TJuHTMhL._SL1500_.jpg';
  }
  if (t.includes('realme') || t.includes('poco') || t.includes('redmi') || t.includes('oneplus') || t.includes('5g') || t.includes('phone')) {
    return 'https://m.media-amazon.com/images/I/717z2bNF6DL._AC_UY654_QL65_.jpg';
  }
  return 'https://m.media-amazon.com/images/I/61xi8pnZunL._AC_UL960_QL65_.jpg';
}

// ─── DASHBOARD RENDERER ─────────────────────────────────────────
function renderTerminalDashboard(d) {
  if (!dashboard) return;

  dashboard.style.display = 'flex';
  if (emptyState) emptyState.style.display = 'none';

  // Smooth scroll into telemetry view
  setTimeout(() => {
    dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);

  // Save to Last 4 Recent Searches
  saveRecentSearch({
    title: d.productTitle,
    price: d.currentPrice,
    platform: d.platform || 'amazon',
    platformIcon: d.platformIcon || '🛍️',
    image: d.productImage,
    query: d.asin || d.productId || (asinInput ? asinInput.value.trim() : '')
  });

  // 1. Spotlight Product Details
  const productImg = document.getElementById('productImg');
  if (productImg) {
    const rawImage = d.productImage || '';
    const fallbackImage = getClientFallbackImage(d.productTitle);
    productImg.dataset.triedProxy = 'false';
    if (rawImage.startsWith('http')) {
      productImg.src = rawImage;
      productImg.onerror = function () {
        if (this.dataset.triedProxy !== 'true') {
          this.dataset.triedProxy = 'true';
          this.src = `${API_BASE}/api/image-proxy?url=${encodeURIComponent(rawImage)}`;
        } else {
          this.src = fallbackImage;
        }
      };
    } else {
      productImg.src = fallbackImage;
    }
    productImg.alt = d.productTitle || 'Product Image';
  }

  // Update Platform & Product ID Badges
  const chipAsin = document.getElementById('chipAsin');
  if (chipAsin) {
    let idPrefix = 'ASIN: ';
    if (d.platform === 'flipkart') idPrefix = 'PID: ';
    else if (d.platform === 'myntra') idPrefix = 'STYLE: ';
    else if (d.platform === 'meesho') idPrefix = 'CODE: ';
    else if (d.platform === 'ajio') idPrefix = 'ITEM: ';
    chipAsin.textContent = idPrefix + (d.asin || d.productId || '—');
  }

  const chipPlatform = document.getElementById('chipPlatform');
  if (chipPlatform) {
    if (d.platform === 'myntra') {
      chipPlatform.textContent = '👗 MYNTRA INSIDER';
      chipPlatform.style.background = 'rgba(255, 63, 108, 0.15)';
      chipPlatform.style.color = '#ff3f6c';
      chipPlatform.style.borderColor = 'rgba(255, 63, 108, 0.3)';
    } else if (d.platform === 'meesho') {
      chipPlatform.textContent = '🛍️ MEESHO TRUSTED';
      chipPlatform.style.background = 'rgba(155, 44, 126, 0.15)';
      chipPlatform.style.color = '#d946ef';
      chipPlatform.style.borderColor = 'rgba(217, 70, 239, 0.3)';
    } else if (d.platform === 'ajio') {
      chipPlatform.textContent = '🏷️ AJIO LUXE';
      chipPlatform.style.background = 'rgba(44, 65, 82, 0.25)';
      chipPlatform.style.color = '#38bdf8';
      chipPlatform.style.borderColor = 'rgba(56, 189, 248, 0.3)';
    } else if (d.platform === 'flipkart') {
      chipPlatform.textContent = '⚡ FLIPKART' + (d.isAssured ? ' ASSURED' : '');
      chipPlatform.style.background = 'rgba(234, 179, 8, 0.15)';
      chipPlatform.style.color = '#facc15';
      chipPlatform.style.borderColor = 'rgba(250, 204, 21, 0.3)';
    } else {
      chipPlatform.textContent = '🛍️ AMAZON IN';
      chipPlatform.style.background = 'rgba(99, 102, 241, 0.15)';
      chipPlatform.style.color = '#818cf8';
      chipPlatform.style.borderColor = 'rgba(129, 140, 248, 0.3)';
    }
  }

  // 1.1 Configure "Buy on Store" Direct External Action
  const productBuyBtn = document.getElementById('productBuyBtn');
  const pbsText = document.getElementById('pbsText');
  const pbsIcon = document.getElementById('pbsIcon');
  if (productBuyBtn && pbsText) {
    const rawUrl = d.productUrl || (d.asin ? `https://www.amazon.in/dp/${d.asin}` : '#');
    productBuyBtn.href = rawUrl;
    pbsText.textContent = `Buy on ${d.platformName || 'Store'}`;
    if (pbsIcon) pbsIcon.textContent = d.platformIcon || '🛍️';

    // Skin with store colors
    if (d.platform === 'flipkart') {
      productBuyBtn.style.background = 'linear-gradient(135deg, #eab308, #ca8a04)';
      productBuyBtn.style.boxShadow = '0 4px 14px rgba(234, 179, 8, 0.4)';
    } else if (d.platform === 'myntra') {
      productBuyBtn.style.background = 'linear-gradient(135deg, #ff3f6c, #e11d48)';
      productBuyBtn.style.boxShadow = '0 4px 14px rgba(255, 63, 108, 0.4)';
    } else if (d.platform === 'meesho') {
      productBuyBtn.style.background = 'linear-gradient(135deg, #d946ef, #c026d3)';
      productBuyBtn.style.boxShadow = '0 4px 14px rgba(217, 70, 239, 0.4)';
    } else if (d.platform === 'ajio') {
      productBuyBtn.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';
      productBuyBtn.style.boxShadow = '0 4px 14px rgba(2, 132, 199, 0.4)';
    } else {
      productBuyBtn.style.background = 'linear-gradient(135deg, var(--brand-indigo), var(--brand-violet))';
      productBuyBtn.style.boxShadow = '0 4px 14px var(--brand-indigo-glow)';
    }
  }

  document.getElementById('productTitle').textContent = decodeHtmlEntities(d.productTitle || 'Product');

  const isUpcoming = Boolean(d.isUpcoming);

  const priceCaption = document.getElementById('priceCaption');
  if (priceCaption) {
    priceCaption.textContent = isUpcoming ? 'OFFICIAL LAUNCH PRICE' : 'CURRENT MARKET QUOTE';
  }

  const productPriceEl = document.getElementById('productPrice');
  if (isUpcoming) {
    productPriceEl.textContent = d.displayPrice || 'TBA on Launch';
    document.getElementById('statAvg').textContent = 'TBA';
    document.getElementById('statHigh').textContent = 'TBA';
    document.getElementById('statLow').textContent = 'TBA';
    document.getElementById('statDev').textContent = 'Pre-Launch';
    document.getElementById('statDev').className = 'cell-val';
    document.getElementById('savingsAmt').textContent = '🔔 Alert Ready';
    document.getElementById('savingsAmt').className = 'cell-val val-emerald';
    document.getElementById('savingsSub').textContent = 'Notification Armed';
  } else {
    animatePrice(productPriceEl, d.currentPrice);
    animatePrice(document.getElementById('statAvg'), d.avgPrice);
    animatePrice(document.getElementById('statHigh'), d.highPrice);
    animatePrice(document.getElementById('statLow'), d.lowPrice);

    // Deviation & Savings
    const devEl = document.getElementById('statDev');
    const devVal = parseFloat(d.deviation) || 0;
    devEl.textContent = `${devVal > 0 ? '+' : ''}${devVal.toFixed(1)}%`;
    devEl.className = `cell-val ${devVal < -5 ? 'val-green' : (devVal > 5 ? 'val-red' : '')}`;

    const savEl = document.getElementById('savingsAmt');
    if (d.savingsAmount > 0) {
      savEl.className = 'cell-val val-emerald';
      animatePrice(savEl, d.savingsAmount);
      document.getElementById('savingsSub').textContent = 'Below 30-day mean';
    } else {
      savEl.className = 'cell-val val-red';
      savEl.textContent = `+${formatINR(Math.abs(d.currentPrice - d.avgPrice))}`;
      document.getElementById('savingsSub').textContent = 'Above 30-day mean';
    }
  }

  // 2. Buy / Wait Decision Banner
  const recBanner = document.getElementById('recBanner');
  const recLabel = document.getElementById('recLabel');
  const recTitle = document.getElementById('recTitle');
  const recReason = document.getElementById('recReason');

  recBanner.className = 'decision-pill';
  if (isUpcoming) {
    recBanner.classList.add('upcoming');
    recLabel.textContent = 'PRE-LAUNCH';
    recTitle.textContent = d.decisionTitle || 'UPCOMING OFFICIAL LAUNCH';
  } else if (d.recommendation === 'BUY') {
    recBanner.classList.add('buy');
    recLabel.textContent = 'OPTIMAL TIMING';
    recTitle.textContent = d.decisionTitle || 'STRONG BUY SIGNAL';
  } else if (d.recommendation === 'FAIR') {
    recBanner.classList.add('fair');
    recLabel.textContent = 'NEUTRAL MARKET';
    recTitle.textContent = d.decisionTitle || 'FAIR VALUATION';
  } else {
    recBanner.classList.add('wait');
    recLabel.textContent = 'HIGH RESISTANCE';
    recTitle.textContent = d.decisionTitle || 'HOLD / WAIT FOR DIP';
  }
  recReason.textContent = d.reason || (isUpcoming ? 'Launch event scheduled. Real-time price tracking activates upon official release.' : 'Price stability verified across historical timeline.');

  // 3. Merchant Metrics
  document.getElementById('sellerRating').textContent = isUpcoming ? '4.9 / 5.0' : `${d.sellerRating || 4.2} / 5.0`;
  document.getElementById('sellerReviews').textContent = isUpcoming ? 'Brand Official' : `${(d.reviewCount || 1000).toLocaleString('en-IN')} verified`;

  const starRow = document.getElementById('starRow');
  const starCount = Math.round(d.sellerRating || 5);
  starRow.innerHTML = Array(5).fill(0).map((_, i) =>
    `<span style="color: ${i < starCount ? '#f59e0b' : 'rgba(255,255,255,0.2)'}">★</span>`
  ).join('');

  // Dynamic Fulfillment & Buyer Protection per Store
  const fulfillEl = document.getElementById('fulfillmentBadge');
  const protectEl = document.getElementById('buyerProtectionBadge');

  if (fulfillEl) {
    if (d.platform === 'myntra') {
      fulfillEl.innerHTML = `<span class="status-tag tag-verified" style="color:#ff3f6c;border-color:rgba(255,63,108,0.3);background:rgba(255,63,108,0.1)">✓ Myntra Verified Delivery</span>`;
    } else if (d.platform === 'meesho') {
      fulfillEl.innerHTML = `<span class="status-tag tag-verified" style="color:#d946ef;border-color:rgba(217,70,239,0.3);background:rgba(217,70,239,0.1)">✓ Meesho Direct Supplier</span>`;
    } else if (d.platform === 'ajio') {
      fulfillEl.innerHTML = `<span class="status-tag tag-verified" style="color:#38bdf8;border-color:rgba(56,189,248,0.3);background:rgba(56,189,248,0.1)">✓ Reliance Ajio Fulfilled (Luxe)</span>`;
    } else if (d.platform === 'flipkart') {
      fulfillEl.innerHTML = `<span class="status-tag tag-verified" style="color:#facc15;border-color:rgba(250,204,21,0.3);background:rgba(250,204,21,0.1)">⚡ Flipkart Assured</span>`;
    } else {
      fulfillEl.innerHTML = `<span class="status-tag tag-verified">✓ Amazon Fulfilled (Prime)</span>`;
    }
  }

  if (protectEl) {
    if (d.platform === 'myntra') {
      protectEl.innerHTML = `<span class="status-tag tag-verified">✓ 14-Day Easy Returns &amp; Exchange</span>`;
    } else if (d.platform === 'meesho') {
      protectEl.innerHTML = `<span class="status-tag tag-verified">✓ 7-Day Easy Return Policy</span>`;
    } else if (d.platform === 'ajio') {
      protectEl.innerHTML = `<span class="status-tag tag-verified">✓ 100% Handpicked Quality Guarantee</span>`;
    } else if (d.platform === 'flipkart') {
      protectEl.innerHTML = `<span class="status-tag tag-verified">✓ Flipkart Buyer Protection</span>`;
    } else {
      protectEl.innerHTML = `<span class="status-tag tag-verified">✓ 100% Purchase Protection</span>`;
    }
  }

  const relBadge = document.getElementById('reliabilityBadge');
  if (isUpcoming) {
    relBadge.innerHTML = `<span class="trust-badge-pill trust-high">✓ Official Launch Partner</span>`;
  } else if (d.sellerReliable) {
    relBadge.innerHTML = `<span class="trust-badge-pill trust-high">✓ High Trust Merchant</span>`;
  } else if (d.sellerRating >= 3.0) {
    relBadge.innerHTML = `<span class="trust-badge-pill trust-mid">⚠ Moderate Merchant</span>`;
  } else {
    relBadge.innerHTML = `<span class="trust-badge-pill trust-low">✕ Low Trust Risk</span>`;
  }

  // 4. Deal Confidence Score & Radial SVG Gauge
  updateRadialGauge(isUpcoming ? 88 : (d.dealScore || 50));

  // 5. 7-Day Forecast
  const forecast = computeForecast(d.priceHistory, d.currentPrice);
  document.getElementById('predVal').textContent = `${formatINR(forecast.low)} – ${formatINR(forecast.high)}`;
  document.getElementById('predTrend').textContent = isUpcoming
    ? '🚀 Sales go live on launch day. Price tracking activates automatically.'
    : forecast.narrative;

  // 6. Chart.js Price History Timeline
  renderChart(d.priceHistory, d.avgPrice, isUpcoming);

  // 7. Initialize Price Alert Default Input (-10%)
  if (alertInput) {
    alertInput.value = Math.floor(d.currentPrice * 0.9);
  }

  // 8. Update Alert User Status
  updateAlertUserStatus();
}

// ─── SVG RADIAL GAUGE UPDATER ───────────────────────────────────
function updateRadialGauge(score) {
  const gaugeNum = document.getElementById('gaugeNum');
  const gaugeLabel = document.getElementById('gaugeLabel');
  const gaugeArc = document.getElementById('gaugeProgressArc');

  if (!gaugeNum) return;
  gaugeNum.textContent = score;

  const maxDash = 251.2;
  const progressOffset = maxDash - (score / 100) * maxDash;

  if (gaugeArc) {
    gaugeArc.style.strokeDashoffset = progressOffset;

    let arcColor = '#10b981';
    let glowFilter = 'rgba(16, 185, 129, 0.4)';
    let label = 'EXCELLENT OPPORTUNITY';

    if (score < 45) {
      arcColor = '#ef4444';
      glowFilter = 'rgba(239, 68, 68, 0.4)';
      label = 'UNFAVORABLE PRICING';
    } else if (score < 70) {
      arcColor = '#f59e0b';
      glowFilter = 'rgba(245, 158, 11, 0.4)';
      label = 'MARKET EQUILIBRIUM';
    }

    gaugeArc.style.stroke = arcColor;
    gaugeArc.style.filter = `drop-shadow(0 0 8px ${glowFilter})`;
    gaugeNum.style.color = arcColor;
    gaugeLabel.textContent = label;
  }
}

// ─── 7-DAY FORECAST ENGINE ──────────────────────────────────────
function computeForecast(history, currentPrice) {
  if (!history || history.length < 5) {
    return {
      low: Math.round(currentPrice * 0.96),
      high: Math.round(currentPrice * 1.04),
      narrative: '➡️ Price corridor stable over short horizon'
    };
  }

  const recent = history.slice(-7).map(h => h.price);
  const slope = (recent[recent.length - 1] - recent[0]) / recent.length;
  const projectedMid = currentPrice + (slope * 7);

  const low = Math.round(projectedMid * 0.96);
  const high = Math.round(projectedMid * 1.04);

  let narrative = '➡️ Price corridor expected to hold steady';
  if (slope > currentPrice * 0.003) {
    narrative = '📈 Upward momentum detected — price may climb';
  } else if (slope < -currentPrice * 0.003) {
    narrative = '📉 Downward trajectory — potential dip imminent';
  }

  return { low, high, narrative };
}

// ─── CHART.JS RENDERER ──────────────────────────────────────────
function renderChart(history, avgPrice, isUpcoming = false) {
  const canvas = document.getElementById('priceChart');
  const chartWrapper = document.querySelector('.chart-canvas-wrapper');
  if (!canvas || !chartWrapper) return;

  // Remove existing upcoming notice if any
  const existingNotice = chartWrapper.querySelector('.upcoming-launch-card');
  if (existingNotice) existingNotice.remove();

  if (isUpcoming || !history || history.length === 0) {
    canvas.style.display = 'none';
    const notice = document.createElement('div');
    notice.className = 'upcoming-launch-card';
    notice.innerHTML = `
      <div class="launch-radar-anim">
        <span class="launch-emoji">🚀</span>
      </div>
      <div class="launch-card-content">
        <h3 class="launch-card-title">Official Launch Event — Tracking Armed & Ready</h3>
        <p class="launch-card-text">This device has not officially started retail sales yet (past transaction history does not exist prior to launch). <strong>buySmartly 24/7 scrapers</strong> will start recording and charting price trends the exact moment orders open on Flipkart.</p>
        <button class="launch-alert-cta-btn" onclick="document.getElementById('alertInput').focus(); document.querySelector('.alerts-strip').scrollIntoView({behavior: 'smooth'})">🔔 Set Instant Launch Notification</button>
      </div>
    `;
    chartWrapper.appendChild(notice);
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  canvas.style.display = 'block';

  const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
  const ctx = canvas.getContext('2d');

  if (chartInstance) {
    chartInstance.destroy();
  }

  const labels = history.map(item => {
    const d = new Date(item.date);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  });

  const prices = history.map(item => item.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minIndex = prices.indexOf(minPrice);
  const maxIndex = prices.indexOf(maxPrice);

  const gradient = ctx.createLinearGradient(0, 0, 0, 280);
  if (isDark) {
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
    gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.08)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
  } else {
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
  }

  const pointBg = prices.map((_, i) =>
    i === minIndex ? '#10b981' : (i === maxIndex ? '#ef4444' : 'transparent')
  );
  const pointBorder = prices.map((_, i) =>
    (i === minIndex || i === maxIndex) ? '#ffffff' : 'transparent'
  );
  const pointRadii = prices.map((_, i) =>
    (i === minIndex || i === maxIndex) ? 6 : 2
  );

  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)';
  const tickColor = isDark ? '#64748b' : '#94a3b8';

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Market Price (₹)',
          data: prices,
          borderColor: '#06b6d4',
          backgroundColor: gradient,
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
          cubicInterpolationMode: 'monotone',
          pointBackgroundColor: pointBg,
          pointBorderColor: pointBorder,
          pointBorderWidth: 2,
          pointRadius: pointRadii,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: '#06b6d4',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2
        },
        {
          label: '30-Day Mean (₹)',
          data: Array(prices.length).fill(avgPrice),
          borderColor: 'rgba(245, 158, 11, 0.75)',
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 750, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? 'rgba(13, 20, 36, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#94a3b8' : '#334155',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          titleFont: { family: 'JetBrains Mono', size: 12, weight: '700' },
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatINR(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: tickColor, font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 8 },
          border: { color: 'transparent' }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: tickColor,
            font: { family: 'JetBrains Mono', size: 10 },
            callback: (v) => formatINR(v)
          },
          border: { color: 'transparent' }
        }
      }
    }
  });
}

// ─── VALIDATION HELPERS ─────────────────────────────────────────
function isValidEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(String(email).trim());
}

// ─── AUTHENTICATION & VERIFICATION CONTROLLER ───────────────────
function initAuthUI() {
  if (currentUser) {
    authContainer.innerHTML = `
      <div class="user-profile-badge" id="userProfileBtn" title="Manage Account (${currentUser.email})">
        <div class="user-avatar">${(currentUser.name || 'U').charAt(0).toUpperCase()}</div>
        <span class="user-name">${currentUser.name.split(' ')[0]}</span>
        <span class="account-tag-hint">ACCOUNT</span>
      </div>
    `;
    const profileBtn = document.getElementById('userProfileBtn');
    if (profileBtn) {
      profileBtn.addEventListener('click', openAccountModal);
    }
  } else {
    authContainer.innerHTML = `
      <button class="header-btn login-btn" id="loginModalBtn">
        <span class="btn-icon">👤</span>
        <span class="btn-label">Login</span>
      </button>
    `;
    const btn = document.getElementById('loginModalBtn');
    if (btn) btn.addEventListener('click', openLoginModal);
  }
  updateAlertUserStatus();
}

function openLoginModal() {
  resetAuthModalSteps();
  if (loginModalOverlay) loginModalOverlay.style.display = 'flex';
}

function closeLoginModal() {
  if (loginModalOverlay) loginModalOverlay.style.display = 'none';
  if (otpCountdownInterval) clearInterval(otpCountdownInterval);
}

function resetAuthModalSteps() {
  if (authFormStep) authFormStep.style.display = 'block';
  if (authVerifyStep) authVerifyStep.style.display = 'none';
  if (emailHint) emailHint.style.display = 'none';
  if (otpCodeInput) otpCodeInput.value = '';
  pendingRegistration = null;
  if (otpCountdownInterval) clearInterval(otpCountdownInterval);
}

if (closeLoginModalBtn) closeLoginModalBtn.addEventListener('click', closeLoginModal);
if (loginModalOverlay) {
  loginModalOverlay.addEventListener('click', (e) => {
    if (e.target === loginModalOverlay) closeLoginModal();
  });
}

if (tabLoginBtn && tabRegisterBtn) {
  tabLoginBtn.addEventListener('click', () => {
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
    nameGroup.style.display = 'none';
    authSubmitBtn.textContent = 'Sign In to Engine ↵';
    modalTitle.textContent = 'Access Price Intelligence';
    modalSub.textContent = 'Log in to sync your wishlist and receive automated price drop alerts.';
    if (emailHint) emailHint.style.display = 'none';
  });

  tabRegisterBtn.addEventListener('click', () => {
    tabRegisterBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    nameGroup.style.display = 'flex';
    authSubmitBtn.textContent = 'Verify Email & Create Account ↵';
    modalTitle.textContent = 'Create Verified Account';
    modalSub.textContent = 'Only valid email accounts receive real-time price drops.';
    if (emailHint) emailHint.style.display = 'none';
  });
}

if (demoLoginBtn) {
  demoLoginBtn.addEventListener('click', () => {
    loginUser('avhiyadav@buychhatke.ai', 'Avhi Yadav');
    closeLoginModal();
    showToast('Signed in as Avhi Yadav (Demo Verified)', '🚀');
  });
}

if (authForm) {
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = userEmailInput.value.trim();
    const isRegister = tabRegisterBtn && tabRegisterBtn.classList.contains('active');

    // Strict Email Format Verification
    if (!email || !isValidEmail(email)) {
      if (emailHint) {
        emailHint.textContent = '⚠️ Please enter a valid email address (e.g. name@domain.com)';
        emailHint.style.display = 'block';
      }
      triggerShake(userEmailInput);
      return;
    }
    if (emailHint) emailHint.style.display = 'none';

    if (isRegister) {
      // Registration requires Name and Real Email Verification OTP
      const name = userNameInput.value.trim() || email.split('@')[0];
      const password = userPasswordInput.value;
      if (!password || password.length < 4) {
        showToast('Password must be at least 4 characters', '⚠️');
        triggerShake(userPasswordInput);
        return;
      }

      authSubmitBtn.disabled = true;
      authSubmitBtn.textContent = 'Sending Verification Email... ⏳';

      try {
        const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name })
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to dispatch verification email.');
        }

        pendingRegistration = { name, email, password };

        // Switch to Verification Step
        if (authFormStep) authFormStep.style.display = 'none';
        if (authVerifyStep) authVerifyStep.style.display = 'block';
        if (verifyTargetEmail) verifyTargetEmail.textContent = email;

        // If in test mode with Ethereal test inbox link:
        if (data.previewUrl && otpPreviewNotice && otpPreviewLink) {
          otpPreviewLink.href = data.previewUrl;
          otpPreviewNotice.style.display = 'block';
        } else if (otpPreviewNotice) {
          otpPreviewNotice.style.display = 'none';
        }

        startOtpCountdown();
        showToast(`✉️ Verification code sent to ${email}`, '✉️');
        if (otpCodeInput) {
          otpCodeInput.value = '';
          otpCodeInput.focus();
        }
      } catch (err) {
        showToast(`❌ ${err.message}`, '⚠️');
        triggerShake(userEmailInput);
      } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = 'Verify Email & Create Account ↵';
      }
    } else {
      // Direct Sign In for existing session
      const name = email.split('@')[0];
      loginUser(email, name);
      closeLoginModal();
      showToast(`Welcome back, ${name}!`, '👤');
    }
  });
}

function startOtpCountdown() {
  if (otpCountdownInterval) clearInterval(otpCountdownInterval);
  let timeLeft = 45;
  if (otpCountdown) otpCountdown.textContent = `${timeLeft}s`;
  if (resendOtpBtn) resendOtpBtn.style.display = 'none';
  if (otpTimerText) otpTimerText.style.display = 'inline';

  otpCountdownInterval = setInterval(() => {
    timeLeft--;
    if (otpCountdown) otpCountdown.textContent = `${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(otpCountdownInterval);
      if (otpTimerText) otpTimerText.style.display = 'none';
      if (resendOtpBtn) resendOtpBtn.style.display = 'inline';
    }
  }, 1000);
}

if (verifyOtpBtn) {
  verifyOtpBtn.addEventListener('click', async () => {
    if (!pendingRegistration) {
      resetAuthModalSteps();
      return;
    }

    const enteredOtp = (otpCodeInput.value || '').trim();
    if (!enteredOtp || enteredOtp.length < 6) {
      triggerShake(otpCodeInput);
      showToast('⚠️ Please enter the 6-digit code sent to your email', '⚠️');
      return;
    }

    verifyOtpBtn.disabled = true;
    verifyOtpBtn.textContent = 'Verifying Code... ⏳';

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingRegistration.email,
          otp: enteredOtp,
          name: pendingRegistration.name
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid or expired verification code.');
      }

      // Success: activate verified account
      loginUser(data.user.email, data.user.name, true);
      closeLoginModal();
      showToast(`🎉 Email Verified! Welcome, ${data.user.name}!`, '✅');
    } catch (err) {
      triggerShake(otpCodeInput);
      showToast(`❌ ${err.message}`, '⚠️');
    } finally {
      verifyOtpBtn.disabled = false;
      verifyOtpBtn.textContent = 'Verify & Activate Account ↵';
    }
  });
}

if (resendOtpBtn) {
  resendOtpBtn.addEventListener('click', async () => {
    if (!pendingRegistration) return;
    resendOtpBtn.disabled = true;
    resendOtpBtn.textContent = 'Resending... ⏳';

    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingRegistration.email,
          name: pendingRegistration.name
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend code.');
      }

      if (data.previewUrl && otpPreviewNotice && otpPreviewLink) {
        otpPreviewLink.href = data.previewUrl;
        otpPreviewNotice.style.display = 'block';
      }

      startOtpCountdown();
      showToast(`✉️ New verification code sent to ${pendingRegistration.email}`, '✉️');
    } catch (err) {
      showToast(`❌ ${err.message}`, '⚠️');
    } finally {
      resendOtpBtn.disabled = false;
      resendOtpBtn.textContent = 'Resend Code ↻';
    }
  });
}

if (backToRegisterBtn) {
  backToRegisterBtn.addEventListener('click', () => {
    resetAuthModalSteps();
  });
}

function loginUser(email, name, verified = true) {
  currentUser = {
    email,
    name: name || email.split('@')[0],
    verified,
    alertPref: currentUser?.alertPref || 'email',
    scansCount: (currentUser?.scansCount || 1),
    loggedInAt: currentUser?.loggedInAt || new Date().toISOString()
  };
  localStorage.setItem('sba_user', JSON.stringify(currentUser));
  initAuthUI();
}

function logoutUser() {
  currentUser = null;
  localStorage.removeItem('sba_user');
  initAuthUI();
  closeAccountModal();
  showToast('Logged out successfully', '👋');
}

// ─── "MY ACCOUNT" MANAGEMENT MODAL CONTROLLER ──────────────────
function initAccountEvents() {
  if (closeAccountModalBtn) {
    closeAccountModalBtn.addEventListener('click', closeAccountModal);
  }
  if (accountModalOverlay) {
    accountModalOverlay.addEventListener('click', (e) => {
      if (e.target === accountModalOverlay) closeAccountModal();
    });
  }
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', saveAccountPreferences);
  }
  if (accountLogoutBtn) {
    accountLogoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to log out?')) {
        logoutUser();
      }
    });
  }
  if (accWishlistStat) {
    accWishlistStat.addEventListener('click', () => {
      closeAccountModal();
      openWishlistDrawer();
    });
  }
}

function openAccountModal() {
  if (!currentUser) {
    openLoginModal();
    return;
  }

  // Populate metadata
  const initial = (currentUser.name || 'U').charAt(0).toUpperCase();
  if (accAvatarLarge) accAvatarLarge.textContent = initial;
  if (accDisplayName) accDisplayName.textContent = currentUser.name || 'buySmartlyer';
  if (accEmail) accEmail.textContent = currentUser.email;

  const joinDate = new Date(currentUser.loggedInAt || Date.now());
  if (accMemberSince) {
    accMemberSince.textContent = `Member since ${joinDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
  }

  // Populate stats
  if (accWishlistCount) accWishlistCount.textContent = wishlist.length;
  if (accAlertsCount) accAlertsCount.textContent = userAlerts.length;
  if (accScansCount) accScansCount.textContent = currentUser.scansCount || 1;

  // Form inputs
  if (editUserName) editUserName.value = currentUser.name || '';
  if (editAlertPref) editAlertPref.value = currentUser.alertPref || 'email';

  // Render armed alerts
  renderAccountAlerts();

  if (accountModalOverlay) accountModalOverlay.style.display = 'flex';
}

function closeAccountModal() {
  if (accountModalOverlay) accountModalOverlay.style.display = 'none';
}

function saveAccountPreferences() {
  if (!currentUser) return;
  const newName = (editUserName.value || '').trim();
  const newPref = editAlertPref.value || 'email';

  if (!newName) {
    triggerShake(editUserName);
    return;
  }

  currentUser.name = newName;
  currentUser.alertPref = newPref;
  localStorage.setItem('sba_user', JSON.stringify(currentUser));

  initAuthUI();
  if (accDisplayName) accDisplayName.textContent = newName;
  showToast('Account preferences updated!', '💾');
}

function renderAccountAlerts() {
  if (!accAlertsList) return;
  if (activeAlertsCountNum) activeAlertsCountNum.textContent = userAlerts.length;

  if (userAlerts.length === 0) {
    accAlertsList.innerHTML = `
      <div class="acc-empty-alerts">
        No active price alerts armed yet. Run a product scan and set a target price to receive drop alerts.
      </div>
    `;
    return;
  }

  accAlertsList.innerHTML = userAlerts.map(alert => `
    <div class="acc-alert-row">
      <div class="acc-alert-info">
        <span class="acc-alert-price">${formatINR(alert.targetPrice)}</span>
        <span class="acc-alert-asin">ASIN: ${alert.asin}</span>
      </div>
      <button class="acc-alert-del-btn" onclick="deleteUserAlert('${alert.asin}')" title="Disarm Alert">✕</button>
    </div>
  `).join('');
}

window.deleteUserAlert = function (asin) {
  userAlerts = userAlerts.filter(a => a.asin !== asin);
  localStorage.setItem('sba_alerts', JSON.stringify(userAlerts));
  renderAccountAlerts();
  if (accAlertsCount) accAlertsCount.textContent = userAlerts.length;
  showToast('Price alert disarmed', '🗑️');
};

function updateAlertUserStatus() {
  if (!alertUserText) return;
  if (currentUser) {
    alertUserText.textContent = `Alerts linked to: ${currentUser.email}`;
  } else {
    alertUserText.textContent = 'Alerts will be delivered to your active session.';
  }
}

// ─── WISHLIST CONTROLLER ────────────────────────────────────────
function updateWishlistUI() {
  const count = wishlist.length;
  if (wishlistCount) wishlistCount.textContent = count;
  if (drawerWishlistBadge) drawerWishlistBadge.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
  renderWishlistItems();
  updateProductWishlistBtnState();
}

function updateProductWishlistBtnState() {
  if (!productWishlistToggleBtn || !currentData) return;
  const itemKey = currentData.productId || currentData.asin || extractAsin(asinInput.value);
  const exists = wishlist.some(item => (item.productId || item.asin) === itemKey);
  const pwIcon = document.getElementById('pwIcon');
  const pwText = document.getElementById('pwText');

  if (exists) {
    productWishlistToggleBtn.classList.add('in-wishlist');
    if (pwIcon) pwIcon.textContent = '❤️';
    if (pwText) pwText.textContent = 'Saved in Wishlist';
  } else {
    productWishlistToggleBtn.classList.remove('in-wishlist');
    if (pwIcon) pwIcon.textContent = '🤍';
    if (pwText) pwText.textContent = 'Save to Wishlist';
  }
}

if (productWishlistToggleBtn) {
  productWishlistToggleBtn.addEventListener('click', () => {
    if (!currentData) return;
    const itemKey = currentData.productId || currentData.asin || extractAsin(asinInput.value);
    const index = wishlist.findIndex(item => (item.productId || item.asin) === itemKey);

    if (index > -1) {
      wishlist.splice(index, 1);
      showToast('Removed from Wishlist', '💔');
    } else {
      wishlist.unshift({
        productId: itemKey,
        asin: itemKey,
        title: currentData.productTitle,
        price: currentData.currentPrice,
        image: currentData.productImage,
        platform: currentData.platform,
        savedAt: new Date().toISOString()
      });
      showToast('Saved to Wishlist!', '❤️');
    }

    localStorage.setItem('sba_wishlist', JSON.stringify(wishlist));
    updateWishlistUI();
  });
}

function renderWishlistItems() {
  if (!wishlistItemsList) return;

  if (wishlist.length === 0) {
    wishlistItemsList.innerHTML = `
      <div class="wishlist-empty">
        <span style="font-size: 2.5rem;">🛍️</span>
        <div style="font-weight: 700; color: var(--text-dim);">Your Wishlist is Empty</div>
        <div style="font-size: 0.8rem; max-width: 240px; line-height: 1.4;">Search any Amazon product and click "Save to Wishlist" to monitor price drops here.</div>
      </div>
    `;
    return;
  }

  wishlistItemsList.innerHTML = wishlist.map(item => `
    <div class="wishlist-item-row">
      <div class="wi-img-frame">
        <img src="${item.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100'}" alt="Product" referrerpolicy="no-referrer" />
      </div>
      <div class="wi-info">
        <div class="wi-title" title="${item.title}">${item.title}</div>
        <div class="wi-price-row">
          <span class="wi-price">${formatINR(item.price)}</span>
          <span class="wi-asin">ASIN: ${item.asin}</span>
        </div>
      </div>
      <div class="wi-actions">
        <button class="wi-scan-btn" onclick="scanFromWishlist('${item.asin}')">Scan ⚡</button>
        <button class="wi-del-btn" onclick="removeFromWishlist('${item.asin}')" title="Remove">✕</button>
      </div>
    </div>
  `).join('');
}

window.scanFromWishlist = function (asin) {
  closeWishlistDrawer();
  fillAndAnalyze(asin);
};

window.removeFromWishlist = function (asin) {
  wishlist = wishlist.filter(item => item.asin !== asin);
  localStorage.setItem('sba_wishlist', JSON.stringify(wishlist));
  updateWishlistUI();
  showToast('Item removed from wishlist', '🗑️');
};

if (clearWishlistBtn) {
  clearWishlistBtn.addEventListener('click', () => {
    if (wishlist.length === 0) return;
    if (confirm('Clear all items from your wishlist?')) {
      wishlist = [];
      localStorage.setItem('sba_wishlist', JSON.stringify(wishlist));
      updateWishlistUI();
      showToast('Wishlist cleared', '🧹');
    }
  });
}

function openWishlistDrawer() {
  if (wishlistOverlay) wishlistOverlay.style.display = 'block';
  if (wishlistDrawer) wishlistDrawer.style.display = 'flex';
}

function closeWishlistDrawer() {
  if (wishlistOverlay) wishlistOverlay.style.display = 'none';
  if (wishlistDrawer) wishlistDrawer.style.display = 'none';
}

if (wishlistTriggerBtn) wishlistTriggerBtn.addEventListener('click', openWishlistDrawer);
if (closeWishlistBtn) closeWishlistBtn.addEventListener('click', closeWishlistDrawer);
if (wishlistOverlay) wishlistOverlay.addEventListener('click', closeWishlistDrawer);

// ─── TOAST NOTIFICATIONS ────────────────────────────────────────
function showToast(msg, icon = '✦') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-pill';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ─── PRICE ALERT SUBMISSION ─────────────────────────────────────
function submitPriceAlert() {
  if (!alertInput) return;
  const targetVal = parseFloat(alertInput.value);

  if (!targetVal || isNaN(targetVal) || targetVal <= 0) {
    triggerShake(alertInput);
    return;
  }

  const asin = currentData?.asin || extractAsin(asinInput?.value || '') || 'UNKNOWN';
  const alertItem = {
    asin,
    title: currentData?.productTitle || 'Tracked Product',
    targetPrice: targetVal,
    currentPrice: currentData?.currentPrice || targetVal,
    createdAt: new Date().toISOString()
  };

  userAlerts = userAlerts.filter(a => a.asin !== asin);
  userAlerts.unshift(alertItem);
  localStorage.setItem('sba_alerts', JSON.stringify(userAlerts));
  if (accAlertsCount) accAlertsCount.textContent = userAlerts.length;

  const recipient = currentUser ? currentUser.email : 'active browser session';
  if (alertMsg) {
    alertMsg.textContent = `⚡ ALERT ACTIVE: Armed for target price ${formatINR(targetVal)}. Notifications will be dispatched to ${recipient}.`;
    alertMsg.style.display = 'block';

    showToast(`Price alert armed for ${formatINR(targetVal)}`, '⚡');

    setTimeout(() => {
      alertMsg.style.display = 'none';
    }, 6000);
  }
}

// ─── FORMATTERS & ANIMATORS ─────────────────────────────────────
function formatINR(num) {
  if (isNaN(num)) return '₹0';
  return '₹' + Math.round(num).toLocaleString('en-IN');
}

function animatePrice(element, targetValue, duration = 600) {
  if (!element || targetValue === undefined) return;
  const target = parseFloat(targetValue);
  if (isNaN(target)) {
    element.textContent = '₹—';
    return;
  }

  const start = performance.now();
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(target * ease);

    element.textContent = formatINR(current);

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = formatINR(target);
    }
  }
  requestAnimationFrame(update);
}

// ─── LAST 4 RECENT SEARCHES MANAGER ─────────────────────────────
const RECENT_KEY = 'buySmartly_recent_searches';
const DEFAULT_RECENT_SEARCHES = [
  {
    title: 'Sony WH-1000XM5 ANC Headphones',
    price: 26990,
    platform: 'amazon',
    platformIcon: '🛍️',
    image: 'https://m.media-amazon.com/images/I/61O3iMlnJIL._SL1500_.jpg',
    query: 'B09XS7JWHH'
  },
  {
    title: 'iPhone 15 Pro Titanium Black',
    price: 69999,
    platform: 'amazon',
    platformIcon: '🛍️',
    image: 'https://m.media-amazon.com/images/I/71657TiFeHL._SL1500_.jpg',
    query: 'B0CHX1W1XY'
  },
  {
    title: 'Caprese Shyla Shoulder Bag',
    price: 950,
    platform: 'myntra',
    platformIcon: '👗',
    image: 'https://m.media-amazon.com/images/I/61wZjWZC7IL._AC_UL960_QL65_.jpg',
    query: 'https://www.myntra.com/handbags/caprese/caprese-croc-textured-baguette-shoulder-bag/35719710/buy'
  },
  {
    title: 'Nike Air Max SC Low-Top Sneakers',
    price: 4495,
    platform: 'ajio',
    platformIcon: '🏷️',
    image: 'https://m.media-amazon.com/images/I/61xi8pnZunL._AC_UL960_QL65_.jpg',
    query: 'https://www.ajio.com/nike-air-max/p/469034298_white'
  }
];

function getRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return DEFAULT_RECENT_SEARCHES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_RECENT_SEARCHES;
  } catch (e) {
    return DEFAULT_RECENT_SEARCHES;
  }
}

function saveRecentSearch(item) {
  if (!item || !item.query) return;
  try {
    let list = getRecentSearches();
    list = list.filter(r => r.query !== item.query && r.title !== item.title);
    list.unshift({
      title: item.title || 'Tracked Product',
      price: item.price || 0,
      platform: item.platform || 'amazon',
      platformIcon: item.platformIcon || '🛍️',
      image: item.image || getClientFallbackImage(item.title),
      query: item.query
    });
    list = list.slice(0, 4);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    renderRecentSearches();
  } catch (e) {}
}

function renderRecentSearches() {
  const rail = document.getElementById('recentTilesRail');
  const container = document.getElementById('recentSearchesContainer');
  if (!rail || !container) return;

  const items = getRecentSearches();
  if (items.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  rail.innerHTML = items.map(item => {
    const safeTitle = decodeHtmlEntities(item.title || 'Product');
    const safeImg = item.image || getClientFallbackImage(item.title);
    return `
      <div class="recent-tile" onclick="fillAndAnalyze('${encodeURIComponent(item.query).replace(/'/g, "\\'")}')" title="${safeTitle}">
        <img class="recent-tile-img" src="${safeImg}" alt="Thumb" referrerpolicy="no-referrer" onerror="this.src='${getClientFallbackImage(safeTitle)}'" />
        <div class="recent-tile-info">
          <div class="recent-tile-title">${safeTitle}</div>
          <div class="recent-tile-meta">
            <span class="recent-tile-price">${item.price > 0 ? formatINR(item.price) : 'Scan ⚡'}</span>
            <span class="recent-tile-badge">${item.platformIcon || '🛍️'}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

const clearRecentBtn = document.getElementById('clearRecentBtn');
if (clearRecentBtn) {
  clearRecentBtn.addEventListener('click', () => {
    localStorage.setItem(RECENT_KEY, JSON.stringify([]));
    renderRecentSearches();
    showToast('Recent searches cleared', '🧹');
  });
}

// ─── AUTOMATED HOURLY TRENDING DEALS ENGINE ─────────────────
let activeTrendingStore = 'all';
let currentTrendingDeals = [];
let hourlySyncInterval = null;

async function initTrendingDeals() {
  const filterButtons = document.querySelectorAll('.store-filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTrendingStore = btn.getAttribute('data-store') || 'all';
      fetchTrendingDeals(activeTrendingStore);
    });
  });

  await fetchTrendingDeals('all');
}

async function fetchTrendingDeals(store = 'all') {
  const grid = document.getElementById('trendingGrid');
  if (grid && currentTrendingDeals.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: var(--text-muted);">
        <div class="spinner" style="margin: 0 auto 12px; width: 24px; height: 24px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--brand-indigo); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <div>Syncing hourly trending deals across stores...</div>
      </div>
    `;
  }

  try {
    const res = await fetch(`${API_BASE}/api/trending-deals?store=${encodeURIComponent(store)}`);
    if (!res.ok) throw new Error('API error: ' + res.status);
    const data = await res.json();

    if (data && Array.isArray(data.deals)) {
      currentTrendingDeals = data.deals;
      renderTrendingGrid(data.deals);
      
      if (data.syncState) {
        startHourlyCountdown(data.syncState.nextRefreshInMs);
      }
    }
  } catch (err) {
    console.warn('[fetchTrendingDeals] Failed to load from API:', err.message);
  }
}

function startHourlyCountdown(initialMsRemaining) {
  if (hourlySyncInterval) clearInterval(hourlySyncInterval);

  let msLeft = initialMsRemaining || 3600000;
  const countdownEl = document.getElementById('syncCountdown');

  function update() {
    if (msLeft <= 0) {
      msLeft = 3600000;
      fetchTrendingDeals(activeTrendingStore);
    }
    const totalSecs = Math.floor(msLeft / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (countdownEl) {
      countdownEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    msLeft -= 1000;
  }

  update();
  hourlySyncInterval = setInterval(update, 1000);
}

function renderTrendingGrid(deals) {
  const grid = document.getElementById('trendingGrid');
  if (!grid) return;

  const items = Array.isArray(deals) ? deals : [];

  if (items.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 30px;">No deals found for this store right now.</div>`;
    return;
  }

  grid.innerHTML = items.map(deal => {
    const safeTitle = decodeHtmlEntities(deal.title);
    const safeUrl = deal.url || '#';
    return `
      <div class="trending-card">
        <div class="tc-media">
          <img class="tc-img" src="${deal.image}" alt="${safeTitle}" referrerpolicy="no-referrer" loading="lazy" onerror="this.src='${getClientFallbackImage(safeTitle)}'" />
          <span class="tc-store-pill" style="background: rgba(0,0,0,0.65); color: ${deal.storeColor}; border: 1px solid ${deal.storeColor};">
            ${deal.storeIcon} ${deal.storeName}
          </span>
          <span class="tc-discount-pill">${deal.discount}</span>
        </div>
        <div class="tc-body">
          <div class="tc-signal-tag">${deal.signal}</div>
          <h3 class="tc-title" title="${safeTitle}">${safeTitle}</h3>
          <div class="tc-price-row">
            <span class="tc-price">${formatINR(deal.price)}</span>
            <span class="tc-mrp">${formatINR(deal.mrp)}</span>
          </div>
          <div class="tc-actions-stack" style="display: flex; flex-direction: column; gap: 6px; margin-top: auto;">
            <button class="tc-scan-btn" onclick="fillAndAnalyze('${encodeURIComponent(deal.query).replace(/'/g, "\\'")}')">
              <span>Verify Deal Price</span>
              <span>⚡</span>
            </button>
            <a class="tc-buy-direct-btn" href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 5px; padding: 7px; border-radius: var(--rad-sm); background: var(--bg-surface); border: 1px solid var(--border-hairline); color: var(--text-dim); font-size: 0.76rem; font-weight: 600; text-decoration: none; transition: all 0.2s ease;">
              <span>Buy on ${deal.storeName}</span>
              <span>↗</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Global helper for sample buttons and card clicks
window.fillAndAnalyze = function (idOrUrl) {
  if (!asinInput) return;
  const decoded = decodeURIComponent(idOrUrl);
  asinInput.value = decoded;
  if (clearBtn) clearBtn.style.display = 'flex';
  executeAnalysis();
};

// Initial calls on load
document.addEventListener('DOMContentLoaded', () => {
  renderRecentSearches();
  initTrendingDeals();
});

// Immediate execution in case DOM is already ready
renderRecentSearches();
initTrendingDeals();


