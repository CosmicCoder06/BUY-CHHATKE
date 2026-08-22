function getApiKey() {
  return process.env.RAPIDAPI_KEY || '';
}

async function fetchProductDetails(asin) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[amazonService] RAPIDAPI_KEY is not configured in environment. Using demo fallback.');
    return generateMockProduct(asin);
  }

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

    if (!res.ok) {
      console.warn(`[amazonService] Product API error: HTTP ${res.status}. Falling back to demo data.`);
      return generateMockProduct(asin);
    }

    const data = await res.json();
    if (data && data.data && data.data.product_title) {
      return data.data;
    }
    return generateMockProduct(asin);
  } catch (err) {
    console.warn('[amazonService] fetchProductDetails failed:', err.message);
    return generateMockProduct(asin);
  }
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
  // Return realistic demo products depending on hash of ASIN
  const demoCatalog = [
    {
      product_title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones - Platinum Silver',
      product_price: '₹26,990',
      product_star_rating: '4.6',
      product_num_ratings: '4380',
      product_photo: 'https://m.media-amazon.com/images/I/61+ElP4fQDL._SL1500_.jpg'
    },
    {
      product_title: 'Apple iPhone 15 (128 GB) - Black with Dynamic Island & 48MP Camera',
      product_price: '₹69,999',
      product_star_rating: '4.7',
      product_num_ratings: '9820',
      product_photo: 'https://m.media-amazon.com/images/I/71657TiFeHL._SL1500_.jpg'
    },
    {
      product_title: 'boAt Rockerz 450 Bluetooth On Ear Headphones with Mic (Luscious Black)',
      product_price: '₹1,299',
      product_star_rating: '4.2',
      product_num_ratings: '18540',
      product_photo: 'https://m.media-amazon.com/images/I/61kWB+bJglL._SL1500_.jpg'
    },
    {
      product_title: 'Samsung Galaxy Watch6 Bluetooth (44mm, Graphite)',
      product_price: '₹19,499',
      product_star_rating: '4.4',
      product_num_ratings: '2150',
      product_photo: 'https://m.media-amazon.com/images/I/61wP9w7bH4L._SL1500_.jpg'
    }
  ];

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
    
    // Simulate real market variations (mean-reverting random walk)
    const drift = (base - walkingPrice) * 0.1;
    const noise = (Math.random() - 0.5) * (base * 0.04);
    walkingPrice = Math.round(walkingPrice + drift + noise);
    
    // Day 0 (today) should match currentPrice
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