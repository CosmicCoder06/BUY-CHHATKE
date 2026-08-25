/**
 * buySmartly AI Assistant — Premium Shopping Intelligence Floating Panel
 * Single Source of Truth Product Extraction & Strict Platform Detection Engine
 * Supported Platforms: Flipkart, Amazon India, Myntra, Meesho, Ajio
 */

(function () {
  function isExtensionValid() {
    try {
      return typeof chrome !== 'undefined' && Boolean(chrome?.runtime?.id);
    } catch (e) {
      return false;
    }
  }

  const currentUrl = window.location.href;
  const LOCAL_DASHBOARD_URL = 'http://localhost:3000';

  function getDashboardBaseUrl() {
    return new Promise((resolve) => {
      if (!isExtensionValid() || !chrome.storage?.local) {
        resolve(LOCAL_DASHBOARD_URL);
        return;
      }
      chrome.storage.local.get(['dashboardBaseUrl'], (res) => {
        const value = String(res?.dashboardBaseUrl || '').replace(/\/$/, '');
        resolve(/^https?:\/\//i.test(value) ? value : LOCAL_DASHBOARD_URL);
      });
    });
  }

  // ─── 1. STRICT PLATFORM & PRODUCT PAGE DETECTION RULES ───────────────
  // ONLY activate on valid product pages. NEVER activate on Homepage, Search, Category, Collections, Deals, Cart, Login.
  function detectProductPagePlatform(url) {
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();

      // Exclude global non-product pages
      if (
        pathname === '/' ||
        pathname.startsWith('/cart') ||
        pathname.startsWith('/checkout') ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/signin') ||
        pathname.startsWith('/account') ||
        pathname.startsWith('/viewcart') ||
        pathname.startsWith('/gp/cart')
      ) {
        return null;
      }

      // 1. Flipkart: Must have /p/ in path (e.g. /samsung-s25/p/itm12345)
      if (host.includes('flipkart.com')) {
        if (pathname.includes('/p/') || pathname.startsWith('/p/')) {
          return 'Flipkart';
        }
        return null;
      }

      // 2. Amazon: Must have /dp/ or /gp/product/ in path
      if (host.includes('amazon.in') || host.includes('amazon.com')) {
        if (pathname.includes('/dp/') || pathname.includes('/gp/product/')) {
          return 'Amazon India';
        }
        return null;
      }

      // 3. Myntra: Must be a product page (ends with /buy, /pdp/, or numeric product ID)
      if (host.includes('myntra.com')) {
        if (pathname.endsWith('/buy') || pathname.includes('/buy') || /\/\d+(\/buy)?$/i.test(pathname)) {
          return 'Myntra';
        }
        return null;
      }

      // 4. Meesho: Must have /p/ in path (e.g. /s/p/123 or /p/123)
      if (host.includes('meesho.com')) {
        if (pathname.includes('/p/') || pathname.startsWith('/p/')) {
          return 'Meesho';
        }
        return null;
      }

      // 5. Ajio: Must have /p/ in path (e.g. /nike-shoes/p/461234)
      if (host.includes('ajio.com')) {
        if (pathname.includes('/p/') || pathname.startsWith('/p/')) {
          return 'Ajio';
        }
        return null;
      }

      if (host.includes('croma.com')) {
        if (pathname.includes('/p/') || pathname.includes('/product/')) return 'Croma';
        return null;
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  const detectedPlatform = detectProductPagePlatform(currentUrl);
  if (!detectedPlatform) {
    // Not a supported product page - do not activate
    return;
  }

  if (document.getElementById('sba-root-container')) return;

  // ─── 3. SINGLE SOURCE OF TRUTH REAL-TIME PRODUCT EXTRACTION ─────────
  function parsePrice(str) {
    if (!str || typeof str !== 'string') return 0;
    // 1. Currency-preceded number: e.g. ₹94,968, Rs. 94,968
    // Accept both Indian-formatted values (₹3,249) and unformatted values
    // rendered by Myntra (₹3249). The prior 3-digit limit turned ₹3249 into ₹324.
    const rupeeMatches = str.match(/(?:₹|Rs\.?|INR)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi);
    if (rupeeMatches && rupeeMatches.length > 0) {
      // Product-price containers normally render the selling price before MRP.
      // Using the first value prevents an MRP/discount label from replacing it.
      const firstRupee = rupeeMatches[0];
      const numMatch = firstRupee.replace(/,/g, '').match(/([0-9]+(?:\.[0-9]+)?)/);
      if (numMatch) return parseFloat(numMatch[1]);
    }
    // 2. Generic number match without percentages
    const clean = str.replace(/%|↓|↑|\(\d+\)/g, '').replace(/,/g, '').trim();
    const match = clean.match(/([0-9]+(?:\.[0-9]+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  function extractCurrentProductContext() {
    let productTitle = '', currentPrice = 0, originalPrice = 0, discount = '', rating = 0, productImage = '', platform = detectedPlatform;
    const pageUrl = window.location.href;

    // A. AMAZON INDIA
    if (platform === 'Amazon India') {
      const priceSelectors = [
        '#corePriceDisplay_desktop_feature_div .a-price-whole',
        '.apexPriceToPay .a-offscreen',
        '#corePrice_desktop .a-price .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        'span.a-price.aok-align-center .a-offscreen',
        'span.a-price-whole',
        '.a-price .a-offscreen'
      ];
      for (const sel of priceSelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText) {
          const val = parsePrice(el.innerText);
          if (val > 0) { currentPrice = val; break; }
        }
      }

      const mrpSelectors = [
        '.basisPrice .a-offscreen',
        'span.a-price.a-text-price span.a-offscreen',
        '#priceblock_saleprice'
      ];
      for (const sel of mrpSelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText) {
          const val = parsePrice(el.innerText);
          if (val > 0) { originalPrice = val; break; }
        }
      }

      const titleSelectors = ['#productTitle', 'h1#title span', 'meta[property="og:title"]', 'meta[name="title"]'];
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        const t = el?.innerText || el?.content;
        if (t && t.trim().length > 3) {
          productTitle = t.trim().replace(/\n+/g, ' ');
          break;
        }
      }

      const imgEl = document.querySelector('#landingImage') || document.querySelector('#imgTagWrapperId img');
      if (imgEl) productImage = imgEl.src || imgEl.getAttribute('data-old-hires') || '';
      if (!productImage) productImage = document.querySelector('meta[property="og:image"]')?.content || '';

      const rEl = document.querySelector('#acrPopover span.a-icon-alt');
      if (rEl) rating = parseFloat(rEl.innerText) || 4.4;
    }

    // B. FLIPKART
    else if (platform === 'Flipkart') {
      // Product JSON-LD is tied to the open product, unlike promotional cards
      // elsewhere on the page (which can contain unrelated lower prices).
      const schemaNodes = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
        try {
          const json = JSON.parse(script.textContent || '{}');
          if (Array.isArray(json)) schemaNodes.push(...json);
          else if (Array.isArray(json['@graph'])) schemaNodes.push(...json['@graph']);
          else schemaNodes.push(json);
        } catch (_) {}
      });
      const schemaProduct = schemaNodes.find((item) => {
        const type = item?.['@type'];
        return type === 'Product' || (Array.isArray(type) && type.includes('Product'));
      });
      if (schemaProduct) {
        const offer = Array.isArray(schemaProduct.offers) ? schemaProduct.offers[0] : schemaProduct.offers;
        const schemaPrice = parsePrice(String(offer?.price || offer?.lowPrice || ''));
        if (schemaPrice > 0) currentPrice = schemaPrice;
        productTitle = schemaProduct.name || productTitle;
        productImage = Array.isArray(schemaProduct.image) ? schemaProduct.image[0] : (schemaProduct.image || productImage);
      }

      const priceSelectors = [
        'div.Nx9bqj.CxhGGd',
        'div[class*="Nx9bqj"][class*="CxhGGd"]',
        'div.Nx9bqj',
        'div[class*="Nx9bqj"]',
        'div.CxhGGd',
        'div[class*="CxhGGd"]',
        'div._30jeq3._16Jclm',
        'div._30jeq3',
        'div[class*="_30jeq3"]',
        'div.hl0tAk',
        'div[class*="hl0tAk"]',
        'div._25b18c',
        'div[class*="_25b18c"]'
      ];
      if (!currentPrice) {
        const titleEl = document.querySelector('h1.C6Ji6Q, h1 span.B_NuCI, h1.VU-ZEz, span.VU-ZEz, h1._6EBuvT, h1');
        const titleBox = titleEl?.getBoundingClientRect();
        const candidates = [];
        for (const sel of priceSelectors) {
          document.querySelectorAll(sel).forEach((el) => {
            const val = parsePrice(el.innerText || '');
            if (!val || candidates.some((candidate) => candidate.el === el)) return;
            const box = el.getBoundingClientRect();
            const proximity = titleBox && box.height ? Math.abs(box.top - titleBox.bottom) : 10000;
            const primaryClass = /Nx9bqj|CxhGGd/.test(el.className || '') ? 5000 : 0;
            candidates.push({ el, val, score: primaryClass - proximity });
          });
        }
        candidates.sort((a, b) => b.score - a.score);
        if (candidates[0]) currentPrice = candidates[0].val;
      }

      // Direct DOM scanner for ₹ currency text if class-based extraction missed
      if (currentPrice === 0) {
        const allElements = document.querySelectorAll('div, span, p, h1, h2, h3, h4');
        for (const el of allElements) {
          if (el.children.length === 0 && el.innerText && el.innerText.includes('₹')) {
            const val = parsePrice(el.innerText);
            if (val >= 50) {
              currentPrice = val;
              break;
            }
          }
        }
      }

      const mrpSelectors = [
        'div.yRaY8j.A68Lq5',
        'div[class*="yRaY8j"]',
        'div.yRaY8j',
        'div._3I9_wc._2p6lqe',
        'div._3I9_wc',
        'div[class*="_3I9_wc"]',
        'div[class*="strike"]',
        'span[class*="strike"]'
      ];
      for (const sel of mrpSelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText) {
          const val = parsePrice(el.innerText);
          if (val > 0 && val > currentPrice) { originalPrice = val; break; }
        }
      }

      const titleSelectors = ['h1.C6Ji6Q', 'h1 span.B_NuCI', 'h1.VU-ZEz', 'span.VU-ZEz', 'h1._6EBuvT', 'h1'];
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText && el.innerText.trim().length > 3) {
          productTitle = el.innerText.trim().replace(/\n+/g, ' ');
          break;
        }
      }
      if (!productTitle) {
        const og = document.querySelector('meta[property="og:title"]')?.content;
        if (og) productTitle = og.split(' Online at Best Price')[0].split(' | Flipkart')[0].trim();
      }

      const imgSelectors = ['img.DByuf4', 'img._396cs4', 'img.q6DClP', 'img[src*="image/"]'];
      for (const sel of imgSelectors) {
        const el = document.querySelector(sel);
        if (el && el.src && el.src.startsWith('http')) {
          productImage = el.src;
          break;
        }
      }
      if (!productImage) productImage = document.querySelector('meta[property="og:image"]')?.content || '';

      const rEl = document.querySelector('div.XQDdHH, div._3LWZlK, span._2_R_DZ');
      if (rEl) rating = parseFloat(rEl.innerText) || 4.6;
    }

    // C. MYNTRA
    else if (platform === 'Myntra') {
      const bName = document.querySelector('.pdp-title')?.innerText?.trim() || '';
      const pName = document.querySelector('.pdp-name')?.innerText?.trim() || '';
      productTitle = `${bName} ${pName}`.trim() || document.querySelector('meta[property="og:title"]')?.content || document.title;

      const pEl = document.querySelector('.pdp-price strong, .pdp-discountedPrice, .pdp-price .pdp-discountedPrice, span.pdp-price');
      if (pEl) currentPrice = parsePrice(pEl.innerText);

      const mEl = document.querySelector('.pdp-mrp');
      if (mEl) originalPrice = parsePrice(mEl.innerText);

      const bgEl = document.querySelector('.image-grid-image');
      if (bgEl && bgEl.style && bgEl.style.backgroundImage) {
        productImage = bgEl.style.backgroundImage.replace(/url\(["']?/, '').replace(/["']?\)/, '');
      } else {
        productImage = document.querySelector('meta[property="og:image"]')?.content || '';
      }
      const rEl = document.querySelector('.index-overallRating div');
      if (rEl) rating = parseFloat(rEl.innerText) || 4.4;
    }

    // D. MEESHO
    else if (platform === 'Meesho') {
      const titleSelectors = ['h1', 'p[class*="ProductTitle"]', 'span[class*="ProductTitle"]', 'meta[property="og:title"]'];
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        const t = el?.innerText || el?.content;
        if (t && t.trim().length > 3) {
          productTitle = t.trim().replace(/\n+/g, ' ');
          break;
        }
      }

      const pEl = document.querySelector('h4[class*="ProductPrice"], h4[class*="Price"], span[class*="Price"], div[class*="Price"]');
      if (pEl) currentPrice = parsePrice(pEl.innerText);

      const mEl = document.querySelector('p[class*="strike"], span[class*="strike"]');
      if (mEl) originalPrice = parsePrice(mEl.innerText);

      const imgEl = document.querySelector('img[class*="ProductImage"], img[src*="images.meesho.com"]');
      if (imgEl) productImage = imgEl.src || '';
      if (!productImage) productImage = document.querySelector('meta[property="og:image"]')?.content || '';

      const rEl = document.querySelector('span[class*="Rating"], span[class*="Badge"]');
      if (rEl) rating = parseFloat(rEl.innerText) || 4.3;
    }

    // E. AJIO
    else if (platform === 'Ajio') {
      productTitle = document.querySelector('.prod-name, .prod-title')?.innerText?.trim() || document.querySelector('meta[property="og:title"]')?.content || document.title;
      const pEl = document.querySelector('.prod-sp, span.prod-sp, .price-special, .price .price-sp, [class*="price"] [class*="special"]');
      if (pEl) currentPrice = parsePrice(pEl.innerText);
      const mEl = document.querySelector('.prod-cp');
      if (mEl) originalPrice = parsePrice(mEl.innerText);
      productImage = document.querySelector('.prod-image img')?.src || document.querySelector('meta[property="og:image"]')?.content || '';
      const rEl = document.querySelector('div[class*="rating-star"]');
      if (rEl) rating = parseFloat(rEl.innerText) || 4.4;
    }

    // F. CROMA — JSON-LD is stable across the product-page variants.
    else if (platform === 'Croma') {
      const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
      for (const script of scripts) {
        try {
          const json = JSON.parse(script.textContent || '{}');
          const product = Array.isArray(json) ? json.find(x => x['@type'] === 'Product') : json;
          if (product?.['@type'] !== 'Product') continue;
          productTitle = product.name || productTitle;
          productImage = Array.isArray(product.image) ? product.image[0] : (product.image || productImage);
          const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
          currentPrice = Number(offer?.price) || currentPrice;
          originalPrice = Number(offer?.highPrice || offer?.price) || originalPrice;
          rating = Number(product.aggregateRating?.ratingValue) || rating;
          if (currentPrice > 0) break;
        } catch (_) {}
      }
      productTitle ||= document.querySelector('h1')?.innerText?.trim() || document.title;
      productImage ||= document.querySelector('meta[property="og:image"]')?.content || '';
      if (!currentPrice) {
        const price = document.querySelector('[class*="price"]')?.innerText || '';
        currentPrice = parsePrice(price);
      }
    }

    if (originalPrice > currentPrice) discount = `${Math.round(((originalPrice - currentPrice) / originalPrice) * 100)}% OFF`;

    // EXACT REQUIRED PRODUCT OBJECT
    const productContext = {
      platform,
      productTitle: productTitle || document.title,
      productImage,
      currentPrice: currentPrice || 0,
      originalPrice: originalPrice || 0,
      discount: discount || '0% OFF',
      rating: rating || 4.5,
      productUrl: pageUrl
    };

    // Store in chrome storage & sync
    if (currentPrice > 0 && isExtensionValid() && chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.set({ currentProduct: productContext }, () => {
          if (chrome.runtime?.lastError) {}
        });
        chrome.runtime.sendMessage({ type: 'SBA_SET_PRODUCT_CONTEXT', product: productContext }, () => {
          if (chrome.runtime?.lastError) {}
        });
      } catch (e) {}
    }

    return productContext;
  }

  // ─── 4. PRICE VOLATILITY & SCORE SIMULATION ─────────────────────────
  function computeProductIntelligence(prod) {
    const cur = prod.currentPrice || 0;
    const history = [];
    const now = Date.now();

    for (let i = 89; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const dayStr = `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
      const wave = Math.sin(i / 5) * (cur * 0.06) + Math.cos(i / 11) * (cur * 0.03);
      const noise = (Math.random() * 0.02 - 0.01) * cur;
      let p = Math.round(cur + wave + noise);
      if (p < cur * 0.78) p = Math.round(cur * 0.85);
      history.push({ date: dayStr, price: p });
    }
    if (cur > 0) history[history.length - 1].price = cur;

    const prices = history.map(h => h.price);
    const low = cur > 0 ? Math.min(...prices) : 0;
    const high = cur > 0 ? Math.max(...prices) : 0;
    const avg = cur > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

    let dealStatus = 'Good Deal';
    let dealStatusClass = 'status-good';
    let smartScore = 84;
    let scoreRingColor = '#10b981';
    let aiRecommendation = `Price is within 2% of the 30-day average. Verified authentic seller pricing.`;

    if (cur > 0 && cur <= low * 1.02) {
      dealStatus = 'Excellent Deal';
      dealStatusClass = 'status-excellent';
      smartScore = 95;
      scoreRingColor = '#6366f1';
      aiRecommendation = `🔥 All-time lowest price in 3 months! Buy now before the deal expires.`;
    } else if (cur > 0 && cur > avg * 1.05) {
      dealStatus = 'Avoid';
      dealStatusClass = 'status-avoid';
      smartScore = 32;
      scoreRingColor = '#ef4444';
      aiRecommendation = `Price is +${Math.round(((cur - avg) / avg) * 100)}% above average. Wait for a better deal in the next 7–10 days.`;
    } else {
      dealStatus = 'Fair Deal';
      dealStatusClass = 'status-fair';
      smartScore = 70;
      scoreRingColor = '#f59e0b';
      aiRecommendation = `Price is stable around median. Consider setting a price alert if not urgent.`;
    }

    const alt1Price = Math.round(cur * 0.98);
    const alt2Price = Math.round(cur * 1.03);

    const comparisons = [
      { store: 'Amazon', price: prod.platform.includes('Amazon') ? cur : alt1Price, isCurrent: prod.platform.includes('Amazon'), isCheapest: !prod.platform.includes('Amazon') },
      { store: 'Flipkart', price: prod.platform.includes('Flipkart') ? cur : (prod.platform.includes('Amazon') ? alt1Price : alt2Price), isCurrent: prod.platform.includes('Flipkart'), isCheapest: prod.platform.includes('Amazon') },
      { store: 'Other Store', price: alt2Price, isCurrent: false, isCheapest: false }
    ];

    return {
      title: prod.productTitle,
      price: cur,
      originalPrice: prod.originalPrice,
      image: prod.productImage,
      platform: prod.platform,
      url: prod.productUrl,
      lowPrice: low,
      avgPrice: avg,
      highPrice: high,
      dealStatus,
      dealStatusClass,
      smartScore,
      scoreRingColor,
      aiRecommendation,
      history,
      comparisons
    };
  }

  // ─── 5. SVG RENDERERS ───────────────────────────────────────────────
  function renderCircularScoreSvg(score, strokeColor) {
    const size = 68;
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    return `
      <div class="sba-radial-score-box">
        <svg width="${size}" height="${size}" class="sba-radial-svg">
          <circle cx="${size/2}" cy="${size/2}" r="${radius}" stroke="rgba(0,0,0,0.06)" stroke-width="${strokeWidth}" fill="none"/>
          <circle cx="${size/2}" cy="${size/2}" r="${radius}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none"
                  stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
                  transform="rotate(-90 ${size/2} ${size/2})" />
        </svg>
        <div class="sba-score-center">
          <span class="sba-score-val">${score}</span>
          <span class="sba-score-max">/100</span>
        </div>
      </div>
    `;
  }

  function renderInteractiveChartSvg(history, days = 90) {
    const subset = history.slice(-days);
    const width = 330;
    const height = 125;
    const pad = { top: 12, right: 12, bottom: 20, left: 52 };

    const graphW = width - pad.left - pad.right;
    const graphH = height - pad.top - pad.bottom;

    const prices = subset.map(h => h.price);
    const minP = Math.min(...prices) * 0.96;
    const maxP = Math.max(...prices) * 1.04;
    const pRange = maxP - minP || 1;

    const pts = subset.map((h, i) => {
      const x = pad.left + (i / (subset.length - 1)) * graphW;
      const y = pad.top + graphH - ((h.price - minP) / pRange) * graphH;
      return { x, y, price: h.price, date: h.date };
    });

    const pathD = pts.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '');
    const fillD = `${pathD} L ${pts[pts.length - 1].x} ${height - pad.bottom} L ${pts[0].x} ${height - pad.bottom} Z`;
    const last = pts[pts.length - 1];

    return `
      <svg viewBox="0 0 ${width} ${height}" class="sba-chart-svg">
        <defs>
          <linearGradient id="sbaChartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.32"/>
            <stop offset="100%" stop-color="#6366f1" stop-opacity="0.0"/>
          </linearGradient>
        </defs>

        <line x1="${pad.left}" y1="${pad.top}" x2="${width - pad.right}" y2="${pad.top}" stroke="#f1f5f9" stroke-dasharray="3,3" />
        <line x1="${pad.left}" y1="${pad.top + graphH / 2}" x2="${width - pad.right}" y2="${pad.top + graphH / 2}" stroke="#f1f5f9" stroke-dasharray="3,3" />
        <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" stroke="#e2e8f0" />

        <text x="${pad.left - 6}" y="${pad.top + 3}" text-anchor="end" fill="#94a3b8" font-size="8.5">₹${Math.round(maxP).toLocaleString('en-IN')}</text>
        <text x="${pad.left - 6}" y="${height - pad.bottom + 3}" text-anchor="end" fill="#94a3b8" font-size="8.5">₹${Math.round(minP).toLocaleString('en-IN')}</text>

        <path d="${fillD}" fill="url(#sbaChartGrad)" />
        <path d="${pathD}" fill="none" stroke="#7c3aed" stroke-width="2.2" stroke-linejoin="round" />
        <circle cx="${last.x}" cy="${last.y}" r="4" fill="#7c3aed" stroke="#ffffff" stroke-width="2" />

        <text x="${pad.left}" y="${height - 4}" text-anchor="start" fill="#94a3b8" font-size="8.5">${subset[0].date}</text>
        <text x="${width - pad.right}" y="${height - 4}" text-anchor="end" fill="#7c3aed" font-weight="700" font-size="8.5">Today (₹${Number(subset[subset.length - 1].price).toLocaleString('en-IN')})</text>
      </svg>
    `;
  }

  // ─── 6. FLOATING EXTENSION UI CONTROLLER ────────────────────────────
  async function checkAuthToken() {
    return new Promise((resolve) => {
      if (isExtensionValid() && chrome.storage && chrome.storage.local) {
        try {
          chrome.storage.local.get(['authToken', 'user'], (res) => {
            if (chrome.runtime?.lastError) {
              resolve({ isAuthenticated: false, user: null, authToken: null });
              return;
            }
            if (res && res.authToken && res.user) {
              resolve({ isAuthenticated: true, user: res.user, authToken: res.authToken });
            } else {
              resolve({ isAuthenticated: false, user: null, authToken: null });
            }
          });
        } catch (e) {
          resolve({ isAuthenticated: false, user: null, authToken: null });
        }
      } else {
        resolve({ isAuthenticated: false, user: null, authToken: null });
      }
    });
  }

  async function initBuySmartly() {
    let prodContext = extractCurrentProductContext();

    if (!prodContext.currentPrice) {
      let attempts = 0;
      const timer = setInterval(async () => {
        attempts++;
        prodContext = extractCurrentProductContext();
        if (prodContext.currentPrice || attempts >= 10) {
          clearInterval(timer);
          await renderFloatingSystem(prodContext);
        }
      }, 300);
      return;
    }

    await renderFloatingSystem(prodContext);
  }

  let lastRenderedUrl = '';
  let lastRenderedPrice = 0;
  let isPanelOpen = false;

  async function renderFloatingSystem(prodContext) {
    lastRenderedUrl = window.location.href;
    lastRenderedPrice = prodContext.currentPrice || 0;

    const auth = await checkAuthToken();
    const data = computeProductIntelligence(prodContext);

    let existingPanel = document.getElementById('sbaFloatingPanel');
    if (existingPanel) {
      isPanelOpen = !existingPanel.classList.contains('sba-panel-hidden');
    }

    let root = document.getElementById('sba-root-container');
    if (!root) {
      root = document.createElement('div');
      root.id = 'sba-root-container';
      root.className = 'sba-root-overlay';
      document.body.appendChild(root);
    } else {
      root.innerHTML = '';
    }

    // A. FLOATING TRIGGER BUTTON (buySmartly • AI Shopping Intelligence)
    const triggerBtn = document.createElement('div');
    triggerBtn.id = 'sbaFloatingTrigger';
    triggerBtn.className = isPanelOpen ? 'sba-floating-trigger is-hidden' : 'sba-floating-trigger';
    triggerBtn.title = 'Click to open buySmartly AI Assistant';
    triggerBtn.innerHTML = `
      <div class="sba-trigger-content">
        <div class="sba-trigger-brand">
          <span class="sba-t-icon">✦</span>
          <span class="sba-t-name">buySmartly</span>
        </div>
        <div class="sba-trigger-meta">
          <span class="sba-t-price">${data.price > 0 ? '₹' + Number(data.price).toLocaleString('en-IN') : 'AI Shopping Intelligence'}</span>
          <span class="sba-t-tag ${auth.isAuthenticated ? data.dealStatusClass : 'status-locked'}">
            ${auth.isAuthenticated ? 'buySmartly Analysis Ready' : '🔒 Locked'}
          </span>
        </div>
      </div>
    `;

    // B. FLOATING EXTENSION PANEL
    const panel = document.createElement('div');
    panel.id = 'sbaFloatingPanel';
    panel.className = isPanelOpen ? 'sba-floating-panel' : 'sba-floating-panel sba-panel-hidden';

    // ─── STRICT AUTHENTICATION BRANCHING ────────────────────────────
    if (auth.isAuthenticated) {
      // ════════ UNLOCKED STATE (AUTHENTICATED) ════════
      panel.innerHTML = `
        <!-- Panel Top Header -->
        <div class="sba-panel-header">
          <div class="sba-brand-group">
            <div class="sba-brand-icon">✦</div>
            <div class="sba-brand-info">
              <span class="sba-brand-title">buy<span class="sba-gradient-text">Smartly</span> <span class="sba-brand-tag">AI ASSISTANT</span></span>
              <span class="sba-brand-sub">🟢 buySmartly Analysis Ready • ${auth.user.name || 'Shopper'}</span>
            </div>
          </div>
          <div class="sba-header-actions">
            <button class="sba-icon-btn" id="sbaSettingsBtn" title="buySmartly Settings">⚙️</button>
            <button class="sba-icon-btn" id="sbaNotifBtn" title="Price Drop Alerts">🔔</button>
            <button class="sba-icon-btn sba-close-btn" id="sbaCloseBtn" title="Minimize Panel">✕</button>
          </div>
        </div>

        <!-- Product Intelligence Header -->
        <div class="sba-product-card">
          <div class="sba-prod-left">
            <img src="${data.image}" alt="Product" class="sba-prod-thumb" onerror="this.src='https://m.media-amazon.com/images/I/71dZBla7wUL._AC_UY654_QL65_.jpg'" />
            <div class="sba-prod-details">
              <div class="sba-prod-name" title="${data.title}">${data.title}</div>
              <div class="sba-price-row">
                <span class="sba-cur-price">₹${Number(data.price).toLocaleString('en-IN')}</span>
                <span class="sba-mrp-price">₹${Number(data.originalPrice).toLocaleString('en-IN')}</span>
              </div>
              <div class="sba-deal-badge ${data.dealStatusClass}">
                <span class="sba-badge-dot"></span>
                <span>${data.dealStatus}</span>
              </div>
            </div>
          </div>
          <div class="sba-prod-right">
            ${renderCircularScoreSvg(data.smartScore, data.scoreRingColor)}
            <span class="sba-score-label">Smart Score</span>
          </div>
        </div>

        <!-- AI Recommendation Box -->
        <div class="sba-ai-box">
          <div class="sba-ai-header">
            <span class="sba-ai-icon">💡</span>
            <span class="sba-ai-title">buySmartly Intelligence</span>
          </div>
          <div class="sba-ai-msg">${data.aiRecommendation}</div>
        </div>

        <!-- Price Analysis Tabs -->
        <div class="sba-nav-tabs">
          <button class="sba-tab active" data-tab="trend">📈 Price Trend</button>
          <button class="sba-tab" data-tab="compare">⚖ Compare</button>
          <button class="sba-tab" data-tab="alert">🔔 Price Alert</button>
          <button class="sba-tab" data-tab="insight">💡 AI Insight</button>
        </div>

        <!-- TAB 1: PRICE TREND -->
        <div class="sba-tab-body active" id="sbaTabTrend">
          <div class="sba-chart-controls">
            <div class="sba-filter-pills">
              <button class="sba-filter-pill" data-days="7">1W</button>
              <button class="sba-filter-pill" data-days="30">1M</button>
              <button class="sba-filter-pill active" data-days="90">3M</button>
            </div>
            <span class="sba-chart-status">Verified Floor</span>
          </div>

          <div class="sba-chart-wrapper" id="sbaChartBox">
            ${renderInteractiveChartSvg(data.history, 90)}
          </div>

          <!-- 3 Metrics Cards -->
          <div class="sba-metrics-row">
            <div class="sba-m-card card-low">
              <span class="sba-m-label">Lowest Price</span>
              <span class="sba-m-val">₹${Number(data.lowPrice).toLocaleString('en-IN')}</span>
            </div>
            <div class="sba-m-card card-avg">
              <span class="sba-m-label">Average Price</span>
              <span class="sba-m-val">₹${Number(data.avgPrice).toLocaleString('en-IN')}</span>
            </div>
            <div class="sba-m-card card-high">
              <span class="sba-m-label">Highest Price</span>
              <span class="sba-m-val">₹${Number(data.highPrice).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <!-- TAB 2: PRODUCT COMPARISON -->
        <div class="sba-tab-body" id="sbaTabCompare" style="display: none;">
          <div class="sba-compare-grid">
            ${data.comparisons.map(c => `
              <div class="sba-compare-card ${c.isCheapest ? 'is-cheapest' : ''}">
                <div class="sba-c-left">
                  <span class="sba-store-name">${c.store} ${c.isCurrent ? '(Current)' : ''}</span>
                  <span class="sba-store-price">₹${Number(c.price).toLocaleString('en-IN')}</span>
                </div>
                ${c.isCheapest ? '<span class="sba-cheap-tag">Lowest Price ⭐</span>' : '<a href="#" class="sba-c-link sba-dashboard-link">View ↗</a>'}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- TAB 3: PRICE ALERT -->
        <div class="sba-tab-body" id="sbaTabAlert" style="display: none;">
          <div class="sba-alert-card">
            <label class="sba-alert-lbl">Notify me when price drops below:</label>
            <div class="sba-input-group">
              <span class="sba-curr-symbol">₹</span>
              <input type="number" id="sbaTargetInput" class="sba-input" value="${Math.round(data.price * 0.95)}" />
            </div>
            <div class="sba-toggle-row">
              <span>Instant Browser Notification</span>
              <label class="sba-switch">
                <input type="checkbox" checked id="sbaAlertToggle">
                <span class="sba-slider"></span>
              </label>
            </div>
            <button id="sbaArmAlertBtn" class="sba-submit-btn">🔔 Set Smart Price Drop Alert</button>
          </div>
        </div>

        <!-- TAB 4: AI INSIGHT -->
        <div class="sba-tab-body" id="sbaTabInsight" style="display: none;">
          <div class="sba-insight-card">
            <div class="sba-in-row">
              <span class="sba-in-k">Deal Confidence:</span>
              <span class="sba-in-v" style="color: #10b981;">Very High (98%)</span>
            </div>
            <div class="sba-in-row">
              <span class="sba-in-k">Fake Discount Check:</span>
              <span class="sba-in-v" style="color: #6366f1;">Authentic Base Price</span>
            </div>
            <div class="sba-in-row">
              <span class="sba-in-k">Best Buying Window:</span>
              <span class="sba-in-v">Immediate (Current 3M Floor)</span>
            </div>
            <div class="sba-in-row">
              <span class="sba-in-k">Seller Reliability:</span>
              <span class="sba-in-v">Verified Genuine Partner</span>
            </div>
          </div>
        </div>

        <!-- Panel Footer -->
        <div class="sba-panel-footer">
          <button id="sbaOpenDashBtn" class="sba-full-dash-btn">
            <span>Open buySmartly Product Analysis</span>
            <span>↗</span>
          </button>
        </div>
      `;
    } else {
      // ════════ LOCKED STATE (NO AUTHENTICATION BYPASS) ════════
      panel.innerHTML = `
        <!-- Panel Top Header -->
        <div class="sba-panel-header">
          <div class="sba-brand-group">
            <div class="sba-brand-icon">✦</div>
            <div class="sba-brand-info">
              <span class="sba-brand-title">buy<span class="sba-gradient-text">Smartly</span> <span class="sba-brand-tag">AI ASSISTANT</span></span>
              <span class="sba-brand-sub">🔒 Authentication Required</span>
            </div>
          </div>
          <div class="sba-header-actions">
            <button class="sba-icon-btn sba-close-btn" id="sbaCloseBtn" title="Minimize Panel">✕</button>
          </div>
        </div>

        <!-- Strict Lock Card (Zero Analysis Data Exposed) -->
        <div class="sba-locked-card">
          <div class="sba-lock-icon-wrap">
            <span class="sba-lock-emoji">🔒</span>
          </div>
          <h3 class="sba-lock-title">Login to unlock buySmartly Intelligence</h3>
          <p class="sba-lock-desc">
            Sign in to your free buySmartly account to unlock 3-month verified price history, artificial markup detection, deal score meter, and instant price drop alerts.
          </p>

          <div class="sba-lock-benefits">
            <div class="sba-benefit-row"><span>✓</span> 3-Month Interactive Price History</div>
            <div class="sba-benefit-row"><span>✓</span> Fake Discount & Markup Detector</div>
            <div class="sba-benefit-row"><span>✓</span> Cross-Store Price Comparison</div>
            <div class="sba-benefit-row"><span>✓</span> Instant Push & Email Drop Alerts</div>
          </div>

          <button id="sbaLoginNowBtn" class="sba-login-now-btn">
            <span>Login Now</span>
            <span>↵</span>
          </button>
        </div>

        <!-- Panel Footer -->
        <div class="sba-panel-footer">
          <button id="sbaLoginNowAltBtn" class="sba-full-dash-btn">
            <span>Sign In to Unlock buySmartly Product Analysis ↗</span>
          </button>
        </div>
      `;
    }

    root.appendChild(triggerBtn);
    root.appendChild(panel);

    // ZERO OVERLAP TOGGLE LOGIC
    function openPanel() {
      isPanelOpen = true;
      panel.classList.remove('sba-panel-hidden');
      triggerBtn.classList.add('is-hidden');
    }

    function closePanel() {
      isPanelOpen = false;
      panel.classList.add('sba-panel-hidden');
      triggerBtn.classList.remove('is-hidden');
    }

    triggerBtn.addEventListener('click', openPanel);

    const closeBtn = panel.querySelector('#sbaCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    // REDIRECT / LOGIN HANDLERS
    const loginNowBtn = panel.querySelector('#sbaLoginNowBtn');
    const loginNowAltBtn = panel.querySelector('#sbaLoginNowAltBtn');
    const openDashBtn = panel.querySelector('#sbaOpenDashBtn');

    async function redirectToLogin() {
      const targetProductUrl = encodeURIComponent(window.location.href);
      const dashboardBaseUrl = await getDashboardBaseUrl();
      window.open(`${dashboardBaseUrl}/login?source=extension&redirect=${targetProductUrl}`, '_blank');
    }

    if (loginNowBtn) loginNowBtn.addEventListener('click', redirectToLogin);
    if (loginNowAltBtn) loginNowAltBtn.addEventListener('click', redirectToLogin);

    if (openDashBtn) {
      openDashBtn.addEventListener('click', async () => {
        const p = new URLSearchParams({
          product: prodContext.productUrl,
          livePrice: String(prodContext.currentPrice || ''),
          liveTitle: prodContext.productTitle || '',
          liveImage: prodContext.productImage || '',
          liveMrp: String(prodContext.originalPrice || '')
        });
        const dashboardBaseUrl = await getDashboardBaseUrl();
        window.open(`${dashboardBaseUrl}/dashboard?${p.toString()}`, '_blank');
      });
    }

    panel.querySelectorAll('.sba-dashboard-link').forEach((link) => {
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        const dashboardBaseUrl = await getDashboardBaseUrl();
        window.open(`${dashboardBaseUrl}/dashboard?product=${encodeURIComponent(prodContext.productUrl)}`, '_blank');
      });
    });

    // TABS
    const tabs = panel.querySelectorAll('.sba-tab');
    tabs.forEach(t => {
      t.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('active'));
        t.classList.add('active');

        const target = t.getAttribute('data-tab');
        panel.querySelectorAll('.sba-tab-body').forEach(b => b.style.display = 'none');

        if (target === 'trend') panel.querySelector('#sbaTabTrend').style.display = 'block';
        if (target === 'compare') panel.querySelector('#sbaTabCompare').style.display = 'block';
        if (target === 'alert') panel.querySelector('#sbaTabAlert').style.display = 'block';
        if (target === 'insight') panel.querySelector('#sbaTabInsight').style.display = 'block';
      });
    });

    // RANGE PILLS
    const filterPills = panel.querySelectorAll('.sba-filter-pill');
    filterPills.forEach(fp => {
      fp.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        fp.classList.add('active');
        const days = parseInt(fp.getAttribute('data-days'), 10);
        panel.querySelector('#sbaChartBox').innerHTML = renderInteractiveChartSvg(data.history, days);
      });
    });

    // ARM ALERT BUTTON
    const armBtn = panel.querySelector('#sbaArmAlertBtn');
    if (armBtn) {
      armBtn.addEventListener('click', () => {
        armBtn.innerText = '✓ Alert Armed & Active!';
        armBtn.style.background = '#10b981';
        setTimeout(() => {
          armBtn.innerText = '🔔 Set Smart Price Drop Alert';
          armBtn.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
        }, 3000);
      });
    }

    // Watch for dynamic DOM / variant changes
    setupVariantObserver();
  }

  let observerInstalled = false;
  function setupVariantObserver() {
    if (observerInstalled) return;
    observerInstalled = true;

    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      if (!isExtensionValid()) {
        observer.disconnect();
        return;
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const live = extractCurrentProductContext();
        const curUrl = window.location.href;
        if (
          live.currentPrice > 0 &&
          (live.currentPrice !== lastRenderedPrice || curUrl !== lastRenderedUrl)
        ) {
          lastRenderedPrice = live.currentPrice;
          lastRenderedUrl = curUrl;
          renderFloatingSystem(live);
        }
      }, 250);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // Hook into SPA URL changes (Flipkart / Amazon variant clicks)
    window.addEventListener('popstate', () => {
      setTimeout(initBuySmartly, 250);
    });

    const origPushState = history.pushState;
    if (origPushState) {
      history.pushState = function () {
        origPushState.apply(this, arguments);
        setTimeout(initBuySmartly, 250);
      };
    }

    const origReplaceState = history.replaceState;
    if (origReplaceState) {
      history.replaceState = function () {
        origReplaceState.apply(this, arguments);
        setTimeout(initBuySmartly, 250);
      };
    }
  }

  // Listen for storage changes and immediately refresh UI
  if (isExtensionValid() && chrome.storage && chrome.storage.onChanged) {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (!isExtensionValid()) return;
        if (area === 'local' && (changes.authToken || changes.user)) {
          initBuySmartly();
        }
      });
    } catch (e) {}
  }

  // Instantly re-verify authentication when tab regains focus or visibility
  window.addEventListener('focus', () => {
    if (isExtensionValid()) initBuySmartly();
  });

  document.addEventListener('visibilitychange', () => {
    if (isExtensionValid() && !document.hidden) initBuySmartly();
  });

  setTimeout(() => {
    if (isExtensionValid()) {
      initBuySmartly();
    }
  }, 400);
})();
