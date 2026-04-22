require('dotenv').config();
const express = require('express');
const cors = require('cors');
const analyzeRoutes = require('./routes/analyzeRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api', analyzeRoutes);

app.listen(3000, () => console.log('Server running on http://localhost:3000'));