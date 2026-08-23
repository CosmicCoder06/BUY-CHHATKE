/**
 * Automated Real-Time Deal Updater Job (node-cron)
 * Runs automatically every hour to:
 * 1. Fetch latest products across Amazon, Flipkart, Myntra, Meesho & Ajio
 * 2. Compare previous prices and detect drops
 * 3. Tag with Smart Deal AI Logic (🔥 Major Drop, ⭐ Best Entry Point, 📈 Trending Deal, 💰 Huge Saving)
 * 4. Upsert records into MongoDB / Persistent store with historical price tracking
 */

const cron = require('node-cron');
const Deal = require('../models/Deal');

const { fetchAmazonDeals } = require('../services/amazonService');
const { fetchFlipkartDeals } = require('../services/flipkartService');
const { fetchMyntraDeals } = require('../services/myntraService');
const { fetchMeeshoDeals } = require('../services/meeshoService');
const { fetchAjioDeals } = require('../services/ajioService');

/**
 * Smart Deal AI Logic Engine
 * Evaluates current price vs history and discount depth to assign high-conversion deal badges
 */
function evaluateSmartDealTag(currentPrice, originalPrice, priceHistory = []) {
  const discountPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  const historicalPrices = priceHistory.map(h => typeof h.price === 'number' ? h.price : parseFloat(h.price) || currentPrice);
  
  const minHistorical = historicalPrices.length > 0 ? Math.min(...historicalPrices) : currentPrice;
  const avgHistorical = historicalPrices.length > 0 
    ? (historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length) 
    : currentPrice;

  // 1. All-time low floor
  if (currentPrice <= minHistorical) {
    return '⭐ Best Entry Point';
  }

  // 2. Significant deviation from historical average
  if (avgHistorical > 0 && ((avgHistorical - currentPrice) / avgHistorical) >= 0.15) {
    return '🔥 Major Drop';
  }

  // 3. High discount tier
  if (discountPercent >= 50) {
    return '💰 Huge Saving';
  }

  // 4. Strong default velocity
  return '📈 Trending Deal';
}

/**
 * Core Synchronization Routine across all 5 Marketplaces
 */
async function updateAllMarketplaceDeals() {
  console.log(`[DealUpdater] ⚡ [${new Date().toISOString()}] Starting hourly marketplace deal synchronization...`);
  
  try {
    // 1. Fetch deals concurrently across all 5 services
    const [amazonDeals, flipkartDeals, myntraDeals, meeshoDeals, ajioDeals] = await Promise.all([
      fetchAmazonDeals().catch(e => { console.error('Amazon sync error:', e.message); return []; }),
      fetchFlipkartDeals().catch(e => { console.error('Flipkart sync error:', e.message); return []; }),
      fetchMyntraDeals().catch(e => { console.error('Myntra sync error:', e.message); return []; }),
      fetchMeeshoDeals().catch(e => { console.error('Meesho sync error:', e.message); return []; }),
      fetchAjioDeals().catch(e => { console.error('Ajio sync error:', e.message); return []; })
    ]);

    const allIncomingDeals = [
      ...amazonDeals,
      ...flipkartDeals,
      ...myntraDeals,
      ...meeshoDeals,
      ...ajioDeals
    ];

    console.log(`[DealUpdater] Received ${allIncomingDeals.length} deals across 5 marketplaces.`);

    const updatedRecords = [];
    const now = new Date();

    for (const incoming of allIncomingDeals) {
      // Strict Validation: productName, imageUrl, productUrl, currentPrice MUST all exist
      if (
        !incoming.productName ||
        !incoming.imageUrl ||
        !incoming.productUrl ||
        !incoming.currentPrice ||
        !incoming.storeName
      ) {
        continue;
      }

      // 2. Query existing record in database
      const existing = await Deal.findOne({
        $or: [
          { id: incoming.id },
          { productUrl: incoming.productUrl },
          { productName: incoming.productName, storeName: incoming.storeName }
        ]
      });

      let priceHistory = existing && Array.isArray(existing.priceHistory) ? [...existing.priceHistory] : [];
      if (priceHistory.length === 0 && Array.isArray(incoming.priceHistory)) {
        priceHistory = incoming.priceHistory;
      }

      // Add latest price point
      priceHistory.push({
        price: incoming.currentPrice,
        date: now
      });

      // Keep last 30 daily price points
      if (priceHistory.length > 30) {
        priceHistory = priceHistory.slice(-30);
      }

      // 3. Compute dynamic Smart AI Deal Tag
      const smartTag = evaluateSmartDealTag(incoming.currentPrice, incoming.originalPrice, priceHistory);

      // 4. Upsert into database
      const saved = await Deal.findOneAndUpdate(
        {
          productUrl: incoming.productUrl
        },
        {
          id: incoming.id || incoming.productUrl,
          productName: incoming.productName,
          storeName: incoming.storeName,
          imageUrl: incoming.imageUrl,
          currentPrice: incoming.currentPrice,
          originalPrice: incoming.originalPrice,
          discountPercentage: incoming.discountPercentage,
          category: incoming.category || 'General',
          rating: incoming.rating || 4.3,
          productUrl: incoming.productUrl,
          dealTag: smartTag,
          priceHistory: priceHistory,
          lastUpdated: now
        },
        { upsert: true, new: true }
      );

      updatedRecords.push(saved);
    }

    console.log(`[DealUpdater] ✅ Successfully updated and persisted ${updatedRecords.length} deals in database.`);
    return updatedRecords;
  } catch (err) {
    console.error('[DealUpdater] ❌ Error running deal synchronization:', err);
    return [];
  }
}

/**
 * Initializes Cron Schedule: Runs at minute 0 of every hour ('0 * * * *')
 */
function initDealUpdater() {
  console.log('[DealUpdater] Initializing Cron Deal Engine (Interval: Hourly - "0 * * * *")...');

  // Trigger immediate sync on startup
  updateAllMarketplaceDeals().catch(err => {
    console.warn('[DealUpdater] Initial startup deal sync error:', err.message);
  });

  // Schedule recurring hourly job
  cron.schedule('0 * * * *', async () => {
    console.log('[DealUpdater] ⏰ Cron Trigger: Running scheduled hourly deal refresh...');
    await updateAllMarketplaceDeals();
  });
}

module.exports = {
  initDealUpdater,
  updateAllMarketplaceDeals,
  evaluateSmartDealTag
};
