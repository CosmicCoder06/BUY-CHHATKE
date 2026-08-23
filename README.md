# buySmartly — Price Intelligence for Indian Shopping

buySmartly helps shoppers scan supported product links, review price insights, save products after login, and open a live product assistant through its Chrome extension.

## Supported stores

| Store | Website scan | Chrome extension |
|---|---:|---:|
| Amazon | ✅ | ✅ |
| Flipkart | ✅ | ✅ |
| Myntra | ✅ | ✅ |
| Meesho | Extension handoff | ✅ |
| Ajio | ✅ | ✅ |
| Croma | ✅ | ✅ |

> Website scans for Amazon, Myntra, Ajio, and Croma use the configured RapidAPI product-data provider. The extension reads the live product page, so it can show the price currently visible to the shopper.

## Features

- Paste a product URL to analyse title, image, current price, price history, and deal score.
- Deal recommendation: **Buy**, **Fair Price**, or **Wait**.
- Dark/light theme, price alerts, recent searches, and responsive dashboard.
- Login-protected wishlist.
- Chrome extension with live product detection and dashboard handoff.

## Tech stack

- Frontend: HTML, CSS, vanilla JavaScript, Chart.js
- Backend: Node.js, Express, MongoDB
- Product data: RapidAPI
- Browser integration: Chrome Extension (Manifest V3)

## Run locally

```bash
git clone https://github.com/CosmicCoder06/BUY-CHHATKE.git
cd BUY-CHHATKE/Backend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create `.env` in the repository root:

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/buy-chhatke
RAPIDAPI_KEY=your_rapidapi_key
```

The RapidAPI key must be subscribed to the **Realtime flipkart amazon myntra ajio croma product details** API for the multi-store endpoint.

## Chrome extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the [`Extension`](./Extension) folder.

Reload the extension whenever files in that folder change.

## Project structure

```text
Backend/          Express API, database, services, and web dashboard
Extension/        Manifest V3 Chrome extension
Backend/public/   Frontend files
```

## Important notes

- Never commit `.env` or API keys.
- RapidAPI free plans can apply monthly quotas and high latency.
- Live prices vary by seller, address, coupons, and product variant.

## Author

**Abhinav Yadav**

[LinkedIn](https://www.linkedin.com/in/abhiyadavv07/) · [GitHub](https://github.com/CosmicCoder06)
