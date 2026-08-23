/**
 * Deal Controller
 * Handles deal queries, search, marketplace filters, and manual sync triggers.
 */

const Deal = require('../models/Deal');

/**
 * GET /api/deals
 * Query params: store, search, category, tag, sort, limit
 */
async function getDeals(req, res) {
  try {
    const { store, search, q, category, tag, sort } = req.query;

    const filter = {};

    // 1. Marketplace Store Filter
    if (store && store.toLowerCase() !== 'all') {
      filter.storeName = store.charAt(0).toUpperCase() + store.slice(1).toLowerCase();
    }

    // 2. Search Query (Title, Category, Store)
    const searchQuery = (search || q || '').trim();
    if (searchQuery) {
      filter.$text = { $search: searchQuery };
    }

    // 3. Category Filter
    if (category && category.toLowerCase() !== 'all') {
      filter.category = category;
    }

    // 4. Tag Filter
    if (tag) {
      filter.dealTag = tag;
    }

    // 5. Sorting Rules
    let sortOption = { lastUpdated: -1 };
    if (sort === 'discount_desc') sortOption = { discountPercentage: -1 };
    else if (sort === 'price_asc') sortOption = { currentPrice: 1 };
    else if (sort === 'price_desc') sortOption = { currentPrice: -1 };
    else if (sort === 'rating_desc') sortOption = { rating: -1 };

    let deals = await Deal.find(filter, sortOption);

    // If text search on in-memory mode or fuzzy fallback
    if (searchQuery && Array.isArray(deals)) {
      const qLower = searchQuery.toLowerCase();
      deals = deals.filter(d => 
        (d.productName && d.productName.toLowerCase().includes(qLower)) ||
        (d.category && d.category.toLowerCase().includes(qLower)) ||
        (d.storeName && d.storeName.toLowerCase().includes(qLower))
      );
    }

    // If deals table is empty, auto-seed with immediate sync
    if (!deals || deals.length === 0) {
      const { updateAllMarketplaceDeals } = require('../jobs/dealUpdater');
      deals = await updateAllMarketplaceDeals();
      if (store && store.toLowerCase() !== 'all') {
        const storeNameFormatted = store.charAt(0).toUpperCase() + store.slice(1).toLowerCase();
        deals = deals.filter(d => d.storeName.toLowerCase() === storeNameFormatted.toLowerCase());
      }
    }

    return res.json({
      success: true,
      total: deals.length,
      timestamp: new Date().toISOString(),
      deals: deals
    });
  } catch (err) {
    console.error('[dealController] Error in getDeals:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve marketplace deals: ' + err.message
    });
  }
}

/**
 * GET /api/deals/:id
 */
async function getDealById(req, res) {
  try {
    const { id } = req.params;
    const deal = await Deal.findById(id);
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    return res.json({ success: true, deal });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/deals/sync
 * Manually trigger full marketplace deal sync
 */
async function triggerSync(req, res) {
  try {
    const { updateAllMarketplaceDeals } = require('../jobs/dealUpdater');
    const updatedDeals = await updateAllMarketplaceDeals();
    return res.json({
      success: true,
      message: `Synchronized ${updatedDeals.length} marketplace deals successfully.`,
      total: updatedDeals.length,
      deals: updatedDeals
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getDeals,
  getDealById,
  triggerSync
};
