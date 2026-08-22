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
      asin: 'B09XS7JWHH',
      product_title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones - Platinum Silver',
      product_price: '₹26,990',
      product_star_rating: '4.6',
      product_num_ratings: '4380',
      product_photo: 'https://m.media-amazon.com/images/I/61O3iMlnJIL._SL1500_.jpg'
    },
    {
      asin: 'B0CHX1W1XY',
      product_title: 'Apple iPhone 15 (128 GB) - Black with Dynamic Island & 48MP Camera',
      product_price: '₹69,999',
      product_star_rating: '4.7',
      product_num_ratings: '9820',
      product_photo: 'https://m.media-amazon.com/images/I/71657TiFeHL._SL1500_.jpg'
    },
    {
      asin: 'B07PR1CL3S',
      product_title: 'boAt Rockerz 450 Bluetooth On Ear Headphones with Mic (Luscious Black)',
      product_price: '₹1,299',
      product_star_rating: '4.2',
      product_num_ratings: '18540',
      product_photo: 'https://m.media-amazon.com/images/I/61u1VALn6JL._SL1500_.jpg'
    },
    {
      asin: 'B0CC9LMWL6',
      product_title: 'Samsung Galaxy Watch6 Bluetooth (44mm, Graphite)',
      product_price: '₹19,499',
      product_star_rating: '4.4',
      product_num_ratings: '2150',
      product_photo: 'https://m.media-amazon.com/images/I/61SSVxTSs3L._SL1500_.jpg'
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

module.exports = {
  fetchProductDetails,
  fetchPriceHistory,
  generateMockHistory,
  generateMockProduct
};