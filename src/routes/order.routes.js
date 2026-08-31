const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const { createOrder, getMyOrders, getOrderById } = require('../controllers/order.controller');

// All order routes require a logged-in customer
router.use(verifyFirebaseToken, requireRole('customer'));

router.post('/', createOrder);          // Place new order
router.get('/', getMyOrders);           // Customer's order history
router.get('/:id', getOrderById);       // Live tracking for a single order

module.exports = router;
