/**
 * Deal Data Model
 * Unified Schema for Real-Time Marketplace Deals across Amazon, Flipkart, Myntra, Meesho & Ajio
 */

const mongoose = require('mongoose');
const { isDbConnected } = require('../config/db');

const DealSchema = new mongoose.Schema({
  id: {
    type: String,
    index: true
  },
  productName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  storeName: {
    type: String,
    required: true,
    enum: ['Amazon', 'Flipkart', 'Myntra', 'Meesho', 'Ajio'],
    index: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  currentPrice: {
    type: Number,
    required: true
  },
  originalPrice: {
    type: Number,
    required: true
  },
  discountPercentage: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    default: 'General'
  },
  rating: {
    type: Number,
    default: 4.2
  },
  productUrl: {
    type: String,
    required: true
  },
  dealTag: {
    type: String,
    default: '📈 Trending Deal'
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  priceHistory: [
    {
      price: { type: Number, required: true },
      date: { type: Date, default: Date.now }
    }
  ],
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Index for multi-attribute search and sorting
DealSchema.index({ productName: 'text', category: 'text' });
DealSchema.index({ storeName: 1, currentPrice: 1 });

const MongooseDeal = mongoose.model('Deal', DealSchema);

// Resilient In-Memory & File Store fallback for offline mode
const memoryStore = new Map();

const Deal = {
  schema: DealSchema,

  async find(filter = {}, sort = { lastUpdated: -1 }) {
    if (isDbConnected()) {
      return await MongooseDeal.find(filter).sort(sort).lean();
    }
    
    // In-memory filter implementation
    let results = Array.from(memoryStore.values());
    if (filter.storeName && filter.storeName !== 'all') {
      const storeRegex = new RegExp(`^${filter.storeName}$`, 'i');
      results = results.filter(d => storeRegex.test(d.storeName));
    }
    if (filter.$text && filter.$text.$search) {
      const q = filter.$text.$search.toLowerCase();
      results = results.filter(d => 
        (d.productName && d.productName.toLowerCase().includes(q)) ||
        (d.category && d.category.toLowerCase().includes(q)) ||
        (d.storeName && d.storeName.toLowerCase().includes(q))
      );
    }
    if (filter.category) {
      results = results.filter(d => d.category.toLowerCase() === filter.category.toLowerCase());
    }

    return results.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  },

  async findOne(filter = {}) {
    if (isDbConnected()) {
      return await MongooseDeal.findOne(filter).lean();
    }
    const all = Array.from(memoryStore.values());
    if (filter.productUrl) return all.find(d => d.productUrl === filter.productUrl) || null;
    if (filter._id) return memoryStore.get(String(filter._id)) || null;
    if (filter.productName && filter.storeName) {
      return all.find(d => d.productName === filter.productName && d.storeName === filter.storeName) || null;
    }
    return all[0] || null;
  },

  async findById(id) {
    if (isDbConnected()) {
      return await MongooseDeal.findById(id).lean();
    }
    return memoryStore.get(String(id)) || null;
  },

  async findOneAndUpdate(filter, update, options = { upsert: true, new: true }) {
    if (isDbConnected()) {
      return await MongooseDeal.findOneAndUpdate(filter, update, options).lean();
    }

    let existing = null;
    for (const [key, val] of memoryStore.entries()) {
      if (filter.productUrl && val.productUrl === filter.productUrl) { existing = val; break; }
      if (filter.productName && val.productName === filter.productName && val.storeName === filter.storeName) {
        existing = val; break;
      }
    }

    const docId = existing ? existing._id : ('deal_' + Math.random().toString(36).substr(2, 9));
    const now = new Date();

    const priceHist = existing && Array.isArray(existing.priceHistory) ? [...existing.priceHistory] : [];
    if (update.currentPrice) {
      priceHist.push({ price: update.currentPrice, date: now });
      if (priceHist.length > 30) priceHist.shift();
    }

    const updatedDoc = {
      _id: docId,
      ...(existing || {}),
      ...update,
      priceHistory: update.priceHistory || priceHist,
      lastUpdated: update.lastUpdated || now
    };

    memoryStore.set(docId, updatedDoc);
    return updatedDoc;
  },

  async deleteMany(filter = {}) {
    if (isDbConnected()) {
      return await MongooseDeal.deleteMany(filter);
    }
    const count = memoryStore.size;
    memoryStore.clear();
    return { deletedCount: count };
  },

  async countDocuments(filter = {}) {
    if (isDbConnected()) {
      return await MongooseDeal.countDocuments(filter);
    }
    return memoryStore.size;
  }
};

module.exports = Deal;
