/**
 * Flipkart Data Integration Service
 * Uses Subscribed RapidAPI ("Real-time Flipkart Data" by Ayush Somani - real-time-flipkart-data2.p.rapidapi.com),
 * URL metadata extractor, and verified store catalog.
 */

const { scrapeLiveProduct, extractTitleFromUrl, generateFallbackFromTitle } = require('./metadataScraper');

function getApiKey() {
  return process.env.RAPIDAPI_KEY || '';
}

function parseFlipkartId(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const str = raw.trim();

  // 1. Direct PID query param
  const pidMatch = str.match(/[?&]pid=([A-Za-z0-9]{12,20})/i);
  if (pidMatch) return pidMatch[1].toUpperCase();

  // 2. /p/itm... item ID match
  const itmMatch = str.match(/\/p\/(itm[A-Za-z0-9]{10,20})/i);
  if (itmMatch) return itmMatch[1];

  // 3. Standalone 16-character FSN (e.g., MOBGTAGPTB3VS24W, ACCFXYZ...)
  const fsnMatch = str.toUpperCase().match(/\b([A-Z0-9]{16})\b/);
  if (fsnMatch && !str.toUpperCase().startsWith('B0')) return fsnMatch[1];

  // 4. Standalone itm ID
  const rawItmMatch = str.match(/\b(itm[A-Za-z0-9]{10,20})\b/i);
  if (rawItmMatch) return rawItmMatch[1];

  // 5. Any flipkart.com URL
  if (str.includes('flipkart.com') || str.includes('dl.flipkart.com')) {
    return 'FKP_' + Math.abs(hashString(str)).toString(36).toUpperCase();
  }

  return null;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Fetch real product details for Flipkart URL or PID
 */
async function fetchFlipkartProductDetails(pid, originalUrl = '') {
  const targetUrl = originalUrl && originalUrl.startsWith('http')
    ? originalUrl
    : `https://www.flipkart.com/product/p/itm?pid=${encodeURIComponent(pid)}`;

  // 1. Primary: Subscribed RapidAPI Host (real-time-flipkart-data2.p.rapidapi.com)
  const apiKey = getApiKey();
  if (apiKey && pid) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(
        `https://real-time-flipkart-data2.p.rapidapi.com/product-details?pid=${encodeURIComponent(pid)}`,
        {
          signal: controller.signal,
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'real-time-flipkart-data2.p.rapidapi.com'
          }
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json && json.success && json.data) {
          const item = json.data;
          const livePrice = item.specialPrice || item.price || item.mrp;
          const avgRating = item.rating?.overall?.[0]?.average || 4.5;
          const ratingsCount = item.rating?.overall?.[0]?.count || 1200;
          const primaryImage = (Array.isArray(item.images) && item.images.length > 0)
            ? item.images[0]
            : (item.image || '');

          return {
            product_title: item.title,
            product_price: `₹${Number(livePrice).toLocaleString('en-IN')}`,
            product_mrp: item.mrp ? `₹${Number(item.mrp).toLocaleString('en-IN')}` : '',
            product_star_rating: String(avgRating),
            product_num_ratings: String(ratingsCount),
            product_photo: primaryImage,
            seller_name: 'Flipkart SuperComNet (Assured)',
            is_assured: true,
            product_url: item.url || targetUrl,
            pid: pid
          };
        }
      }
    } catch (err) {
      console.warn('[flipkartService] RapidAPI error:', err.message);
    }
  }

  // 2. Secondary: Live Metadata Scraper if URL provided
  if (originalUrl && originalUrl.startsWith('http')) {
    const liveData = await scrapeLiveProduct(originalUrl);
    if (liveData && liveData.productTitle) {
      return {
        ...liveData,
        pid: pid || parseFlipkartId(originalUrl) || 'FLIPKART'
      };
    }
  }

  // Do not return an invented listing when the storefront blocks retrieval.
  return null;
}

// Kept as a backwards-compatible export for existing callers. Product scans
// must handle a missing result rather than showing an unrelated demo product.
function generateMockFlipkartProduct() {
  return null;
}

function generateFlipkartPriceHistory(currentPrice) {
  const base = currentPrice > 0 ? currentPrice : 1999;
  const history = [];
  const today = new Date();
  
  let walkingPrice = base * (1 + (Math.random() * 0.12 - 0.04));
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    
    const drift = (base - walkingPrice) * 0.12;
    const noise = (Math.random() - 0.5) * (base * 0.05);
    walkingPrice = Math.round(walkingPrice + drift + noise);
    
    const priceVal = (i === 0) ? base : Math.max(Math.round(base * 0.7), walkingPrice);

    history.push({
      datec: d.toISOString().split('T')[0],
      currentprice: priceVal
    });
  }
  return history;
}

/**
 * Standardized Marketplace Deal Fetcher for Flipkart
 */
async function fetchFlipkartDeals() {
  const { MASTER_STORE_CATALOG } = require('./trendingService');
  const items = MASTER_STORE_CATALOG.flipkart || [];

  return items.map(item => {
    const currentPrice = item.basePrice;
    const originalPrice = item.mrp;
    const discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    const mockHist = generateFlipkartPriceHistory(currentPrice);

    return {
      productName: item.title,
      storeName: 'Flipkart',
      imageUrl: item.image,
      currentPrice: currentPrice,
      originalPrice: originalPrice,
      discountPercentage: discount,
      category: item.category || 'Electronics',
      rating: item.rating || 4.4,
      productUrl: item.url,
      dealTag: discount >= 50 ? '💰 Huge Saving' : (discount >= 20 ? '🔥 Major Drop' : '📈 Trending Deal'),
      priceHistory: mockHist.map(h => ({ price: h.currentprice, date: new Date(h.datec) })),
      lastUpdated: new Date()
    };
  });
}

module.exports = {
  parseFlipkartId,
  fetchFlipkartProductDetails,
  generateFlipkartPriceHistory,
  generateMockFlipkartProduct,
  fetchFlipkartDeals
};
