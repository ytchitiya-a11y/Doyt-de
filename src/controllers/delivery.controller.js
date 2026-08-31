const pool = require('../config/db');
const { notifyCustomer, notifyAdmin, notifyDeliveryPartner } = require('../sockets/socket');
const { findAvailablePartner } = require('../services/assignment.service');

/**
 * This is what the Delivery Partner App calls when it opens - shows current assigned orders.
 * (In real-time, new orders also arrive via socket 'new_order' event, this is the fallback/refresh)
 */
const getAssignedOrders = async (req, res) => {
  try {
    const partnerId = req.dbUser.id;
    const result = await pool.query(
      `SELECT o.*, u.name AS customer_name, u.phone AS customer_phone
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.delivery_partner_id = $1 AND o.status NOT IN ('delivered', 'cancelled')
       ORDER BY o.created_at DESC`,
      [partnerId]
    );
    res.json({ success: true, orders: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching assigned orders' });
  }
};

// Delivery partner accepts the order shown on their screen
const acceptOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const partnerId = req.dbUser.id;

    const result = await pool.query(
      `UPDATE orders SET status = 'accepted', updated_at = NOW()
       WHERE id = $1 AND delivery_partner_id = $2 RETURNING *`,
      [orderId, partnerId]
    );

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = result.rows[0];
    notifyCustomer(order.user_id, { orderId: order.id, status: 'accepted' });
    notifyAdmin('order_status_changed', { orderId: order.id, status: 'accepted' });

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error accepting order' });
  }
};

// Delivery partner rejects the order -> backend frees them and auto-reassigns to next available partner
const rejectOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const { orderId } = req.params;
    const partnerId = req.dbUser.id;

    await client.query('BEGIN');

    // Log the rejection so this partner isn't picked again for this order
    await client.query(
      `INSERT INTO order_rejections (order_id, delivery_partner_id) VALUES ($1, $2)`,
      [orderId, partnerId]
    );

    // Free up the rejecting partner
    await client.query(`UPDATE delivery_partners SET status = 'available' WHERE id = $1`, [partnerId]);

    // Get all partners who already rejected this order (to exclude them)
    const rejectedRes = await client.query(
      `SELECT delivery_partner_id FROM order_rejections WHERE order_id = $1`,
      [orderId]
    );
    const excludeIds = rejectedRes.rows.map((r) => r.delivery_partner_id);

    // Find next available partner
    const nextPartner = await findAvailablePartner(excludeIds);

    let order;
    if (nextPartner) {
      const updateRes = await client.query(
        `UPDATE orders SET delivery_partner_id = $1, status = 'assigned', updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [nextPartner.id, orderId]
      );
      order = updateRes.rows[0];
      await client.query(`UPDATE delivery_partners SET status = 'busy' WHERE id = $1`, [nextPartner.id]);
    } else {
      // No partner available right now -> order goes back to pending, admin can see it needs manual attention
      const updateRes = await client.query(
        `UPDATE orders SET delivery_partner_id = NULL, status = 'pending', updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [orderId]
      );
      order = updateRes.rows[0];
    }

    await client.query('COMMIT');

    if (nextPartner) {
      notifyDeliveryPartner(nextPartner.id, order); // new order alert on next partner's app
    }
    notifyAdmin('order_status_changed', { orderId: order.id, status: order.status });
    notifyCustomer(order.user_id, { orderId: order.id, status: order.status });

    res.json({ success: true, order, reassigned: !!nextPartner });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ success: false, message: 'Error rejecting order' });
  } finally {
    client.release();
  }
};

// Delivery partner marks pickup done (picked from kitchen/store)
const markPickedUp = async (req, res) => {
  try {
    const { orderId } = req.params;
    const partnerId = req.dbUser.id;

    const result = await pool.query(
      `UPDATE orders SET status = 'picked_up', updated_at = NOW()
       WHERE id = $1 AND delivery_partner_id = $2 RETURNING *`,
      [orderId, partnerId]
    );

    const order = result.rows[0];
    notifyCustomer(order.user_id, { orderId: order.id, status: 'picked_up' });
    notifyAdmin('order_status_changed', { orderId: order.id, status: 'picked_up' });

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating order' });
  }
};

// Delivery partner marks order as delivered - final step, frees them up for next order
const markDelivered = async (req, res) => {
  const client = await pool.connect();
  try {
    const { orderId } = req.params;
    const partnerId = req.dbUser.id;

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE orders SET status = 'delivered', payment_status = 'paid', updated_at = NOW()
       WHERE id = $1 AND delivery_partner_id = $2 RETURNING *`,
      [orderId, partnerId]
    );

    // Free up the delivery partner so they can get new orders
    await client.query(`UPDATE delivery_partners SET status = 'available' WHERE id = $1`, [partnerId]);

    await client.query('COMMIT');

    const order = result.rows[0];
    notifyCustomer(order.user_id, { orderId: order.id, status: 'delivered' });
    notifyAdmin('order_status_changed', { orderId: order.id, status: 'delivered' });

    res.json({ success: true, order });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: 'Error completing delivery' });
  } finally {
    client.release();
  }
};

// Delivery partner's app sends location every few seconds while on a delivery
const updateLocation = async (req, res) => {
  try {
    const partnerId = req.dbUser.id;
    const { lat, lng } = req.body;

    await pool.query(
      `UPDATE delivery_partners SET current_lat = $1, current_lng = $2 WHERE id = $3`,
      [lat, lng, partnerId]
    );

    // Find active order for this partner to push live location to that customer
    const activeOrder = await pool.query(
      `SELECT user_id, id FROM orders WHERE delivery_partner_id = $1 AND status IN ('accepted','picked_up')`,
      [partnerId]
    );

    if (activeOrder.rows.length > 0) {
      const { user_id, id } = activeOrder.rows[0];
      notifyCustomer(user_id, { orderId: id, liveLocation: { lat, lng } });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating location' });
  }
};

// Toggle online/offline status (available to receive orders or not)
const toggleAvailability = async (req, res) => {
  try {
    const partnerId = req.dbUser.id;
    const { status } = req.body; // 'available' or 'offline'

    const result = await pool.query(
      `UPDATE delivery_partners SET status = $1 WHERE id = $2 RETURNING *`,
      [status, partnerId]
    );

    res.json({ success: true, partner: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating status' });
  }
};

module.exports = {
  getAssignedOrders,
  acceptOrder,
  rejectOrder,
  markPickedUp,
  markDelivered,
  updateLocation,
  toggleAvailability,
};
