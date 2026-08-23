const RAPID_HOST = 'realtime-flipkart-amazon-myntra-ajio-croma-product-details.p.rapidapi.com';

function firstValue(source, keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
  }
  return '';
}

function normalizeProduct(payload, url) {
  const data = payload?.data || payload?.product || payload?.result || payload;
  const price = firstValue(data, ['price', 'product_price', 'selling_price', 'specialPrice', 'salePrice']);
  const title = firstValue(data, ['title', 'product_title', 'name', 'productName']);
  const image = firstValue(data, ['image', 'product_photo', 'image_url', 'productImage', 'thumbnail']);
  if (!title || !price) return null;

  return {
    product_title: title,
    product_price: String(price).includes('₹') ? String(price) : `₹${price}`,
    product_original_price: firstValue(data, ['mrp', 'product_mrp', 'original_price', 'originalPrice']),
    product_star_rating: firstValue(data, ['rating', 'product_star_rating', 'averageRating']),
    product_num_ratings: firstValue(data, ['ratings_count', 'product_num_ratings', 'reviewCount']),
    product_photo: image,
    product_url: url,
    seller_name: firstValue(data, ['seller', 'seller_name', 'brand'])
  };
}

async function fetchRapidProductDetails(url) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key || !url?.startsWith('http')) return null;
  try {
    const controller = new AbortController();
    // Provider reports ~132s latency; a short timeout guarantees false 404s.
    const timeout = setTimeout(() => controller.abort(), 150000);
    const response = await fetch(`https://${RAPID_HOST}/product?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': RAPID_HOST }
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return normalizeProduct(await response.json(), url);
  } catch (_) {
    return null;
  }
}

module.exports = { fetchRapidProductDetails };
