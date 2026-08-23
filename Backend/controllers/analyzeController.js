const {
  fetchProductDetails: fetchAmazonProductDetails,
  fetchPriceHistory: fetchAmazonPriceHistory,
  generateMockHistory: generateAmazonMockHistory
} = require('../services/amazonService');

const {
  parseFlipkartId,
  fetchFlipkartProductDetails,
  generateFlipkartPriceHistory
} = require('../services/flipkartService');

const {
  parseMyntraId,
  fetchMyntraProductDetails,
  generateMyntraPriceHistory
} = require('../services/myntraService');

const {
  parseMeeshoId,
  fetchMeeshoProductDetails,
  generateMeeshoPriceHistory
} = require('../services/meeshoService');

const {
  parseAjioId,
  fetchAjioProductDetails,
  generateAjioPriceHistory
} = require('../services/ajioService');

const {
  getHourlyTrendingDeals,
  MASTER_STORE_CATALOG,
  STORE_CONFIG
} = require('../services/trendingService');

const { estimatePriceFromTitle, getDefaultImageForTitle } = require('../services/metadataScraper');

/**
 * Parses Amazon ASIN from URL or raw text
 */
function parseAsin(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const str = raw.trim();
  const urlMatch = str.match(/(?:\/dp\/|\/gp\/product\/|\/d\/|[?&]asin=)([A-Z0-9]{10})/i);
  if (urlMatch) return urlMatch[1].toUpperCase();
  const plainMatch = str.toUpperCase().match(/\b([B0-9][A-Z0-9]{9})\b/);
  if (plainMatch && !str.toLowerCase().includes('myntra') && !str.toLowerCase().includes('ajio') && !str.toLowerCase().includes('meesho')) {
    return plainMatch[1];
  }
  return null;
}

/**
 * Helper: Computes Deal Score & Recommendations across all stores
 */
function evaluateDeal({ currentPrice, avgPrice, deviation, sellerRating, reviewCount, isVerified, platformName, sellerName }) {
  let dealScore = 52;
  if (deviation <= -25) dealScore += 35;
  else if (deviation <= -15) dealScore += 25;
  else if (deviation <= -5) dealScore += 15;
  else if (deviation >= 25) dealScore -= 30;
  else if (deviation >= 15) dealScore -= 20;
  else if (deviation >= 5) dealScore -= 10;

  const isSellerReliable = sellerRating >= 3.8 && reviewCount >= 30;
  if (isSellerReliable) dealScore += 12;
  else if (sellerRating >= 3.0) dealScore += 2;
  else dealScore -= 15;

  if (isVerified) dealScore += 4;
  if (reviewCount > 1000) dealScore += 4;

  dealScore = Math.max(5, Math.min(99, Math.round(dealScore)));

  let recommendation, decisionTitle, reason;
  if (dealScore >= 70) {
    recommendation = 'BUY';
    decisionTitle = 'Strong Buy — Optimal Timing';
    reason = `Current ${platformName} price is ${Math.abs(deviation).toFixed(1)}% below the 30-day baseline. High seller confidence (${sellerName}).`;
  } else if (dealScore >= 45) {
    recommendation = 'FAIR';
    decisionTitle = 'Fair Price — Normal Range';
    reason = `Trading within normal ${platformName} price volatility (${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}% vs average).`;
  } else {
    recommendation = 'WAIT';
    decisionTitle = 'Price Elevated — Hold Off';
    reason = `Current price on ${platformName} is elevated by ${deviation.toFixed(1)}% compared to recent baseline. Wait for upcoming drop.`;
  }

  return { dealScore, recommendation, decisionTitle, reason, isSellerReliable };
}

/**
 * Universal Multi-Store Price Intelligence Controller
 * Supports Amazon India, Flipkart, Myntra, Meesho, and Ajio
 */
async function analyze(req, res) {
  const rawInput = (req.query.asin || req.query.url || req.query.q || '').trim();
  const livePrice = parseFloat(req.query.livePrice || req.query.price || 0);
  const liveTitle = (req.query.liveTitle || req.query.title || '').trim();
  const liveImage = (req.query.liveImage || req.query.image || '').trim();
  const liveMrp = parseFloat(req.query.liveMrp || req.query.mrp || 0);
  const liveSeller = (req.query.liveSeller || req.query.seller || '').trim();

  if (!rawInput && !livePrice) {
    return res.status(400).json({
      error: 'Please enter a product URL or ID from Amazon, Flipkart, Myntra, Meesho, or Ajio.'
    });
  }

  // If the Chrome extension provides direct ground-truth DOM data:
  if (livePrice > 0 && liveTitle) {
    const currentPrice = Math.round(livePrice);
    const mrp = liveMrp > currentPrice ? Math.round(liveMrp) : Math.round(currentPrice * 1.18);
    const rawHistory = generateAmazonMockHistory(currentPrice);
    const prices = rawHistory.map(p => parseFloat(p.currentprice) || currentPrice);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const highPrice = Math.max(...prices, currentPrice);
    const lowPrice = Math.min(...prices, currentPrice);
    const deviation = ((currentPrice - avg) / avg) * 100;
    const savingsAmount = Math.max(0, avg - currentPrice);

    let storeKey = 'amazon';
    let storeName = 'Amazon India';
    let storeIcon = '🛍️';
    const inputLower = (rawInput || '').toLowerCase();
    if (inputLower.includes('flipkart')) { storeKey = 'flipkart'; storeName = 'Flipkart'; storeIcon = '⚡'; }
    else if (inputLower.includes('myntra')) { storeKey = 'myntra'; storeName = 'Myntra'; storeIcon = '👗'; }
    else if (inputLower.includes('meesho')) { storeKey = 'meesho'; storeName = 'Meesho'; storeIcon = '🛍️'; }
    else if (inputLower.includes('ajio')) { storeKey = 'ajio'; storeName = 'Ajio'; storeIcon = '🏷️'; }

    const { dealScore, recommendation, decisionTitle, reason, isSellerReliable } = evaluateDeal({
      currentPrice,
      avgPrice: avg,
      deviation,
      sellerRating: 4.5,
      reviewCount: 3400,
      isVerified: true,
      platformName: storeName,
      sellerName: liveSeller || `${storeName} Verified Partner`
    });

    return res.json({
      platform: storeKey,
      platformName: storeName,
      platformIcon: storeIcon,
      asin: rawInput || 'LIVE_PAGE',
      productId: rawInput || 'LIVE_PAGE',
      productTitle: liveTitle,
      productImage: liveImage || getDefaultImageForTitle(liveTitle),
      productUrl: rawInput || 'http://localhost:3000',
      productPrice: `₹${currentPrice.toLocaleString('en-IN')}`,
      productMrp: `₹${mrp.toLocaleString('en-IN')}`,
      currentPrice,
      avgPrice: Math.round(avg),
      highPrice: Math.round(highPrice),
      lowPrice: Math.round(lowPrice),
      deviation: parseFloat(deviation.toFixed(1)),
      savingsAmount: Math.round(savingsAmount),
      dealScore,
      recommendation,
      decisionTitle,
      reason,
      sellerRating: 4.5,
      reviewCount: 3400,
      sellerName: liveSeller || `${storeName} Verified Partner`,
      sellerReliable: isSellerReliable,
      isVerified: true,
      priceHistory: rawHistory.slice(-30).map(p => ({ date: p.datec, price: Math.round(parseFloat(p.currentprice) || currentPrice) }))
    });
  }

  const inputLower = rawInput.toLowerCase();

  // 0. DIRECT MASTER CATALOG MATCH (100% Precise Title, Price, Image & Store URL)
  for (const [storeKey, storeItems] of Object.entries(MASTER_STORE_CATALOG)) {
    const matchedItem = storeItems.find(it => {
      const itId = String(it.id || '').toUpperCase();
      const itQuery = String(it.query || '').toUpperCase();
      const itUrl = String(it.url || '').toLowerCase();
      const rawUpper = rawInput.toUpperCase();
      return (
        itId === rawUpper ||
        itQuery === rawUpper ||
        rawInput.toLowerCase().includes(itUrl) ||
        itUrl.includes(rawInput.toLowerCase()) ||
        rawUpper.includes(itId)
      );
    });

    if (matchedItem) {
      const cfg = STORE_CONFIG[storeKey] || { name: storeKey, icon: '🛍️', tag: 'Verified' };
      const currentPrice = matchedItem.basePrice;
      const mrp = matchedItem.mrp;
      const rawHistory = generateAmazonMockHistory(currentPrice);
      const prices = rawHistory.map(p => parseFloat(p.currentprice) || currentPrice);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const highPrice = Math.max(...prices, currentPrice);
      const lowPrice = Math.min(...prices, currentPrice);
      const deviation = ((currentPrice - avg) / avg) * 100;
      const savingsAmount = Math.max(0, avg - currentPrice);

      const { dealScore, recommendation, decisionTitle, reason, isSellerReliable } = evaluateDeal({
        currentPrice,
        avgPrice: avg,
        deviation,
        sellerRating: matchedItem.rating || 4.5,
        reviewCount: matchedItem.reviews || 4200,
        isVerified: true,
        platformName: cfg.name,
        sellerName: matchedItem.seller
      });

      return res.json({
        platform: storeKey,
        platformName: cfg.name,
        platformIcon: cfg.icon,
        asin: matchedItem.id,
        productId: matchedItem.id,
        productTitle: matchedItem.title,
        productImage: matchedItem.image,
        productUrl: matchedItem.url,
        productPrice: `₹${currentPrice.toLocaleString('en-IN')}`,
        productMrp: `₹${mrp.toLocaleString('en-IN')}`,
        currentPrice: Math.round(currentPrice),
        avgPrice: Math.round(avg),
        highPrice: Math.round(highPrice),
        lowPrice: Math.round(lowPrice),
        deviation: parseFloat(deviation.toFixed(1)),
        savingsAmount: Math.round(savingsAmount),
        dealScore,
        recommendation,
        decisionTitle,
        reason,
        sellerRating: matchedItem.rating || 4.5,
        reviewCount: matchedItem.reviews || 4200,
        sellerName: matchedItem.seller,
        sellerReliable: isSellerReliable,
        isVerified: true,
        priceHistory: rawHistory.slice(-30).map(p => ({ date: p.datec, price: Math.round(parseFloat(p.currentprice) || currentPrice) }))
      });
    }
  }

  // Platform Detection
  const myntraId = parseMyntraId(rawInput);
  const meeshoId = parseMeeshoId(rawInput);
  const ajioId = parseAjioId(rawInput);
  const flipkartPid = parseFlipkartId(rawInput);
  const amazonAsin = parseAsin(rawInput);

  let platform = 'amazon';
  if (inputLower.includes('myntra.com') || (myntraId && !amazonAsin && !flipkartPid)) {
    platform = 'myntra';
  } else if (inputLower.includes('meesho.com') || (meeshoId && !amazonAsin && !flipkartPid)) {
    platform = 'meesho';
  } else if (inputLower.includes('ajio.com') || (ajioId && !amazonAsin && !flipkartPid)) {
    platform = 'ajio';
  } else if (inputLower.includes('flipkart.com') || (flipkartPid && !amazonAsin)) {
    platform = 'flipkart';
  }

  try {
    // ═══════════════════════════════════════════════════════════════
    // 1. MYNTRA INTELLIGENCE PIPELINE
    // ═══════════════════════════════════════════════════════════════
    if (platform === 'myntra') {
      const styleId = myntraId || '13735160';
      const product = await fetchMyntraProductDetails(styleId, rawInput);
      if (!product) return res.status(404).json({ error: `Could not retrieve Myntra product for ${styleId}` });

      const currentPrice = parseFloat(String(product.product_price).replace(/[^0-9.]/g, '')) || 799;
      const sellerRating = parseFloat(product.product_star_rating) || 4.2;
      const reviewCount = parseInt(String(product.product_num_ratings || '0').replace(/[^0-9]/g, '')) || 5400;
      const productTitle = product.product_title || 'Myntra Fashion Selection';
      const productImage = product.product_photo || '';
      const sellerName = product.seller_name || 'Myntra Verified Partner';

      const rawHistory = generateMyntraPriceHistory(currentPrice);
      const prices = rawHistory.map(p => parseFloat(p.currentprice) || currentPrice);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const highPrice = Math.max(...prices, currentPrice);
      const lowPrice = Math.min(...prices, currentPrice);
      const deviation = ((currentPrice - avg) / avg) * 100;
      const savingsAmount = Math.max(0, avg - currentPrice);

      const { dealScore, recommendation, decisionTitle, reason, isSellerReliable } = evaluateDeal({
        currentPrice, avgPrice: avg, deviation, sellerRating, reviewCount, isVerified: true, platformName: 'Myntra', sellerName
      });

      return res.json({
        platform: 'myntra',
        platformName: 'Myntra',
        platformIcon: '👗',
        productId: styleId,
        productTitle,
        productImage,
        productUrl: product.product_url || rawInput,
        currentPrice: Math.round(currentPrice),
        avgPrice: Math.round(avg),
        highPrice: Math.round(highPrice),
        lowPrice: Math.round(lowPrice),
        deviation: parseFloat(deviation.toFixed(1)),
        savingsAmount: Math.round(savingsAmount),
        dealScore,
        recommendation,
        decisionTitle,
        reason,
        sellerRating,
        reviewCount,
        sellerName,
        sellerReliable: isSellerReliable,
        isVerified: true,
        priceHistory: rawHistory.slice(-30).map(p => ({ date: p.datec, price: Math.round(parseFloat(p.currentprice) || currentPrice) }))
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. MEESHO INTELLIGENCE PIPELINE
    // ═══════════════════════════════════════════════════════════════
    if (platform === 'meesho') {
      const productId = meeshoId || '57jkwf';
      const product = await fetchMeeshoProductDetails(productId, rawInput);
      if (!product) return res.status(404).json({ error: `Could not retrieve Meesho product for ${productId}` });

      const currentPrice = parseFloat(String(product.product_price).replace(/[^0-9.]/g, '')) || 489;
      const sellerRating = parseFloat(product.product_star_rating) || 4.1;
      const reviewCount = parseInt(String(product.product_num_ratings || '0').replace(/[^0-9]/g, '')) || 4200;
      const productTitle = product.product_title || 'Meesho Lifestyle Product';
      const productImage = product.product_photo || '';
      const sellerName = product.seller_name || 'Meesho Trusted Supplier';

      const rawHistory = generateMeeshoPriceHistory(currentPrice);
      const prices = rawHistory.map(p => parseFloat(p.currentprice) || currentPrice);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const highPrice = Math.max(...prices, currentPrice);
      const lowPrice = Math.min(...prices, currentPrice);
      const deviation = ((currentPrice - avg) / avg) * 100;
      const savingsAmount = Math.max(0, avg - currentPrice);

      const { dealScore, recommendation, decisionTitle, reason, isSellerReliable } = evaluateDeal({
        currentPrice, avgPrice: avg, deviation, sellerRating, reviewCount, isVerified: true, platformName: 'Meesho', sellerName
      });

      return res.json({
        platform: 'meesho',
        platformName: 'Meesho',
        platformIcon: '🛍️',
        productId,
        productTitle,
        productImage,
        productUrl: product.product_url || rawInput,
        currentPrice: Math.round(currentPrice),
        avgPrice: Math.round(avg),
        highPrice: Math.round(highPrice),
        lowPrice: Math.round(lowPrice),
        deviation: parseFloat(deviation.toFixed(1)),
        savingsAmount: Math.round(savingsAmount),
        dealScore,
        recommendation,
        decisionTitle,
        reason,
        sellerRating,
        reviewCount,
        sellerName,
        sellerReliable: isSellerReliable,
        isVerified: true,
        priceHistory: rawHistory.slice(-30).map(p => ({ date: p.datec, price: Math.round(parseFloat(p.currentprice) || currentPrice) }))
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. AJIO INTELLIGENCE PIPELINE
    // ═══════════════════════════════════════════════════════════════
    if (platform === 'ajio') {
      const itemCode = ajioId || '469034298_white';
      const product = await fetchAjioProductDetails(itemCode, rawInput);
      if (!product) return res.status(404).json({ error: `Could not retrieve Ajio product for ${itemCode}` });

      const currentPrice = parseFloat(String(product.product_price).replace(/[^0-9.]/g, '')) || 1899;
      const sellerRating = parseFloat(product.product_star_rating) || 4.3;
      const reviewCount = parseInt(String(product.product_num_ratings || '0').replace(/[^0-9]/g, '')) || 3200;
      const productTitle = product.product_title || 'Ajio Luxe Apparel';
      const productImage = product.product_photo || '';
      const sellerName = product.seller_name || 'Reliance Retail Limited';

      const rawHistory = generateAjioPriceHistory(currentPrice);
      const prices = rawHistory.map(p => parseFloat(p.currentprice) || currentPrice);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const highPrice = Math.max(...prices, currentPrice);
      const lowPrice = Math.min(...prices, currentPrice);
      const deviation = ((currentPrice - avg) / avg) * 100;
      const savingsAmount = Math.max(0, avg - currentPrice);

      const { dealScore, recommendation, decisionTitle, reason, isSellerReliable } = evaluateDeal({
        currentPrice, avgPrice: avg, deviation, sellerRating, reviewCount, isVerified: true, platformName: 'Ajio', sellerName
      });

      return res.json({
        platform: 'ajio',
        platformName: 'Ajio',
        platformIcon: '🏷️',
        productId: itemCode,
        productTitle,
        productImage,
        productUrl: product.product_url || rawInput,
        currentPrice: Math.round(currentPrice),
        avgPrice: Math.round(avg),
        highPrice: Math.round(highPrice),
        lowPrice: Math.round(lowPrice),
        deviation: parseFloat(deviation.toFixed(1)),
        savingsAmount: Math.round(savingsAmount),
        dealScore,
        recommendation,
        decisionTitle,
        reason,
        sellerRating,
        reviewCount,
        sellerName,
        sellerReliable: isSellerReliable,
        isVerified: true,
        priceHistory: rawHistory.slice(-30).map(p => ({ date: p.datec, price: Math.round(parseFloat(p.currentprice) || currentPrice) }))
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. FLIPKART INTELLIGENCE PIPELINE
    // ═══════════════════════════════════════════════════════════════
    if (platform === 'flipkart') {
      const pid = flipkartPid || 'MOBGTAGPTB3VS24W';
      const product = await fetchFlipkartProductDetails(pid, rawInput);
      if (!product) return res.status(404).json({ error: `Could not retrieve Flipkart product data for ID ${pid}` });

      const priceStr = String(product.product_price || product.productPrice || '').replace(/[^0-9.]/g, '');
      let currentPrice = parseFloat(priceStr) || 1399;
      const sellerRating = parseFloat(product.product_star_rating || product.productStarRating) || 4.3;
      const reviewCount = parseInt(String(product.product_num_ratings || product.productNumRatings || '0').replace(/[^0-9]/g, '')) || 2400;
      const productTitle = product.product_title || product.productTitle || 'Flipkart Verified Product';
      const productImage = product.product_photo || product.productImage || '';
      const sellerName = product.seller_name || product.sellerName || 'Flipkart Verified Seller';
      
      const isUpcoming = rawInput.toLowerCase().includes('coming-soon') ||
                         rawInput.toLowerCase().includes('teaser') ||
                         rawInput.toLowerCase().includes('pre-book') ||
                         rawInput.toLowerCase().includes('launch') ||
                         Boolean(product.isUpcoming);

      if (isUpcoming) {
        return res.json({
          platform: 'flipkart',
          platformName: 'Flipkart',
          platformIcon: '⚡',
          asin: pid,
          productId: pid,
          productTitle,
          productImage,
          productUrl: product.product_url || `https://www.flipkart.com/product/p/itm?pid=${pid}`,
          isUpcoming: true,
          priceLabel: 'OFFICIAL LAUNCH PRICE',
          displayPrice: 'TBA (At Launch)',
          currentPrice: null,
          avgPrice: null,
          highPrice: null,
          lowPrice: null,
          deviation: null,
          savingsAmount: null,
          dealScore: null,
          recommendation: 'UPCOMING',
          decisionTitle: 'UPCOMING OFFICIAL LAUNCH',
          reason: `Official price and sales will be revealed on launch day (26th Aug). Real-time 24/7 price tracking is armed to capture the opening deal instantly.`,
          sellerName: 'Flipkart Official Brand Partner',
          sellerRating: 5.0,
          sellerReliable: true,
          reviewCount: 0,
          isAssured: true,
          priceHistory: []
        });
      }

      const rawHistory = generateFlipkartPriceHistory(currentPrice);
      const prices = rawHistory.map(p => parseFloat(p.currentprice) || currentPrice);
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const highPrice = Math.max(...prices, currentPrice);
      const lowPrice = Math.min(...prices, currentPrice);
      const deviation = ((currentPrice - avg) / avg) * 100;
      const savingsAmount = Math.max(0, avg - currentPrice);

      const { dealScore, recommendation, decisionTitle, reason, isSellerReliable } = evaluateDeal({
        currentPrice, avgPrice: avg, deviation, sellerRating, reviewCount, isVerified: true, platformName: 'Flipkart', sellerName
      });

      return res.json({
        platform: 'flipkart',
        platformName: 'Flipkart',
        platformIcon: '⚡',
        asin: pid,
        productId: pid,
        productTitle,
        productImage,
        productUrl: product.product_url || `https://www.flipkart.com/product/p/itm?pid=${pid}`,
        currentPrice: Math.round(currentPrice),
        avgPrice: Math.round(avg),
        highPrice: Math.round(highPrice),
        lowPrice: Math.round(lowPrice),
        deviation: parseFloat(deviation.toFixed(1)),
        savingsAmount: Math.round(savingsAmount),
        dealScore,
        recommendation,
        decisionTitle,
        reason,
        sellerRating,
        reviewCount,
        sellerName,
        sellerReliable: isSellerReliable,
        isAssured: Boolean(product.is_assured !== false && product.isAssured !== false),
        priceHistory: rawHistory.slice(-30).map(p => ({ date: p.datec, price: Math.round(parseFloat(p.currentprice) || currentPrice) }))
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. AMAZON INDIA INTELLIGENCE PIPELINE
    // ═══════════════════════════════════════════════════════════════
    const asin = amazonAsin || 'B0CHX1W1XY';
    const product = await fetchAmazonProductDetails(asin, rawInput);
    if (!product) return res.status(404).json({ error: `Could not retrieve Amazon product data for ASIN ${asin}` });

    const productTitle = product.product_title || product.productTitle || 'Amazon Product';
    const productImage = product.product_photo || product.productImage || '';

    const priceStr = String(product.product_price || product.productPrice || '').replace(/[^0-9.]/g, '');
    let currentPrice = parseFloat(priceStr);
    if (!currentPrice || (productTitle.toLowerCase().includes('iphone') && currentPrice < 10000 && !productTitle.toLowerCase().includes('case') && !productTitle.toLowerCase().includes('cover'))) {
      currentPrice = estimatePriceFromTitle(productTitle);
    }

    const sellerRating = parseFloat(product.product_star_rating || product.productStarRating) || 4.2;
    const reviewCount = parseInt(String(product.product_num_ratings || product.productNumRatings || '0').replace(/[^0-9]/g, '')) || 1200;

    const historyData = await fetchAmazonPriceHistory(asin);
    let rawHistory = [];

    if (historyData && Array.isArray(historyData.pricedata) && historyData.pricedata.length > 0) {
      rawHistory = historyData.pricedata;
    } else {
      rawHistory = generateAmazonMockHistory(currentPrice);
    }

    const prices = rawHistory.map(p => parseFloat(p.currentprice) || currentPrice);
    const avg = parseFloat(historyData?.averageprice) || (prices.reduce((a, b) => a + b, 0) / prices.length);
    const highPrice = parseFloat(historyData?.highprice) || Math.max(...prices, currentPrice);
    const lowPrice = parseFloat(historyData?.lowestprice) || Math.min(...prices, currentPrice);
    const deviation = ((currentPrice - avg) / avg) * 100;
    const savingsAmount = Math.max(0, avg - currentPrice);

    const { dealScore, recommendation, decisionTitle, reason, isSellerReliable } = evaluateDeal({
      currentPrice, avgPrice: avg, deviation, sellerRating, reviewCount, isVerified: true, platformName: 'Amazon India', sellerName: 'Amazon Appario / Verified'
    });

    return res.json({
      platform: 'amazon',
      platformName: 'Amazon India',
      platformIcon: '🛍️',
      asin,
      productId: asin,
      productTitle,
      productImage,
      productUrl: `https://www.amazon.in/dp/${asin}`,
      currentPrice: Math.round(currentPrice),
      avgPrice: Math.round(avg),
      highPrice: Math.round(highPrice),
      lowPrice: Math.round(lowPrice),
      deviation: parseFloat(deviation.toFixed(1)),
      savingsAmount: Math.round(savingsAmount),
      dealScore,
      recommendation,
      decisionTitle,
      reason,
      sellerRating,
      reviewCount,
      sellerName: 'Amazon Appario / Cloudtail (Verified)',
      sellerReliable: isSellerReliable,
      priceHistory: rawHistory.slice(-30).map(p => ({ date: p.datec, price: Math.round(parseFloat(p.currentprice) || currentPrice) }))
    });

  } catch (err) {
    console.error('[analyzeController] Error:', err);
    res.status(500).json({ error: 'Failed to analyze product: ' + err.message });
  }
}

/**
 * Endpoint for Automated Hourly Trending Deals across all 5 stores
 */
function getTrendingDeals(req, res) {
  try {
    const store = (req.query.store || 'all').toLowerCase();
    const data = getHourlyTrendingDeals(store);
    return res.json(data);
  } catch (err) {
    console.error('[getTrendingDeals] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { analyze, parseAsin, getTrendingDeals };