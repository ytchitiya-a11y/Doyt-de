const pool = require('../config/db');
const { uploadImageToCloudinary } = require('../services/upload.service');

// Admin sees ALL orders live (for monitoring dashboard)
const getAllOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, u.name AS customer_name, dp.name AS delivery_partner_name
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN delivery_partners dp ON o.delivery_partner_id = dp.id
       ORDER BY o.created_at DESC LIMIT 100`
    );
    res.json({ success: true, orders: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching orders' });
  }
};

// Quick stats for dashboard homepage
const getDashboardStats = async (req, res) => {
  try {
    const totalOrders = await pool.query('SELECT COUNT(*) FROM orders');
    const pendingOrders = await pool.query(`SELECT COUNT(*) FROM orders WHERE status = 'pending'`);
    const deliveredToday = await pool.query(
      `SELECT COUNT(*) FROM orders WHERE status = 'delivered' AND created_at::date = CURRENT_DATE`
    );
    const activePartners = await pool.query(`SELECT COUNT(*) FROM delivery_partners WHERE status != 'offline'`);
    const revenueToday = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM orders
       WHERE status = 'delivered' AND created_at::date = CURRENT_DATE`
    );

    res.json({
      success: true,
      stats: {
        totalOrders: parseInt(totalOrders.rows[0].count),
        pendingOrders: parseInt(pendingOrders.rows[0].count),
        deliveredToday: parseInt(deliveredToday.rows[0].count),
        activePartners: parseInt(activePartners.rows[0].count),
        revenueToday: parseFloat(revenueToday.rows[0].revenue),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
};

// Add new product (chola bhatura, chaat, grocery item etc.)
// Expects multipart/form-data: fields (name, category, price, stock) + file field "image"
const addProduct = async (req, res) => {
  try {
    const { name, category, price, stock } = req.body;

    let imageUrl = '';
    if (req.file) {
      const result = await uploadImageToCloudinary(req.file.buffer);
      imageUrl = result.secure_url;
    }

    const result = await pool.query(
      `INSERT INTO products (name, category, price, image_url, stock)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, category, price, imageUrl, stock || 0]
    );
    res.status(201).json({ success: true, product: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message || 'Error adding product' });
  }
};

// Update product (price, availability, stock, and optionally replace image)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, is_available, stock } = req.body;

    let imageUrl = null;
    if (req.file) {
      const result = await uploadImageToCloudinary(req.file.buffer);
      imageUrl = result.secure_url;
    }

    const result = await pool.query(
      `UPDATE products SET name = COALESCE($1, name), price = COALESCE($2, price),
       is_available = COALESCE($3, is_available), stock = COALESCE($4, stock),
       image_url = COALESCE($5, image_url)
       WHERE id = $6 RETURNING *`,
      [name, price, is_available, stock, imageUrl, id]
    );
    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message || 'Error updating product' });
  }
};

// View all delivery partners and their live status
const getAllDeliveryPartners = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM delivery_partners ORDER BY created_at DESC');
    res.json({ success: true, partners: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching delivery partners' });
  }
};

module.exports = { getAllOrders, getDashboardStats, addProduct, updateProduct, getAllDeliveryPartners };
