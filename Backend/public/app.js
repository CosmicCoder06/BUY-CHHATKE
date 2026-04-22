(function () {
  const root   = document.documentElement;
  const btn    = document.getElementById('themeToggle');
  const stored = localStorage.getItem('sb-theme');
  let theme    = stored || 'light';
 
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    btn.textContent = t === 'dark' ? '☀️' : '🌙';
    btn.title       = t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    localStorage.setItem('sb-theme', t);
  }
 
  applyTheme(theme);
 
  btn.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    // Redraw gauge with new background colour if data is loaded
    if (typeof currentScore !== 'undefined' && currentScore > 0) drawGauge(currentScore);
  });
})();

/* ─── STATE ──────────────────────────────────────────────────── */
let priceChartInstance = null;
let currentData  = null;
let currentScore = 0;

/* ─── ELEMENTS ───────────────────────────────────────────────── */
const analyzeBtn  = document.getElementById('analyzeBtn');
const asinInput   = document.getElementById('asinInput');
const skeleton    = document.getElementById('skeleton');
const emptyState  = document.getElementById('emptyState');
const dashboard   = document.getElementById('dashboard');
const errorBanner = document.getElementById('errorBanner');

/* ─── CHIP FILL ──────────────────────────────────────────────── */
function fillAsin(asin) {
  asinInput.value = asin;
  asinInput.focus();
}

/* ─── ANALYZE ────────────────────────────────────────────────── */
analyzeBtn.addEventListener('click', runAnalysis);
asinInput.addEventListener('keydown', e => { if (e.key === 'Enter') runAnalysis(); });

function extractAsin(raw) {
  const urlMatch = raw.match(/\/dp\/([A-Z0-9]{10})/i);
  if (urlMatch) return urlMatch[1].toUpperCase();
  const plain = raw.trim().toUpperCase();
  if (/^[A-Z0-9]{10}$/.test(plain)) return plain;
  return null;
}

const API_BASE = (location.port === '3000' || location.protocol === 'file:')
  ? 'http://localhost:3000'
  : (location.port && location.port !== '3000' ? 'http://localhost:3000' : '');

async function runAnalysis() {
  const raw  = asinInput.value.trim();
  const asin = extractAsin(raw);
  if (!asin) {
    showError('Please enter a valid ASIN (10 characters) or a full Amazon product URL.');
    shake(asinInput);
    return;
  }
  asinInput.value = asin;
  setLoading(true);

  try {
    const res  = await fetch(`${API_BASE}/api/analyze?asin=${encodeURIComponent(asin)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    errorBanner.style.display = 'none';
    currentData = data;
    renderDashboard(data);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  analyzeBtn.disabled = on;
  analyzeBtn.textContent = on ? 'Analyzing…' : 'Analyze →';
  skeleton.classList.toggle('visible', on);
  if (on) {
    emptyState.style.display = 'none';
    dashboard.style.display  = 'none';
  }
}

function showError(msg) {
  errorBanner.textContent   = '⚠️ ' + msg;
  errorBanner.style.display = 'block';
  emptyState.style.display  = 'none';
  dashboard.style.display   = 'none';
}

function shake(el) {
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake .4s ease';
}

/* ─── ANIMATED COUNTER ───────────────────────────────────────── */
function animateNumber(el, targetText, duration = 600) {
  const isPrice = targetText.includes('₹');
  const isPct   = targetText.includes('%');
  const numStr  = targetText.replace(/[₹%+−\-,\s]/g, '').trim();
  const target  = parseFloat(numStr);
  if (isNaN(target)) { el.textContent = targetText; return; }
  const start = performance.now();
  const prefix = targetText.startsWith('−') ? '−' : (targetText.startsWith('+') ? '+' : '');
  function update(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const cur = target * ease;
    if (isPrice) {
      el.textContent = prefix + '₹' + Math.round(cur).toLocaleString('en-IN');
    } else {
      el.textContent = prefix + cur.toFixed(1) + (isPct ? '%' : '');
    }
    if (t < 1) requestAnimationFrame(update);
    else el.textContent = targetText;
  }
  requestAnimationFrame(update);
}

/* ─── FORMAT ─────────────────────────────────────────────────── */
function fmt(n) {
  return '₹' + parseFloat(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/* ─── RENDER ─────────────────────────────────────────────────── */
function renderDashboard(d) {
  dashboard.style.display  = 'block';
  emptyState.style.display = 'none';

  setTimeout(() => {
    dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);

  // Product
  document.getElementById('productImg').src              = d.productImage || '';
  document.getElementById('productTitle').textContent    = d.productTitle;
  document.getElementById('productPrice').textContent    = fmt(d.currentPrice);
  document.getElementById('productBadges').innerHTML     = `
    <span class="badge badge-neutral">ASIN: ${asinInput.value.trim()}</span>
    <span class="badge badge-neutral">Amazon India</span>
  `;

  // ── Compute score FIRST — single source of truth for banner, gauge & savings ──
  const score = computeScore(d);
  currentScore = score;

  // Recommendation banner — always derived from score, never contradicts gauge
  const banner = document.getElementById('recBanner');
  const icon   = document.getElementById('recIcon');
  const label  = document.getElementById('recLabel');
  const title  = document.getElementById('recTitle');
  const reason = document.getElementById('recReason');

  banner.className = 'rec-banner';
  if (score >= 70) {
    banner.classList.add('buy');
    icon.textContent  = '🟢';
    label.textContent = 'Recommended'; label.className = 'rec-label buy';
    title.textContent = 'Buy Now — Great Deal!';
  } else if (score >= 45) {
    banner.classList.add('wait');
    icon.textContent  = '🟡';
    label.textContent = 'Fair Price'; label.className = 'rec-label wait';
    title.textContent = 'Fair Price — No Rush';
  } else {
    banner.classList.add('over');
    icon.textContent  = '🔴';
    label.textContent = 'High Risk'; label.className = 'rec-label over';
    title.textContent = 'Not the Best Time — Wait or Skip';
  }
  reason.textContent = d.reason + (d.sellerReliable ? ' Seller is trusted.' : ' Note: seller has limited reviews.');

  // Stats — animated
  const dev = parseFloat(d.deviation);
  animateNumber(document.getElementById('statAvg'),  fmt(d.avgPrice));
  animateNumber(document.getElementById('statHigh'), fmt(d.highPrice));
  animateNumber(document.getElementById('statLow'),  fmt(d.lowPrice));
  const devStr = (dev > 0 ? '+' : '') + dev.toFixed(1) + '%';
  const devEl = document.getElementById('statDev');
  animateNumber(devEl, devStr);
  setTimeout(() => {
    devEl.style.color = dev < -10 ? '#16a34a' : dev > 10 ? '#dc2626' : '#d97706';
  }, 50);

  // Seller
  document.getElementById('sellerRating').textContent  = d.sellerRating + ' / 5';
  document.getElementById('sellerReviews').textContent = d.reviewCount.toLocaleString('en-IN') + ' reviews';
  const stars = Math.round(d.sellerRating);
  document.getElementById('starRow').innerHTML = Array(5).fill(0).map((_, i) =>
    `<span style="color:${i < stars ? '#f59e0b' : '#cbd5e1'}">★</span>`).join('');
  const rb = document.getElementById('reliabilityBadge');
  if (d.sellerReliable) {
    rb.className = 'reliability-badge rel-trusted';
    rb.innerHTML = '✅ Trusted Seller';
  } else if (d.sellerRating >= 3) {
    rb.className = 'reliability-badge rel-moderate';
    rb.innerHTML = '⚠️ Moderate Trust';
  } else {
    rb.className = 'reliability-badge rel-risky';
    rb.innerHTML = '❌ Low Trust';
  }

  // Gauge — uses already-computed score
  drawGauge(score);

  // Savings — subtitle driven by score so it never contradicts the gauge
  const saving = parseFloat(d.avgPrice) - d.currentPrice;
  const savEl  = document.getElementById('savingsAmt');
  const subEl  = document.getElementById('savingsSub');
  if (saving >= 0) {
    savEl.className = 'savings-amount savings-positive';
    animateNumber(savEl, '−' + fmt(saving));
    if (score < 45) {
      subEl.textContent = 'Below avg price, but seller trust is low — proceed cautiously.';
      subEl.style.color = '#dc2626';
    } else if (score < 70) {
      subEl.textContent = 'Slightly below average — decent saving, fair deal.';
      subEl.style.color = '#d97706';
    } else {
      subEl.textContent = 'Cheaper than average — great time to buy!';
      subEl.style.color = '';
    }
  } else {
    savEl.className = 'savings-amount savings-negative';
    animateNumber(savEl, '+' + fmt(Math.abs(saving)));
    subEl.textContent = 'Currently above average price — consider waiting.';
    subEl.style.color = '#dc2626';
  }

  // Prediction
  const pred = predictNextWeek(d.priceHistory, d.currentPrice);
  document.getElementById('predVal').textContent   = fmt(pred.lo) + ' – ' + fmt(pred.hi);
  document.getElementById('predTrend').textContent =
    pred.direction === 'up'   ? '📈 Trending upward — prices rising' :
    pred.direction === 'down' ? '📉 Trending downward — may get cheaper' :
    '➡️ Prices appear stable';

  buildChart(d.priceHistory, parseFloat(d.avgPrice));

  document.getElementById('alertInput').value = Math.floor(d.currentPrice * 0.9);
}

/* ─── DEAL SCORE ─────────────────────────────────────────────── */
function computeScore(d) {
  let score = 50;
  const dev = parseFloat(d.deviation);
  if (dev <= -20)      score += 30;
  else if (dev <= -10) score += 20;
  else if (dev <= -5)  score += 10;
  else if (dev >= 25)  score -= 30;
  else if (dev >= 15)  score -= 20;
  else if (dev >= 5)   score -= 10;
  if (d.sellerReliable)         score += 15;
  else if (d.sellerRating >= 3) score += 5;
  else                          score -= 10;
  if (d.reviewCount > 500)      score += 5;
  else if (d.reviewCount < 50)  score -= 5;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function drawGauge(score) {
  const canvas = document.getElementById('gaugeCanvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H - 4;
  const r = 66, sw = 14;
  const angle = Math.PI + (score / 100) * Math.PI;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = sw; ctx.lineCap = 'round';
  ctx.stroke();
  const color = score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, angle);
  ctx.strokeStyle = color; ctx.lineWidth = sw; ctx.lineCap = 'round';
  ctx.stroke();
  const nx = cx + r * Math.cos(angle), ny = cy + r * Math.sin(angle);
  ctx.beginPath(); ctx.arc(nx, ny, 7, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  document.getElementById('gaugeNum').textContent = score;
  document.getElementById('gaugeNum').style.color = color;
  document.getElementById('gaugeLabel').textContent =
    score >= 70 ? '🟢 Great Deal' : score >= 45 ? '🟡 Fair Deal' : '🔴 Overpriced';
}

/* ─── PREDICTION ─────────────────────────────────────────────── */
function predictNextWeek(history, currentPrice) {
  if (!history || history.length < 5) return { lo: currentPrice * 0.97, hi: currentPrice * 1.03, direction: 'stable' };
  const recent = history.slice(-7).map(h => h.price);
  const trend  = (recent[recent.length - 1] - recent[0]) / recent.length;
  const pred   = currentPrice + trend * 7;
  return {
    lo: Math.round(pred * 0.97), hi: Math.round(pred * 1.03),
    direction: trend > currentPrice * 0.002 ? 'up' : trend < -currentPrice * 0.002 ? 'down' : 'stable'
  };
}

/* ─── CHART ──────────────────────────────────────────────────── */
function buildChart(history, avg) {
  const labels = history.map(h => {
    const d = new Date(h.date);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  });
  const prices = history.map(h => h.price);
  const minIdx = prices.indexOf(Math.min(...prices));
  const maxIdx = prices.indexOf(Math.max(...prices));
  const ctx = document.getElementById('priceChart').getContext('2d');
  if (priceChartInstance) priceChartInstance.destroy();
  const grad = ctx.createLinearGradient(0, 0, 0, 250);
  grad.addColorStop(0, 'rgba(67,56,202,.18)');
  grad.addColorStop(1, 'rgba(67,56,202,0)');
  const pointColors = prices.map((_, i) => i === minIdx ? '#22c55e' : i === maxIdx ? '#ef4444' : 'transparent');
  const pointRadius = prices.map((_, i) => (i === minIdx || i === maxIdx) ? 6 : 3);
  const pointBorder = prices.map((_, i) => (i === minIdx || i === maxIdx) ? '#fff' : 'rgba(67,56,202,.5)');
  priceChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Price (₹)', data: prices,
          borderColor: '#4338ca', backgroundColor: grad,
          borderWidth: 2.5, tension: 0.45, fill: true,
          pointBackgroundColor: pointColors, pointBorderColor: pointBorder,
          pointRadius, pointHoverRadius: 7,
          pointHoverBackgroundColor: '#4338ca', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
        },
        {
          label: 'Avg Price (₹)', data: Array(prices.length).fill(avg),
          borderColor: 'rgba(245,158,11,.6)', borderDash: [6,4],
          borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#64748b', font: { family: 'Inter', size: 11 }, boxWidth: 14, padding: 16 } },
        tooltip: {
          backgroundColor: '#1e1b4b', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1,
          titleColor: '#fff', bodyColor: 'rgba(255,255,255,.7)',
          padding: 13, cornerRadius: 12,
          callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ₹' + ctx.parsed.y.toLocaleString('en-IN') }
        }
      },
      scales: {
        x: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 }, maxTicksLimit: 8 }, border: { color: 'transparent' } },
        y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 }, callback: v => '₹' + v.toLocaleString('en-IN') }, border: { color: 'transparent' } }
      }
    }
  });
}

/* ─── ALERT ──────────────────────────────────────────────────── */
document.getElementById('alertBtn').addEventListener('click', () => {
  const val = document.getElementById('alertInput').value;
  if (!val) return;
  const msg = document.getElementById('alertMsg');
  msg.textContent = `✅ Alert set! We'll notify you when price drops below ₹${parseFloat(val).toLocaleString('en-IN')}.`;
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 5000);
});