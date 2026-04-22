const express = require('express');
const router = express.Router();
const { analyze } = require('../controllers/analyzeController');

router.get('/analyze', analyze);

module.exports = router;