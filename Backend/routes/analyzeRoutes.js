const express = require('express');
const router = express.Router();
const { analyze, getTrendingDeals } = require('../controllers/analyzeController');

router.get('/analyze', analyze);
router.get('/trending-deals', getTrendingDeals);

module.exports = router;