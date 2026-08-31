const pool = require('../config/db');
const { findAvailablePartner } = require('../services/assignment.service');
const { notifyDeliveryPartner, notifyAdmin } = require('../sockets/socket');

/**
 * STEP 1 of the flow: Customer places an order from Frontend.
 * Body: { items: [{ product_id, quantity }], delivery_address, payment_method }
 */
const createOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.dbUser.id;
    const { items, delivery_address, payment_method } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    await client.query('BEGIN');

    // Calculate total from actual DB prices (never trust frontend price)
    let totalAmount = 0;
    const productDetails = [];

    for (const item of items) {
      const productRes = await client.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (productRes.rows.length === 0) throw new Error(`Product ${item.product_id} not found`);
      const product = productRes.rows[0];
      totalAmount += parseFloat(product.price) * item.quantity;
      productDetails.push({ ...product, quantity: item.quantity });
    }

    // Insert order
    const orderRes = await client.query(
      `INSERT INTO orders (user_id, total_amount, delivery_address, payment_method, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [userId, totalAmount, delivery_address, payment_method || 'cod']
    );
    const order = orderRes.rows[0];

    // Insert order items
    for (const p of productDetails) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)`,
        [order.id, p.id, p.quantity, p.price]
      );
    }

    // STEP 2: Backend finds an available delivery partner and assigns
    const partner = await findAvailablePartner();
    if (partner) {
      await client.query(
        `UPDATE orders SET delivery_partner_id = $1, status = 'assigned' WHERE id = $2`,
        [partner.id, order.id]
      );
      await client.query(`UPDATE delivery_partners SET status = 'busy' WHERE id = $1`, [partner.id]);
    }

    await client.query('COMMIT');

    const finalOrder = { ...order, items: productDetails, assigned_partner: partner || null };

    // STEP 3: Notify delivery partner app in real-time (this is the "order received" screen)
    if (partner) {
      notifyDeliveryPartner(partner.id, finalOrder);
    }

    // Notify admin dashboard for live monitoring
    notifyAdmin('new_order_placed', finalOrder);

    res.status(201).json({ success: true, order: finalOrder });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ success: false, message: error.message || 'Error creating order' });
  } finally {
    client.release();
  }
};

// Customer checks their own order list
const getMyOrders = async (req, res) => {
  try {
    const userId = req.dbUser.id;
    const result = await pool.query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ success: true, orders: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching orders' });
  }
};

// Customer tracks a single order (for live tracking screen)
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT o.*, dp.name AS delivery_partner_name, dp.phone AS delivery_partner_phone,
              dp.current_lat, dp.current_lng
       FROM orders o
       LEFT JOIN delivery_partners dp ON o.delivery_partner_id = dp.id
       WHERE o.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching order' });
  }
};

module.exports = { createOrder, getMyOrders, getOrderById };
