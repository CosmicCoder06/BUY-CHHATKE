# 📊 BuyChhatke — Amazon Price History & Deal Tracker

<div align="center">

![BuyChhatke Banner](https://img.shields.io/badge/BuyChhatke-Price%20Tracker-4338ca?style=for-the-badge&logo=amazon&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)

**Find Real Deals. Skip the Fake Ones.**

Track genuine price drops, analyse sellers, and shop smarter — every day.

[🚀 Live Demo](#) · [🐛 Report Bug](https://github.com/yourusername/buychhatke/issues) · [✨ Request Feature](https://github.com/yourusername/buychhatke/issues)

</div>

---

<!-- ## 📸 Screenshots

> *(Add screenshots to a `/screenshots` folder in your repo and update the paths below)*

| Hero / Search | Dashboard — Price Stats |
|---|---|
| ![Hero](screenshots/hero.png) | ![Dashboard](screenshots/dashboard.png) |

| Price History Chart | Deal Score Gauge |
|---|---|
| ![Chart](screenshots/chart.png) | ![Gauge](screenshots/gauge.png) | -->

---

## ✨ Features

- **🔍 ASIN / URL Parser** — Paste any Amazon India product URL or raw ASIN (10-character code) and the app extracts the ASIN automatically
- **📊 Price History Chart** — Interactive 30-day line chart (powered by Chart.js) with gradient fill, animated tooltips, and highlighted all-time high / low points
- **🤖 AI Deal Score** — A 0–100 deal score computed from price deviation, seller reliability, and review count — rendered as a smooth canvas gauge (green / amber / red)
- **💡 Smart Buy / Wait Recommendation** — Colour-coded banner (Buy Now · Fair Price · High Risk) with a plain-language reason
- **📈 Price Prediction** — 7-day next-week price range forecast based on recent trend slope
- **🏪 Seller Analysis** — Star rating, review count, delivery type, returns policy, and a trust badge (Trusted / Moderate / Low)
- **💰 Savings vs Average** — Shows how much cheaper (or more expensive) the current price is vs the 30-day average
- **🔔 Price Alert** — Set a target price and get an on-screen confirmation (ready to hook into a backend notification service)
- **🌙 Dark / Light Mode** — One-click theme toggle with preference persisted to `localStorage`
- **⚡ Animated Numbers** — All price/stat values count up with an ease-out cubic animation on load
- **🦴 Skeleton Loading** — Smooth skeleton UI while the API call is in-flight
- **📱 Fully Responsive** — Looks great on mobile, tablet, and desktop

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Markup | HTML5 (semantic) |
| Styling | Vanilla CSS3 — CSS custom properties, Grid, Flexbox |
| Logic | Vanilla JavaScript (ES2020+) |
| Charts | [Chart.js 4.4.1](https://www.chartjs.org/) via CDN |
| Fonts | Inter + DM Mono (Google Fonts) |
| Backend API | Node.js / Express (see `/server` — *connect your own price-data source*) |

---

## 🚀 Getting Started

### Prerequisites

- A modern web browser
- Node.js ≥ 18 (for the local API server)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/buychhatke.git
cd buychhatke

# 2. Install backend dependencies (if you have a server folder)
cd server
npm install

# 3. Start the API server on port 3000
npm start

# 4. Open the frontend
# Simply open index.html in your browser, or serve it:
npx serve . -p 8080
```

> **Note:** The frontend auto-detects whether it is running locally (`localhost:3000` or `file://`) and points API calls to `http://localhost:3000`. In production, the API base is the same origin.

### Environment Variables (server)

```env
PORT=3000
# Add your price-data API keys here, e.g.:
# KEEPA_API_KEY=your_key_here
```

---

<!-- ## 📂 Project Structure

```
buychhatke/
├── index.html          # Main HTML shell — navbar, hero, dashboard skeleton
├── style.css           # All styles — theme variables, components, animations
├── app.js              # Frontend logic — ASIN parsing, API calls, rendering
├── screenshots/        # UI screenshots for this README
│   ├── hero.png
│   ├── dashboard.png
│   ├── chart.png
│   └── gauge.png
└── server/             # (Optional) Node.js/Express backend
    ├── index.js
    └── package.json
```

--- -->

## 🔌 API Contract

The frontend calls one endpoint:

```
GET /api/analyze?asin=B0CHX3QBCH
```

**Expected JSON response shape:**

```jsonc
{
  "productTitle": "boAt Rockerz 450 Bluetooth Headphone",
  "productImage": "https://…",
  "currentPrice": 1299,
  "avgPrice": 1549,
  "highPrice": 1999,
  "lowPrice": 999,
  "deviation": -16.1,           // (currentPrice - avgPrice) / avgPrice * 100
  "sellerRating": 4.3,
  "reviewCount": 1820,
  "sellerReliable": true,
  "reason": "Price is well below the 30-day average.",
  "priceHistory": [
    { "date": "2025-03-01", "price": 1499 },
    { "date": "2025-03-02", "price": 1449 }
    // …30 data points
  ]
}
```

Plug in any price-history data source (Keepa API, your own scraper, mock data, etc.) and the frontend will render everything automatically.

---

## 🧠 Deal Score Algorithm

The score (0–100) is computed client-side:

```
Base score: 50

Price deviation:
  ≤ -20%  → +30   |  ≥ +25%  → -30
  ≤ -10%  → +20   |  ≥ +15%  → -20
  ≤  -5%  → +10   |  ≥  +5%  → -10

Seller reliability:
  Trusted seller  → +15
  Rating ≥ 3      →  +5
  Low trust       → -10

Review count:
  > 500 reviews  → +5
  < 50 reviews   → -5

Final = clamp(score, 0, 100)
```

Score ≥ 70 → 🟢 **Buy Now** | 45–69 → 🟡 **Fair Price** | < 45 → 🔴 **Wait / Skip**

---

## 🎨 Theme & Customisation

All colours are driven by CSS custom properties on `:root` and `[data-theme="dark"]`. To rebrand, edit the variables at the top of `style.css`:

```css
:root {
  --accent:   #4338ca;
  --accent-2: #6366f1;
  --green:    #22c55e;
  --red:      #ef4444;
  --amber:    #f59e0b;
  /* … */
}
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the project
2. Create your feature branch: `git checkout -b feature/AmazingFeature`
3. Commit your changes: `git commit -m 'Add AmazingFeature'`
4. Push to the branch: `git push origin feature/AmazingFeature`
5. Open a Pull Request

---

## 📋 Roadmap

- [ ] Flipkart price history support
- [ ] Email / WhatsApp price drop alerts
- [ ] Browser extension for one-click price check
- [ ] Comparison view (Amazon vs Flipkart)
- [ ] Historical fake-sale detector (flag inflated MRP tricks)
- [ ] PWA / installable mobile app

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 👨‍💻 Author

**Abhi Yadav**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/abhiyadavv07/)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/yourusername)

---

<div align="center">
Made with ❤️ for smarter shopping in India 🇮🇳
</div>