const crypto = require('crypto');
const pool = require('../config/db');
const razorpay = require('../config/razorpay');
const { notifyAdmin } = require('../sockets/socket');

/**
 * STEP 1: Called by frontend right after placing an order with payment_method = 'upi'/'razorpay'.
 * Creates a Razorpay order for the exact amount stored in our DB (never trust frontend amount)
 * and links it to our internal order via razorpay_order_id.
 */
const createRazorpayOrder = async (req, res) => {
  try {
    const { order_id } = req.body;
    const userId = req.dbUser.id;

    const orderRes = await pool.query(
      `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
      [order_id, userId]
    );
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const order = orderRes.rows[0];

    if (order.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Order is already paid' });
    }

    // Razorpay needs amount in paise (smallest currency unit)
    const amountInPaise = Math.round(Number(order.total_amount) * 100);

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `order_${order.id}`,
      notes: { internal_order_id: String(order.id) },
    });

    await pool.query(`UPDATE orders SET razorpay_order_id = $1 WHERE id = $2`, [razorpayOrder.id, order.id]);

    res.json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID, // safe to expose - this is the public key
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Could not create payment order' });
  }
};

/**
 * STEP 2: Called by frontend after the Razorpay checkout popup succeeds.
 * Verifies the payment signature server-side - THIS is what actually confirms
 * the payment is real and not spoofed by the client.
 */
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;
    const userId = req.dbUser.id;

    // Recreate the expected signature using our secret key and compare
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed - signature mismatch' });
    }

    const result = await pool.query(
      `UPDATE orders SET payment_status = 'paid', razorpay_payment_id = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 AND razorpay_order_id = $4 RETURNING *`,
      [razorpay_payment_id, order_id, userId, razorpay_order_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found for this payment' });
    }

    notifyAdmin('order_status_changed', { orderId: order_id, payment_status: 'paid' });

    res.json({ success: true, message: 'Payment verified', order: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Payment verification error' });
  }
};

/**
 * STEP 3 (safety net): Razorpay calls this directly if you configure a webhook
 * in the Razorpay dashboard. This catches payments that succeeded even if the
 * customer closed the browser before step 2 completed - keeps DB accurate.
 * Needs the raw request body (see app.js route registration) to verify signature.
 */
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body) // raw buffer
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      await pool.query(
        `UPDATE orders SET payment_status = 'paid', razorpay_payment_id = $1, updated_at = NOW()
         WHERE razorpay_order_id = $2 AND payment_status != 'paid'`,
        [payment.id, payment.order_id]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false });
  }
};

module.exports = { createRazorpayOrder, verifyPayment, handleWebhook };
