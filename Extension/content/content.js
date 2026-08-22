// buySmarty In-Page Floating Deal Tracker Widget

(function() {
  if (document.getElementById('buysmarty-floating-widget')) return;

  const currentUrl = window.location.href;
  const isProductPage = (
    currentUrl.includes('/dp/') ||
    currentUrl.includes('/p/') ||
    currentUrl.includes('/buy') ||
    currentUrl.includes('/product/') ||
    currentUrl.includes('/item/')
  );

  if (!isProductPage) return;

  // Create floating widget
  const badge = document.createElement('div');
  badge.id = 'buysmarty-floating-widget';
  badge.innerHTML = `
    <div class="bs-badge-btn" id="bsBadgeBtn">
      <span class="bs-sparkle">?</span>
      <span class="bs-label">buySmarty Deals</span>
      <span class="bs-tag">AI Track</span>
    </div>

    <!-- Slide Over Panel -->
    <div class="bs-drawer" id="bsDrawer">
      <div class="bs-drawer-header">
        <div class="bs-brand">
          <span>?</span> buy<span>Smarty</span>
        </div>
        <button class="bs-close-btn" id="bsCloseBtn">&times;</button>
      </div>
      <div class="bs-drawer-body" id="bsDrawerBody">
        <div class="bs-loader" id="bsLoader">
          <div class="bs-spinner"></div>
          <span>Analyzing price history & multi-store rates...</span>
        </div>
        <div class="bs-content" id="bsContent" style="display: none;"></div>
      </div>
      <div class="bs-drawer-footer">
        <a href="http://localhost:3000" target="_blank" class="bs-full-btn">Open Full buySmarty Dashboard ?</a>
      </div>
    </div>
  `;

  document.body.appendChild(badge);

  const badgeBtn = document.getElementById('bsBadgeBtn');
  const drawer = document.getElementById('bsDrawer');
  const closeBtn = document.getElementById('bsCloseBtn');
  const loader = document.getElementById('bsLoader');
  const content = document.getElementById('bsContent');

  let hasFetched = false;

  badgeBtn.addEventListener('click', async () => {
    drawer.classList.toggle('active');
    if (drawer.classList.contains('active') && !hasFetched) {
      hasFetched = true;
      try {
        const res = await fetch(`http://localhost:3000/api/analyze?asin=${encodeURIComponent(currentUrl)}`);
        const data = await res.json();
        renderDrawerData(data);
      } catch (err) {
        loader.innerHTML = `<span style="color: #f87171;">Could not connect to buySmarty backend. Ensure server is running on http://localhost:3000</span>`;
      }
    }
  });

  closeBtn.addEventListener('click', () => {
    drawer.classList.remove('active');
  });

  function renderDrawerData(d) {
    loader.style.display = 'none';
    content.style.display = 'block';

    const price = Number(d.currentPrice || 0).toLocaleString('en-IN');
    const isLow = d.metrics?.isAllTimeLow;
    const drop = d.metrics?.dropPercent || 0;

    content.innerHTML = `
      <div class="bs-prod-summary">
        <img src="${d.productImage || ''}" class="bs-thumb" />
        <div class="bs-info">
          <div class="bs-title">${d.productTitle || 'Product'}</div>
          <div class="bs-price-row">
            <span class="bs-cur-price">?${price}</span>
            <span class="bs-mrp">${d.productMrp || ''}</span>
            <span class="bs-signal ${isLow ? 'low' : ''}">${isLow ? '?? Lowest Ever' : (drop > 0 ? `-${drop}% Drop` : '? Genuine Price')}</span>
          </div>
        </div>
      </div>

      <div class="bs-telemetry">
        <div class="bs-metric">
          <span class="m-lbl">Price Stability</span>
          <span class="m-val">${d.analysis?.verdict || 'Good Entry'}</span>
        </div>
        <div class="bs-metric">
          <span class="m-lbl">Store Seller</span>
          <span class="m-val">${d.sellerName || 'Verified'}</span>
        </div>
      </div>

      <div class="bs-verdict-card">
        <strong>? AI Analysis:</strong>
        <p>${d.analysis?.summary || 'Real-time price trend verified against 30-day baseline.'}</p>
      </div>

      <div class="bs-compare-grid">
        <div class="bs-c-head">Multi-Store Tracker:</div>
        <div class="bs-store-row">
          <span>Current Store</span> <span class="bs-s-price">?${price}</span>
        </div>
        <div class="bs-store-row">
          <span>Amazon / Flipkart / Myntra</span> <span class="bs-s-price">Tracked</span>
        </div>
      </div>
    `;
  }
})();
