const {
  fetchProductDetails,
  fetchPriceHistory,
  generateMockHistory
} = require('../services/amazonService');

async function analyze(req, res) {
  const asin = req.query.asin;
  if (!asin) return res.status(400).json({ error: 'ASIN required' });

  try {
  
    const product = await fetchProductDetails(asin);

   
    const currentPrice = parseFloat(product?.product_price?.replace(/[^0-9.]/g, '')) || 0;
    const sellerRating = parseFloat(product?.product_star_rating) || 0;
    const reviewCount  = parseInt(product?.product_num_ratings) || 0;
    const productTitle = product?.product_title || 'Unknown Product';
    const productImage = product?.product_photo || '';

   
    const historyData  = await fetchPriceHistory(asin);
    const priceHistory = historyData?.pricedata?.length > 0
      ? historyData.pricedata
      : generateMockHistory(currentPrice);

   
    const prices    = priceHistory.map(p => parseFloat(p.currentprice) || 0);
    const avgPrice  = parseFloat(historyData?.averageprice) || (prices.reduce((a, b) => a + b, 0) / prices.length);
    const highPrice = parseFloat(historyData?.highprice)    || Math.max(...prices);
    const lowPrice  = parseFloat(historyData?.lowestprice)  || Math.min(...prices);

   
    const avg       = avgPrice > 0 ? avgPrice : currentPrice;
    const deviation = ((currentPrice - avg) / avg) * 100;

    let recommendation, reason;
    if (currentPrice < avg * 0.80) {
      recommendation = 'BUY';
      reason = `Price is ${Math.abs(deviation).toFixed(1)}% below historical average — great deal!`;
    } else if (currentPrice > avg * 1.25) {
      recommendation = 'WAIT';
      reason = `Price spike detected — ${deviation.toFixed(1)}% above average. Wait for it to drop.`;
    } else {
      recommendation = 'FAIR';
      reason = `Price is within normal range (${deviation.toFixed(1)}% from average).`;
    }

   
    const sellerReliable = sellerRating >= 3.5 && reviewCount >= 50;

   
    const chartData = priceHistory.slice(-30).map(p => ({
      date:  p.datec,
      price: parseFloat(p.currentprice) || 0
    }));

    res.json({
      productTitle,
      productImage,
      currentPrice,
      avgPrice:    avg.toFixed(2),
      highPrice:   highPrice.toFixed(2),
      lowPrice:    lowPrice.toFixed(2),
      deviation:   deviation.toFixed(1),
      recommendation,
      reason,
      sellerRating,
      reviewCount,
      sellerReliable,
      priceHistory: chartData
    });

  } catch (err) {
    console.error('FULL ERROR:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { analyze };