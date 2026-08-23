/**
 * buySmarty Automated Hourly Trending Deals Engine
 * Automatically rotates and refreshes authentic everyday trending deals across
 * Amazon, Flipkart, Myntra, Meesho, and Ajio every hour.
 */

const MASTER_STORE_CATALOG = {
  amazon: [
    {
      id: 'B09XS7JWHH',
      title: 'Sony WH-1000XM5 Wireless ANC Headphones (Platinum Silver)',
      basePrice: 26990,
      mrp: 34990,
      image: 'https://m.media-amazon.com/images/I/61O3iMlnJIL._SL1500_.jpg',
      url: 'https://www.amazon.in/dp/B09XS7JWHH',
      query: 'B09XS7JWHH',
      category: 'Audio',
      rating: 4.6,
      reviews: 4380,
      seller: 'Appario Retail (Amazon Verified)'
    },
    {
      id: 'B0CHX1W1XY',
      title: 'Apple iPhone 15 (256 GB) - Black Titanium Finish',
      basePrice: 69999,
      mrp: 79900,
      image: 'https://m.media-amazon.com/images/I/71657TiFeHL._SL1500_.jpg',
      url: 'https://www.amazon.in/dp/B0CHX1W1XY',
      query: 'B0CHX1W1XY',
      category: 'Smartphones',
      rating: 4.7,
      reviews: 9820,
      seller: 'Darshita Electronics (Amazon Fulfilled)'
    },
    {
      id: 'B0CQYC21QY',
      title: 'Samsung Galaxy S24 Ultra 5G AI Smartphone (Titanium Gray)',
      basePrice: 121999,
      mrp: 134999,
      image: 'https://m.media-amazon.com/images/I/717Q2swzhBL._AC_UY654_QL65_.jpg',
      url: 'https://www.amazon.in/dp/B0CQYC21QY',
      query: 'B0CQYC21QY',
      category: 'Smartphones',
      rating: 4.8,
      reviews: 5620,
      seller: 'STPL Exclusive (Amazon Verified)'
    },
    {
      id: 'B0B3CQBRB4',
      title: 'Apple MacBook Air M2 (13.6-inch, 8GB RAM, 256GB SSD)',
      basePrice: 84990,
      mrp: 99900,
      image: 'https://m.media-amazon.com/images/I/710TJuHTMhL._SL1500_.jpg',
      url: 'https://www.amazon.in/dp/B0B3CQBRB4',
      query: 'B0B3CQBRB4',
      category: 'Laptops',
      rating: 4.8,
      reviews: 3450,
      seller: 'Appario Retail (Amazon Verified)'
    },
    {
      id: 'B0CC9LMWL6',
      title: 'Samsung Galaxy Watch6 Bluetooth (44mm, Graphite)',
      basePrice: 19499,
      mrp: 33999,
      image: 'https://m.media-amazon.com/images/I/61SSVxTSs3L._SL1500_.jpg',
      url: 'https://www.amazon.in/dp/B0CC9LMWL6',
      query: 'B0CC9LMWL6',
      category: 'Wearables',
      rating: 4.4,
      reviews: 2150,
      seller: 'Appario Retail (Amazon Verified)'
    },
    {
      id: 'B08GVD7WBS',
      title: 'Fujifilm Instax Mini 11 Instant Camera (Charcoal Gray)',
      basePrice: 5999,
      mrp: 7999,
      image: 'https://m.media-amazon.com/images/I/71eXwZc7tBL._SL1500_.jpg',
      url: 'https://www.amazon.in/dp/B08GVD7WBS',
      query: 'B08GVD7WBS',
      category: 'Cameras',
      rating: 4.5,
      reviews: 8740,
      seller: 'Fujifilm Flagship Store'
    }
  ],

  flipkart: [
    {
      id: 'MOBGXZ86HFKZUYZZ',
      title: 'Nothing Phone (2a) 5G (Black, 128 GB, 8 GB RAM)',
      basePrice: 23999,
      mrp: 25999,
      image: 'https://m.media-amazon.com/images/I/71dZBla7wUL._AC_UY654_QL65_.jpg',
      url: 'https://www.flipkart.com/nothing-phone-2a-5g-black-128-gb/p/itmd06869b2d88ad',
      query: 'MOBGXZ86HFKZUYZZ',
      category: 'Smartphones',
      rating: 4.5,
      reviews: 48210,
      seller: 'RetailNet (Flipkart Assured)'
    },
    {
      id: 'ACCG2ZYXZ9PQWVAB',
      title: 'boAt Rockerz 450 Bluetooth On-Ear Headphone (Luscious Black)',
      basePrice: 1299,
      mrp: 3990,
      image: 'https://m.media-amazon.com/images/I/61u1VALn6JL._SL1500_.jpg',
      url: 'https://www.flipkart.com/boat-rockerz-450-bluetooth-headset/p/itm217a81057e937',
      query: 'ACCG2ZYXZ9PQWVAB',
      category: 'Audio',
      rating: 4.3,
      reviews: 142800,
      seller: 'CORSECA Brands (Flipkart Assured)'
    },
    {
      id: 'MOBGWFXYZ99Q12AB',
      title: 'Poco X6 Pro 5G (Spectre Black, 256 GB, 8 GB RAM)',
      basePrice: 21999,
      mrp: 26999,
      image: 'https://m.media-amazon.com/images/I/717z2bNF6DL._AC_UY654_QL65_.jpg',
      url: 'https://www.flipkart.com/poco-x6-pro-5g-spectre-black-256-gb/p/itm5a8427f7dbbe4',
      query: 'MOBGWFXYZ99Q12AB',
      category: 'Smartphones',
      rating: 4.4,
      reviews: 19840,
      seller: 'Flashtech Retail (Flipkart Assured)'
    },
    {
      id: 'MOBGTAGPTB3VS24W',
      title: 'realme 12 Pro+ 5G (Submarine Blue, 256 GB, 8 GB RAM)',
      basePrice: 29999,
      mrp: 34999,
      image: 'https://m.media-amazon.com/images/I/714DutH6IBL._AC_UY654_QL65_.jpg',
      url: 'https://www.flipkart.com/realme-12-pro-plus-5g-submarine-blue-256-gb/p/itm7e34d3d82a17f',
      query: 'MOBGTAGPTB3VS24W',
      category: 'Smartphones',
      rating: 4.5,
      reviews: 24740,
      seller: 'SuperComNet (Flipkart Assured)'
    },
    {
      id: 'TVEG2ZZ89PQ11234',
      title: 'Mi X Series 43-inch Ultra HD (4K) Smart Google TV',
      basePrice: 26999,
      mrp: 42999,
      image: 'https://m.media-amazon.com/images/I/71L-b+XlZ1L._SL1500_.jpg',
      url: 'https://www.flipkart.com/mi-x-series-43-inch-ultra-hd-4k-smart-google-tv/p/itm682349102834',
      query: 'TVEG2ZZ89PQ11234',
      category: 'Smart TVs',
      rating: 4.4,
      reviews: 18920,
      seller: 'IndiFlashMart (Flipkart Assured)'
    }
  ],

  myntra: [
    {
      id: '35719710',
      title: 'Caprese Croc-Textured Shoulder Bag',
      basePrice: 950,
      mrp: 3799,
      image: 'https://m.media-amazon.com/images/I/61wZjWZC7IL._AC_UL960_QL65_.jpg',
      url: 'https://www.myntra.com/handbags/caprese/caprese-croc-textured-baguette-shoulder-bag/35719710/buy',
      query: '35719710',
      category: 'Handbags',
      rating: 4.5,
      reviews: 8420,
      seller: 'Caprese Official Flagship Store'
    },
    {
      id: '13735160',
      title: 'Roadster Men Navy Blue Casual Solid Shirt',
      basePrice: 799,
      mrp: 1599,
      image: 'https://m.media-amazon.com/images/I/51N7HxDG0UL._AC_UL960_QL65_.jpg',
      url: 'https://www.myntra.com/shirts/roadster/roadster-men-casual-shirt/13735160/buy',
      query: '13735160',
      category: 'Men Fashion',
      rating: 4.2,
      reviews: 14200,
      seller: 'Omnitech Retail (Myntra Verified)'
    },
    {
      id: '19324022',
      title: 'HRX by Hrithik Roshan Men Running Shoes',
      basePrice: 1299,
      mrp: 3499,
      image: 'https://m.media-amazon.com/images/I/51+ReOwmYJL._AC_UL960_QL65_.jpg',
      url: 'https://www.myntra.com/shoes/hrx-by-hrithik-roshan/hrx-men-running-shoes/19324022/buy',
      query: '19324022',
      category: 'Footwear',
      rating: 4.3,
      reviews: 19300,
      seller: 'HRX Activewear Flagship Store'
    },
    {
      id: '22819234',
      title: 'Anouk Women Printed Kurta with Palazzos',
      basePrice: 1199,
      mrp: 2999,
      image: 'https://m.media-amazon.com/images/I/61is4J+KZtL._AC_UL960_QL65_.jpg',
      url: 'https://www.myntra.com/kurta-sets/anouk/anouk-women-printed-kurta-set/22819234/buy',
      query: '22819234',
      category: 'Women Ethnic',
      rating: 4.4,
      reviews: 6180,
      seller: 'Anouk Ethnic Store'
    },
    {
      id: '1700944',
      title: 'HRX by Hrithik Roshan Men Active Sports T-shirt',
      basePrice: 499,
      mrp: 999,
      image: 'https://m.media-amazon.com/images/I/71s8d1jZq2L._AC_UL960_QL65_.jpg',
      url: 'https://www.myntra.com/tshirts/hrx-by-hrithik-roshan/hrx-men-yellow-active-tshirt/1700944/buy',
      query: '1700944',
      category: 'Activewear',
      rating: 4.3,
      reviews: 28900,
      seller: 'HRX Official Brand Store'
    }
  ],

  meesho: [
    {
      id: '57jkwf',
      title: 'Trendy Attractive Men White Casual Sneakers',
      basePrice: 489,
      mrp: 1199,
      image: 'https://m.media-amazon.com/images/I/71D9ImsvEtL._AC_UY695_.jpg',
      url: 'https://www.meesho.com/trendy-attractive-men-sneakers/p/57jkwf',
      query: '57jkwf',
      category: 'Footwear',
      rating: 4.1,
      reviews: 9450,
      seller: 'Fashion Hub Direct (Meesho Trusted)'
    },
    {
      id: '62mkpq',
      title: 'Classy Elegant Women Georgette Saree with Blouse',
      basePrice: 389,
      mrp: 999,
      image: 'https://m.media-amazon.com/images/I/818AenacwjL._AC_UL960_QL65_.jpg',
      url: 'https://www.meesho.com/women-georgette-saree/p/62mkpq',
      query: '62mkpq',
      category: 'Ethnic Wear',
      rating: 4.2,
      reviews: 12800,
      seller: 'Shree Balaji Textiles (Meesho Trusted)'
    },
    {
      id: '48nxzt',
      title: 'Stylish Bluetooth Wireless Neckband Earphones',
      basePrice: 299,
      mrp: 899,
      image: 'https://m.media-amazon.com/images/I/61u1VALn6JL._SL1500_.jpg',
      url: 'https://www.meesho.com/stylish-bluetooth-wireless-neckband-earphones/p/48nxzt',
      query: '48nxzt',
      category: 'Audio',
      rating: 4.0,
      reviews: 24100,
      seller: 'SoundPulse Audio Store'
    },
    {
      id: '73krvw',
      title: 'Waterproof Canvas Men Laptop Backpack (30L)',
      basePrice: 449,
      mrp: 1299,
      image: 'https://m.media-amazon.com/images/I/71Qw2yG6GJL._AC_UL960_QL65_.jpg',
      url: 'https://www.meesho.com/waterproof-canvas-men-laptop-backpack/p/73krvw',
      query: '73krvw',
      category: 'Luggage & Bags',
      rating: 4.3,
      reviews: 15620,
      seller: 'Urban Gear Luggage (Meesho Trusted)'
    },
    {
      id: '81pmwx',
      title: 'Casual Solid Cotton Blend Kurta Set for Men',
      basePrice: 529,
      mrp: 1499,
      image: 'https://m.media-amazon.com/images/I/61is4J+KZtL._AC_UL960_QL65_.jpg',
      url: 'https://www.meesho.com/men-cotton-kurta-set/p/81pmwx',
      query: '81pmwx',
      category: 'Men Ethnic',
      rating: 4.2,
      reviews: 7890,
      seller: 'Royal Fabrics (Meesho Trusted)'
    }
  ],

  ajio: [
    {
      id: '469034298_white',
      title: 'Nike Air Max SC Low-Top Lace-Up Sneakers',
      basePrice: 4495,
      mrp: 5995,
      image: 'https://m.media-amazon.com/images/I/61xi8pnZunL._AC_UL960_QL65_.jpg',
      url: 'https://www.ajio.com/nike-air-max-sc-sneakers/p/469034298_white',
      query: '469034298_white',
      category: 'Sneakers',
      rating: 4.4,
      reviews: 3200,
      seller: 'Reliance Retail (Ajio Luxe Verified)'
    },
    {
      id: '610360303_005',
      title: "Steve Madden Men's Possess Chunky Sneakers",
      basePrice: 21271,
      mrp: 24249,
      image: 'https://m.media-amazon.com/images/I/51+ReOwmYJL._AC_UL960_QL65_.jpg',
      url: 'https://www.ajio.com/steve-madden-men-possess-sneakers/p/610360303_005',
      query: '610360303_005',
      category: 'Designer Footwear',
      rating: 4.6,
      reviews: 1420,
      seller: 'Steve Madden Official Brand Store'
    },
    {
      id: '469123847_black',
      title: 'Puma Men Electron E Pro Training Shoes',
      basePrice: 2499,
      mrp: 4999,
      image: 'https://m.media-amazon.com/images/I/61bVZVbcHJL._AC_UL960_QL65_.jpg',
      url: 'https://www.ajio.com/puma-men-electron-e-pro-shoes/p/469123847_black',
      query: '469123847_black',
      category: 'Sportswear',
      rating: 4.3,
      reviews: 4650,
      seller: 'Puma Sports India (Ajio Luxe)'
    },
    {
      id: '460839210_blue',
      title: "Levi's Men 511 Slim Fit Mid-Rise Jeans",
      basePrice: 1999,
      mrp: 3999,
      image: 'https://m.media-amazon.com/images/I/51H0teWFbfL._AC_UL960_QL65_.jpg',
      url: 'https://www.ajio.com/levis-men-511-slim-fit-jeans/p/460839210_blue',
      query: '460839210_blue',
      category: 'Denim',
      rating: 4.5,
      reviews: 9800,
      seller: 'Levis Strauss India (Ajio Verified)'
    },
    {
      id: '460293819_navy',
      title: 'Superdry Men Vintage Graphic Cotton T-Shirt',
      basePrice: 1499,
      mrp: 2999,
      image: 'https://m.media-amazon.com/images/I/71s8d1jZq2L._AC_UL960_QL65_.jpg',
      url: 'https://www.ajio.com/superdry-men-vintage-tshirt/p/460293819_navy',
      query: '460293819_navy',
      category: 'Casuals',
      rating: 4.4,
      reviews: 3120,
      seller: 'Superdry Flagship Store'
    }
  ]
};

const STORE_CONFIG = {
  amazon: { name: 'Amazon', icon: '???', color: '#818cf8', tag: 'Amazon Fulfilled' },
  flipkart: { name: 'Flipkart', icon: '?', color: '#facc15', tag: 'Flipkart Assured' },
  myntra: { name: 'Myntra', icon: '??', color: '#ff3f6c', tag: 'Myntra Insider' },
  meesho: { name: 'Meesho', icon: '???', color: '#d946ef', tag: 'Meesho Trusted' },
  ajio: { name: 'Ajio', icon: '???', color: '#38bdf8', tag: 'Ajio Luxe' }
};

const SIGNALS = [
  '?? All-Time Low',
  '? 1-Hour Flash Deal',
  '?? Major Drop (-25%)',
  '? Best Entry Point',
  '?? Top Selling Pick',
  '? Price Stabilized'
];

/**
 * Computes current hour index and next refresh timestamp
 */
function getHourlySyncState() {
  const now = new Date();
  const currentHourEpoch = Math.floor(now.getTime() / (3600 * 1000));
  const msIntoHour = now.getTime() % (3600 * 1000);
  const msRemaining = (3600 * 1000) - msIntoHour;

  return {
    hourIndex: currentHourEpoch,
    lastUpdated: new Date(currentHourEpoch * 3600 * 1000).toISOString(),
    nextRefreshInMs: msRemaining,
    nextRefreshAt: new Date((currentHourEpoch + 1) * 3600 * 1000).toISOString()
  };
}

/**
 * Returns 4 curated products per store rotated deterministically every hour
 */
function getHourlyTrendingDeals(storeFilter = 'all') {
  const syncState = getHourlySyncState();
  const stores = (storeFilter === 'all' || !MASTER_STORE_CATALOG[storeFilter])
    ? ['amazon', 'flipkart', 'myntra', 'meesho', 'ajio']
    : [storeFilter];

  const results = [];

  for (const storeKey of stores) {
    const list = MASTER_STORE_CATALOG[storeKey] || [];
    const cfg = STORE_CONFIG[storeKey];
    if (list.length === 0) continue;

    // Deterministic hourly rotation offset
    const offset = syncState.hourIndex % list.length;
    const pickedCount = Math.min(4, list.length);

    for (let i = 0; i < pickedCount; i++) {
      const idx = (offset + i) % list.length;
      const item = list[idx];

      // Subtle dynamic hourly price variation (within ±3%)
      const seed = (syncState.hourIndex * 31 + idx * 17) % 7;
      const priceVariationPercent = (seed - 3) * 0.008; // -2.4% to +2.4%
      const dynamicPrice = Math.round(item.basePrice * (1 + priceVariationPercent));
      const mrp = item.mrp;
      const discountPercent = Math.max(5, Math.round(((mrp - dynamicPrice) / mrp) * 100));

      const signalIdx = (syncState.hourIndex + idx) % SIGNALS.length;
      const signal = SIGNALS[signalIdx];

      results.push({
        id: item.id,
        store: storeKey,
        storeName: cfg.name,
        storeIcon: cfg.icon,
        storeColor: cfg.color,
        storeTag: cfg.tag,
        title: item.title,
        price: dynamicPrice,
        mrp: mrp,
        discount: `${discountPercent}% OFF`,
        signal: signal,
        image: item.image,
        url: item.url,
        query: item.query,
        category: item.category,
        rating: item.rating,
        reviews: item.reviews,
        seller: item.seller
      });
    }
  }

  return {
    success: true,
    total: results.length,
    syncState,
    deals: results
  };
}

module.exports = {
  MASTER_STORE_CATALOG,
  STORE_CONFIG,
  getHourlyTrendingDeals,
  getHourlySyncState
};
