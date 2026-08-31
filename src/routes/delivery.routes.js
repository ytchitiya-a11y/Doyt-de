const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const {
  getAssignedOrders,
  acceptOrder,
  rejectOrder,
  markPickedUp,
  markDelivered,
  updateLocation,
  toggleAvailability,
} = require('../controllers/delivery.controller');

// All delivery routes require a logged-in delivery partner
router.use(verifyFirebaseToken, requireRole('delivery_partner'));

router.get('/orders', getAssignedOrders);            // "Order received" screen data
router.post('/orders/:orderId/accept', acceptOrder);
router.post('/orders/:orderId/reject', rejectOrder); // auto-reassigns to next partner
router.post('/orders/:orderId/picked-up', markPickedUp);
router.post('/orders/:orderId/delivered', markDelivered);
router.post('/location', updateLocation);            // Sent every few seconds during delivery
router.post('/availability', toggleAvailability);    // Online/Offline toggle

module.exports = router;
