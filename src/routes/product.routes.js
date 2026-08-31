const express = require('express');
const router = express.Router();
const { getAllProducts, getProductById } = require('../controllers/product.controller');

// No auth needed - anyone can browse the menu
router.get('/', getAllProducts);
router.get('/:id', getProductById);

module.exports = router;
