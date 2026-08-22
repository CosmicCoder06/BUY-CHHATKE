const path = require('path');
// Load environment variables from parent root or current directory
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const analyzeRoutes = require('./routes/analyzeRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.use('/api', analyzeRoutes);
app.use('/api', authRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`buySmarty Server running at http://localhost:${PORT}`);
});