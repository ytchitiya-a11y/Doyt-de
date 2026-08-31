const pool = require('../config/db');

// Frontend calls this to show the menu (chola bhatura, chaat, grocery items)
const getAllProducts = async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM products WHERE is_available = true';
    const params = [];

    if (category) {
      query += ' AND category = $1';
      params.push(category);
    }
    query += ' ORDER BY id DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, products: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching products' });
  }
};

// Frontend calls this for a single product's detail page
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching product' });
  }
};

module.exports = { getAllProducts, getProductById };
