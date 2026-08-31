const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const deliveryRoutes = require('./routes/delivery.routes');
const adminRoutes = require('./routes/admin.routes');
const paymentRoutes = require('./routes/payment.routes');
const { handleWebhook } = require('./controllers/payment.controller');

const app = express();

// Allowed origins = the 3 frontends (customer website, delivery partner app, admin dashboard)
// In dev, if ALLOWED_ORIGINS is not set, allow everything so local testing isn't blocked.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : true;

// Global middleware
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));

// IMPORTANT: Razorpay webhook needs the RAW body to verify its signature,
// so this must be registered BEFORE express.json() below.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => res.json({ success: true, message: 'Server running' }));

// ===== ROUTE MAP =====
app.use('/api/auth', authRoutes);          // Login/signup sync (customer + delivery)
app.use('/api/products', productRoutes);   // Frontend menu (public)
app.use('/api/orders', orderRoutes);       // Frontend -> place & track orders
app.use('/api/delivery', deliveryRoutes);  // Delivery Partner App
app.use('/api/admin', adminRoutes);        // Admin Dashboard
app.use('/api/payments', paymentRoutes);   // Razorpay create-order + verify (webhook registered above, separately)

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Global error handler
app.use((err, req, res, next) => {
  // Multer errors (bad file type, too large) - send a clean message instead of a crash
  if (err.name === 'MulterError' || err.message?.includes('images are allowed')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;
