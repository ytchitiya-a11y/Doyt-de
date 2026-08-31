const express = require('express');
const router = express.Router();
const verifyFirebaseToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const upload = require('../middleware/upload.middleware');
const {
  getAllOrders,
  getDashboardStats,
  addProduct,
  updateProduct,
  getAllDeliveryPartners,
} = require('../controllers/admin.controller');

// All admin routes require a logged-in admin
router.use(verifyFirebaseToken, requireRole('admin'));

router.get('/orders', getAllOrders);
router.get('/stats', getDashboardStats);
router.post('/products', upload.single('image'), addProduct);       // multipart/form-data with "image" file field
router.put('/products/:id', upload.single('image'), updateProduct); // image optional on update
router.get('/delivery-partners', getAllDeliveryPartners);

module.exports = router;
