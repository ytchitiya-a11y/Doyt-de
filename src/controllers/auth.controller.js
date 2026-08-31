const pool = require('../config/db');

/**
 * Called right after Firebase login on the frontend.
 * If user doesn't exist in PostgreSQL yet -> creates them.
 * If exists -> returns existing record.
 * This keeps Firebase (auth) and PostgreSQL (app data) in sync.
 */

// Customer signup/sync
const syncCustomer = async (req, res) => {
  try {
    const { uid, phone, email } = req.firebaseUser;
    const { name, address } = req.body;

    const existing = await pool.query('SELECT * FROM users WHERE firebase_uid = $1', [uid]);

    if (existing.rows.length > 0) {
      return res.json({ success: true, user: existing.rows[0], newUser: false });
    }

    const newUser = await pool.query(
      `INSERT INTO users (firebase_uid, name, phone, email, address)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [uid, name, phone, email, address]
    );

    res.status(201).json({ success: true, user: newUser.rows[0], newUser: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error syncing customer' });
  }
};

// Delivery partner signup/sync
const syncDeliveryPartner = async (req, res) => {
  try {
    const { uid, phone } = req.firebaseUser;
    const { name, vehicle_type } = req.body;

    const existing = await pool.query('SELECT * FROM delivery_partners WHERE firebase_uid = $1', [uid]);

    if (existing.rows.length > 0) {
      return res.json({ success: true, partner: existing.rows[0], newUser: false });
    }

    const newPartner = await pool.query(
      `INSERT INTO delivery_partners (firebase_uid, name, phone, vehicle_type)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [uid, name, phone, vehicle_type || 'bike']
    );

    res.status(201).json({ success: true, partner: newPartner.rows[0], newUser: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error syncing delivery partner' });
  }
};

module.exports = { syncCustomer, syncDeliveryPartner };
