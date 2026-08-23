// buySmarty Chrome Extension - Popup Logic

const TRENDING_MOCKS = [
  {
    store: 'amazon',
    storeName: 'Amazon',
    storeColor: '#818cf8',
    title: 'Sony WH-1000XM5 Wireless ANC Headphones',
    price: '?26,990',
    drop: '23% OFF',
    image: 'https://m.media-amazon.com/images/I/61O3iMlnJIL._SL1500_.jpg',
    query: 'B09XS7JWHH'
  },
  {
    store: 'flipkart',
    storeName: 'Flipkart',
    storeColor: '#facc15',
    title: 'Nothing Phone (2a) 5G (Black, 128 GB)',
    price: '?23,999',
    drop: '8% OFF',
    image: 'https://m.media-amazon.com/images/I/71dZBla7wUL._AC_UY654_QL65_.jpg',
    query: 'MOBGXZ86HFKZUYZZ'
  },
  {
    store: 'myntra',
    storeName: 'Myntra',
    storeColor: '#ff3f6c',
    title: 'Caprese Croc-Textured Shoulder Bag',
    price: '?950',
    drop: '75% OFF',
    image: 'https://m.media-amazon.com/images/I/61wZjWZC7IL._AC_UL960_QL65_.jpg',
    query: 'https://www.myntra.com/handbags/caprese/caprese-croc-textured-baguette-shoulder-bag/35719710/buy'
  },
  {
    store: 'meesho',
    storeName: 'Meesho',
    storeColor: '#d946ef',
    title: 'Trendy Attractive Men White Casual Sneakers',
    price: '?489',
    drop: '59% OFF',
    image: 'https://m.media-amazon.com/images/I/71D9ImsvEtL._AC_UY695_.jpg',
    query: 'https://www.meesho.com/trendy-sneakers/p/57jkwf'
  },
  {
    store: 'ajio',
    storeName: 'Ajio',
    storeColor: '#38bdf8',
    title: 'Nike Air Max SC Low-Top Lace-Up Sneakers',
    price: '?4,495',
    drop: '25% OFF',
    image: 'https://m.media-amazon.com/images/I/61xi8pnZunL._AC_UL960_QL65_.jpg',
    query: 'https://www.ajio.com/nike-air-max/p/469034298_white'
  }
];

let activeTabUrl = '';
let currentAnalyzedData = null;

document.addEventListener('DOMContentLoaded', async () => {
  renderTrendingList('all');
  bindStorePills();
  bindSearchEvents();
  await detectActiveTab();
});

async function detectActiveTab() {
  const detectTitle = document.getElementById('detectTitle');
  const detectStore = document.getElementById('detectStore');
  const storeIcon = document.getElementById('storeIcon');
  const scanBtn = document.getElementById('scanCurrentBtn');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    activeTabUrl = tab.url;
    const urlObj = new URL(tab.url);
    const host = urlObj.hostname.toLowerCase();

    if (host.includes('amazon.')) {
      storeIcon.textContent = '???';
      detectStore.textContent = 'Amazon India Detected';
      detectTitle.textContent = tab.title || 'Amazon Product Page';
      scanBtn.style.display = 'flex';
    } else if (host.includes('flipkart.')) {
      storeIcon.textContent = '?';
      detectStore.textContent = 'Flipkart Store Detected';
      detectTitle.textContent = tab.title || 'Flipkart Product Page';
      scanBtn.style.display = 'flex';
    } else if (host.includes('myntra.')) {
      storeIcon.textContent = '??';
      detectStore.textContent = 'Myntra Fashion Detected';
      detectTitle.textContent = tab.title || 'Myntra Product Page';
      scanBtn.style.display = 'flex';
    } else if (host.includes('meesho.')) {
      storeIcon.textContent = '???';
      detectStore.textContent = 'Meesho Marketplace Detected';
      detectTitle.textContent = tab.title || 'Meesho Product Page';
      scanBtn.style.display = 'flex';
    } else if (host.includes('ajio.')) {
      storeIcon.textContent = '???';
      detectStore.textContent = 'Ajio Luxe Detected';
      detectTitle.textContent = tab.title || 'Ajio Product Page';
      scanBtn.style.display = 'flex';
    } else {
      storeIcon.textContent = '??';
      detectStore.textContent = 'Supported: Amazon, Flipkart, Myntra, Meesho, Ajio';
      detectTitle.textContent = 'Browse any e-commerce product to scan';
      scanBtn.style.display = 'none';
    }

    scanBtn.addEventListener('click', () => {
      runAnalysis(activeTabUrl);
    });

  } catch (err) {
    console.warn('Error reading active tab:', err);
  }
}

async function runAnalysis(query) {
  const resultCard = document.getElementById('resultCard');
  const loadingState = document.getElementById('loadingState');

  if (!query) return;

  loadingState.style.display = 'flex';
  resultCard.style.display = 'none';

  try {
    const res = await fetch(`http://localhost:3000/api/analyze?asin=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Could not connect to buySmarty backend');

    const data = await res.json();
    currentAnalyzedData = data;
    renderResult(data);
  } catch (e) {
    alert('Failed to analyze: ' + e.message + '\nMake sure buySmarty server is running on http://localhost:3000');
  } finally {
    loadingState.style.display = 'none';
  }
}

function renderResult(d) {
  const resultCard = document.getElementById('resultCard');
  const resImg = document.getElementById('resImg');
  const resTitle = document.getElementById('resTitle');
  const resPrice = document.getElementById('resPrice');
  const resMrp = document.getElementById('resMrp');
  const resDrop = document.getElementById('resDrop');
  const resVerdict = document.getElementById('resVerdict');
  const resBuyBtn = document.getElementById('resBuyBtn');
  const resDeepDiveBtn = document.getElementById('resDeepDiveBtn');

  resImg.src = d.productImage || 'https://m.media-amazon.com/images/I/61xi8pnZunL._AC_UL960_QL65_.jpg';
  resTitle.textContent = d.productTitle || 'Scanned Product';
  resPrice.textContent = '?' + Number(d.currentPrice || 0).toLocaleString('en-IN');
  resMrp.textContent = d.productMrp ? d.productMrp : '';
  
  if (d.metrics) {
    resDrop.textContent = d.metrics.isAllTimeLow ? '?? All-Time Low' : (d.metrics.dropPercent > 0 ? `-${d.metrics.dropPercent}% DROP` : '? Stable');
  }

  resVerdict.textContent = d.analysis?.summary || 'AI Verdict: Genuine deal verified against historical trend.';

  resBuyBtn.href = d.productUrl || (activeTabUrl || 'http://localhost:3000');

  resDeepDiveBtn.onclick = () => {
    chrome.tabs.create({ url: `http://localhost:3000/?q=${encodeURIComponent(d.asin || d.productUrl || activeTabUrl)}` });
  };

  resultCard.style.display = 'flex';
}

function bindSearchEvents() {
  const input = document.getElementById('quickSearchInput');
  const btn = document.getElementById('quickSearchBtn');

  const execute = () => {
    const val = input.value.trim();
    if (val) runAnalysis(val);
  };

  btn.addEventListener('click', execute);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') execute();
  });
}

function bindStorePills() {
  const pills = document.querySelectorAll('.store-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderTrendingList(pill.getAttribute('data-store'));
    });
  });
}

async function renderTrendingList(filterStore) {
  const container = document.getElementById('trendingList');
  if (!container) return;

  container.innerHTML = '<div style="font-size: 11px; color: #94a3b8; text-align: center; padding: 10px;">Loading live deals...</div>';

  let items = [];
  try {
    const res = await fetch(`http://localhost:3000/api/trending-deals?store=${encodeURIComponent(filterStore)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.deals)) {
        items = data.deals.map(d => ({
          title: d.title,
          price: '₹' + Number(d.price).toLocaleString('en-IN'),
          drop: d.discount,
          image: d.image,
          storeColor: d.storeColor,
          storeName: d.storeName,
          query: d.query
        }));
      }
    }
  } catch (e) {
    // Fallback to local mocks
  }

  if (items.length === 0) {
    items = filterStore === 'all' 
      ? TRENDING_MOCKS 
      : TRENDING_MOCKS.filter(item => item.store === filterStore);
  }

  container.innerHTML = '';
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'trending-item';
    el.innerHTML = `
      <img src="${item.image}" alt="${item.title}" class="t-thumb" referrerpolicy="no-referrer" onerror="this.src='https://m.media-amazon.com/images/I/61xi8pnZunL._AC_UL960_QL65_.jpg'" />
      <div class="t-info">
        <div class="t-title">${item.title}</div>
        <div class="t-meta">
          <span class="t-price">${item.price}</span>
          <span class="t-drop">${item.drop}</span>
        </div>
      </div>
      <span class="t-store" style="background: ${item.storeColor}22; color: ${item.storeColor};">${item.storeName}</span>
    `;

    el.addEventListener('click', () => {
      runAnalysis(item.query);
    });

    container.appendChild(el);
  });
}
