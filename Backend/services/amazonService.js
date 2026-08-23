const { scrapeLiveProduct } = require('./metadataScraper');

function getApiKey() {
  return process.env.RAPIDAPI_KEY || '';
}

async function fetchProductDetails(asin, originalUrl = '') {
  // 1. If full URL is provided, try live metadata scraping first
  if (originalUrl && originalUrl.startsWith('http')) {
    const liveData = await scrapeLiveProduct(originalUrl);
    if (liveData && liveData.productTitle) {
      return {
        ...liveData,
        asin: asin
      };
    }
  }

  // 2. Try RapidAPI Amazon Endpoint
  const apiKey = getApiKey();
  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(
        `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${encodeURIComponent(asin)}&country=IN`,
        {
          signal: controller.signal,
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'real-time-amazon-data.p.rapidapi.com'
          }
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.data && data.data.product_title) {
          return data.data;
        }
      }
    } catch (err) {
      console.warn('[amazonService] fetchProductDetails failed:', err.message);
    }
  }

  // 3. Fallback to mock catalog
  return generateMockProduct(asin);
}

async function fetchPriceHistory(asin) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      'https://amazon-price-history-tracker10.p.rapidapi.com/amazon.php',
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'amazon-price-history-tracker10.p.rapidapi.com',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ url: `https://www.amazon.in/dp/${asin}` }).toString()
      }
    );
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.warn('[amazonService] fetchPriceHistory failed:', err.message);
    return null;
  }
}

function generateMockProduct(asin) {
  const demoCatalog = [
    {
      asin: 'B0CHX1W1XY',
      product_title: 'Apple iPhone 15 (256 GB) - Black Titanium Finish',
      product_price: '₹69,999',
      product_mrp: '₹79,900',
      product_star_rating: '4.7',
      product_num_ratings: '9820',
      product_photo: 'https://m.media-amazon.com/images/I/71657TiFeHL._SL1500_.jpg'
    },
    {
      asin: 'B0CS5XW6TN',
      product_title: 'Samsung Galaxy S24 Ultra 5G AI Smartphone (Titanium Gray)',
      product_price: '₹99,999',
      product_mrp: '₹1,34,999',
      product_star_rating: '4.8',
      product_num_ratings: '5620',
      product_photo: 'https://m.media-amazon.com/images/I/717Q2swzhBL._SL1500_.jpg'
    },
    {
      asin: 'B08N5XSG8Z',
      product_title: 'Apple MacBook Air M1 Laptop (13.3-inch Retina, 256GB SSD, Space Grey)',
      product_price: '₹69,990',
      product_mrp: '₹92,900',
      product_star_rating: '4.8',
      product_num_ratings: '14250',
      product_photo: 'https://m.media-amazon.com/images/I/71jG+e7roXL._SL1500_.jpg'
    },
    {
      asin: 'B09XS7JWHH',
      product_title: 'Sony WH-1000XM5 Wireless ANC Headphones (Platinum Silver)',
      product_price: '₹26,990',
      product_mrp: '₹34,990',
      product_star_rating: '4.6',
      product_num_ratings: '4380',
      product_photo: 'https://m.media-amazon.com/images/I/61O3iMlnJIL._SL1500_.jpg'
    },
    {
      asin: 'B0B3CPQ5PF',
      product_title: 'OnePlus Nord 2T 5G (Jade Fog, 8GB RAM, 128GB Storage)',
      product_price: '₹27,499',
      product_mrp: '₹28,999',
      product_star_rating: '4.3',
      product_num_ratings: '24062',
      product_photo: 'https://m.media-amazon.com/images/I/61mIUCdJ9LY._SL1500_.jpg'
    }
  ];

  // 1. Exact ASIN match
  const exact = demoCatalog.find(item => item.asin.toUpperCase() === String(asin).toUpperCase());
  if (exact) return exact;

  // 2. Hash fallback
  let sum = 0;
  for (let i = 0; i < asin.length; i++) sum += asin.charCodeAt(i);
  const picked = demoCatalog[sum % demoCatalog.length];

  return {
    ...picked,
    asin: asin
  };
}

function generateMockHistory(currentPrice) {
  const base = currentPrice > 0 ? currentPrice : 1499;
  const history = [];
  const today = new Date();
  
  let walkingPrice = base * (1 + (Math.random() * 0.15 - 0.05));
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    
    const drift = (base - walkingPrice) * 0.1;
    const noise = (Math.random() - 0.5) * (base * 0.04);
    walkingPrice = Math.round(walkingPrice + drift + noise);
    
    const priceVal = (i === 0) ? base : Math.max(Math.round(base * 0.65), walkingPrice);

    history.push({
      datec: d.toISOString().split('T')[0],
      currentprice: priceVal
    });
  }
  return history;
}

/**
 * Standardized Marketplace Deal Fetcher for Amazon
 */
async function fetchAmazonDeals() {
  const { MASTER_STORE_CATALOG } = require('./trendingService');
  const items = MASTER_STORE_CATALOG.amazon || [];
  
  return items.map(item => {
    const currentPrice = item.basePrice;
    const originalPrice = item.mrp;
    const discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    const mockHist = generateMockHistory(currentPrice);
    
    return {
      productName: item.title,
      storeName: 'Amazon',
      imageUrl: item.image,
      currentPrice: currentPrice,
      originalPrice: originalPrice,
      discountPercentage: discount,
      category: item.category || 'Electronics',
      rating: item.rating || 4.5,
      productUrl: item.url,
      dealTag: discount >= 20 ? '🔥 Major Drop' : (discount >= 10 ? '⭐ Best Entry Point' : '📈 Trending Deal'),
      priceHistory: mockHist.map(h => ({ price: h.currentprice, date: new Date(h.datec) })),
      lastUpdated: new Date()
    };
  });
}

module.exports = {
  fetchProductDetails,
  fetchPriceHistory,
  generateMockHistory,
  generateMockProduct,
  fetchAmazonDeals
};