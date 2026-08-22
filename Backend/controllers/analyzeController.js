const {
  fetchProductDetails,
  fetchPriceHistory,
  generateMockHistory
} = require('../services/amazonService');

function parseAsin(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const str = raw.trim();
  const urlMatch = str.match(/(?:\/dp\/|\/gp\/product\/|\/d\/|[?&]asin=)([A-Z0-9]{10})/i);
  if (urlMatch) return urlMatch[1].toUpperCase();
  const plainMatch = str.toUpperCase().match(/\b([B0-9][A-Z0-9]{9})\b/);
  if (plainMatch) return plainMatch[1];
  return null;
}

async function analyze(req, res) {
  const rawInput = req.query.asin || req.query.url;
  const asin = parseAsin(rawInput);

  if (!asin) {
    return res.status(400).json({
      error: 'Invalid or missing Amazon ASIN/URL. Please provide a 10-character ASIN or valid Amazon product URL.'
    });
  }

  try {
    const product = await fetchProductDetails(asin);
    if (!product) {
      return res.status(404).json({ error: `Could not retrieve product data for ASIN ${asin}` });
    }

    // Parse product details
    const priceStr = String(product.product_price || '').replace(/[^0-9.]/g, '');
    let currentPrice = parseFloat(priceStr) || 1299;
    const sellerRating = parseFloat(product.product_star_rating) || 4.2;
    const reviewCount = parseInt(String(product.product_num_ratings || '0').replace(/[^0-9]/g, '')) || 1200;
    const productTitle = product.product_title || 'Amazon Product';
    const productImage = product.product_photo || '';

    // Historical Price Data
    const historyData = await fetchPriceHistory(asin);
    let rawHistory = [];

    if (historyData && Array.isArray(historyData.pricedata) && historyData.pricedata.length > 0) {
      rawHistory = historyData.pricedata;
    } else {
      rawHistory = generateMockHistory(currentPrice);
    }

    // Normalize prices
    const prices = rawHistory.map(p => parseFloat(p.currentprice) || currentPrice);
    const avgPrice = parseFloat(historyData?.averageprice) || (prices.reduce((a, b) => a + b, 0) / prices.length);
    const highPrice = parseFloat(historyData?.highprice) || Math.max(...prices, currentPrice);
    const lowPrice = parseFloat(historyData?.lowestprice) || Math.min(...prices, currentPrice);

    const avg = avgPrice > 0 ? avgPrice : currentPrice;
    const deviation = ((currentPrice - avg) / avg) * 100;
    const savingsAmount = Math.max(0, avg - currentPrice);

    // Compute Deal Score (0 - 100)
    let dealScore = 50;
    if (deviation <= -25) dealScore += 35;
    else if (deviation <= -15) dealScore += 25;
    else if (deviation <= -5) dealScore += 15;
    else if (deviation >= 25) dealScore -= 30;
    else if (deviation >= 15) dealScore -= 20;
    else if (deviation >= 5) dealScore -= 10;

    const isSellerReliable = sellerRating >= 3.8 && reviewCount >= 50;
    if (isSellerReliable) dealScore += 12;
    else if (sellerRating >= 3.0) dealScore += 2;
    else dealScore -= 15;

    if (reviewCount > 1000) dealScore += 5;
    else if (reviewCount < 30) dealScore -= 8;

    dealScore = Math.max(5, Math.min(99, Math.round(dealScore)));

    // Recommendation logic
    let recommendation, decisionTitle, reason;
    if (dealScore >= 70) {
      recommendation = 'BUY';
      decisionTitle = 'Strong Buy — Optimal Timing';
      reason = `Current price is ${Math.abs(deviation).toFixed(1)}% below the 30-day baseline. High seller confidence.`;
    } else if (dealScore >= 45) {
      recommendation = 'FAIR';
      decisionTitle = 'Fair Price — Normal Range';
      reason = `Trading within normal historical volatility (${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}% vs average).`;
    } else {
      recommendation = 'WAIT';
      decisionTitle = 'Price Elevated — Hold Off';
      reason = `Price is elevated by ${deviation.toFixed(1)}% compared to recent baseline or seller ratings indicate higher risk.`;
    }

    // Chart timeline formatting (last 30 points)
    const priceHistory = rawHistory.slice(-30).map(p => ({
      date: p.datec,
      price: Math.round(parseFloat(p.currentprice) || currentPrice)
    }));

    return res.json({
      asin,
      productTitle,
      productImage,
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
      sellerReliable: isSellerReliable,
      priceHistory
    });

  } catch (err) {
    console.error('[analyzeController] Error:', err);
    res.status(500).json({ error: 'Failed to analyze product: ' + err.message });
  }
}

module.exports = { analyze, parseAsin };