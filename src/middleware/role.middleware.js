const pool = require('../config/db');

/**
 * Checks which role the firebase_uid belongs to (customer / delivery_partner / admin)
 * and blocks access if it doesn't match the required role for that route.
 *
 * Usage: router.get('/route', verifyFirebaseToken, requireRole('admin'), controllerFn)
 */
const requireRole = (role) => {
  return async (req, res, next) => {
    try {
      const uid = req.firebaseUser.uid;
      let table;

      if (role === 'customer') table = 'users';
      else if (role === 'delivery_partner') table = 'delivery_partners';
      else if (role === 'admin') table = 'admins';
      else return res.status(500).json({ success: false, message: 'Invalid role config' });

      const result = await pool.query(
        `SELECT * FROM ${table} WHERE firebase_uid = $1`,
        [uid]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ success: false, message: `Access denied - not registered as ${role}` });
      }

      // Attach the DB record (with internal numeric id) for use in controllers
      req.dbUser = result.rows[0];
      req.role = role;
      next();
    } catch (error) {
      console.error('Role check failed:', error.message);
      res.status(500).json({ success: false, message: 'Server error during role check' });
    }
  };
};

module.exports = requireRole;
