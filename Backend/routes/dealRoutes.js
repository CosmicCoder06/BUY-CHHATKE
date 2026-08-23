const express = require('express');
const router = express.Router();
const { getDeals, getDealById, triggerSync } = require('../controllers/dealController');

router.get('/deals', getDeals);
router.get('/deals/:id', getDealById);
router.post('/deals/sync', triggerSync);

module.exports = router;
