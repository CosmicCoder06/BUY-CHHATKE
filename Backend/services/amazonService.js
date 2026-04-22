const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

async function fetchProductDetails(asin) {
  const res = await fetch(
    `https://real-time-amazon-data.p.rapidapi.com/product-details?asin=${asin}&country=IN`,
    {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'real-time-amazon-data.p.rapidapi.com'
      }
    }
  );
  const data = await res.json();
  console.log('Product status:', res.status);
  return data.data;
}

async function fetchPriceHistory(asin) {
  const res = await fetch(
    'https://amazon-price-history-tracker10.p.rapidapi.com/amazon.php',
    {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'amazon-price-history-tracker10.p.rapidapi.com',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ url: `https://www.amazon.in/dp/${asin}` }).toString()
    }
  );
  const data = await res.json();
  console.log('History status:', res.status);
  console.log('History raw:', JSON.stringify(data, null, 2));
  return Array.isArray(data) ? data[0] : data;
}

function generateMockHistory(currentPrice) {
  const history = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const variation = (Math.random() - 0.5) * 0.2;
    history.push({
      datec: d.toISOString().split('T')[0],
      currentprice: Math.round(currentPrice * (1 + variation))
    });
  }
  return history;
}

module.exports = { fetchProductDetails, fetchPriceHistory, generateMockHistory };