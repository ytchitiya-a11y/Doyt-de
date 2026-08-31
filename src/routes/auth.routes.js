const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/auth.middleware');
const { syncCustomer, syncDeliveryPartner } = require('../controllers/auth.controller');

// Called right after Firebase login on frontend/delivery app
router.post('/customer/sync', verifyFirebaseToken, syncCustomer);
router.post('/delivery/sync', verifyFirebaseToken, syncDeliveryPartner);

module.exports = router;
