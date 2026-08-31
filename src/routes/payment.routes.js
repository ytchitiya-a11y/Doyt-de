const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const { createRazorpayOrder, verifyPayment } = require('../controllers/payment.controller');

// Both require a logged-in customer (webhook is registered separately in app.js - no auth, Razorpay calls it directly)
router.post('/create-order', verifyFirebaseToken, requireRole('customer'), createRazorpayOrder);
router.post('/verify', verifyFirebaseToken, requireRole('customer'), verifyPayment);

module.exports = router;
