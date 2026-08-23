const path = require('path');
// Load environment variables from parent root or current directory
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const { initDealUpdater } = require('./jobs/dealUpdater');
const analyzeRoutes = require('./routes/analyzeRoutes');
const authRoutes = require('./routes/authRoutes');
const dealRoutes = require('./routes/dealRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect Database & Launch Cron Workers
connectDB().then(() => {
  initDealUpdater();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'buySmarty API',
    timestamp: new Date().toISOString(),
    rapidApiConfigured: Boolean(process.env.RAPIDAPI_KEY),
    smtpConfigured: Boolean(process.env.GMAIL_USER || process.env.SMTP_USER || process.env.SMTP_HOST)
  });
});

// Image Proxy to safely load Amazon & Flipkart images without CDN hotlinking blocks
app.get('/api/image-proxy', async (req, res) => {
  const target = req.query.url;
  if (!target || typeof target !== 'string' || !target.startsWith('http')) {
    return res.status(400).send('Invalid or missing image URL');
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const imageRes = await fetch(target, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    clearTimeout(timeoutId);

    if (!imageRes.ok) {
      return res.redirect(target);
    }

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    return res.send(buffer);
  } catch (err) {
    return res.redirect(target);
  }
});

app.use('/api', analyzeRoutes);
app.use('/api', authRoutes);
app.use('/api', dealRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`buySmarty Server running at http://localhost:${PORT}`);
});