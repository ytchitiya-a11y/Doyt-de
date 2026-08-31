const pool = require('../config/db');

/**
 * MVP assignment logic: picks the first AVAILABLE delivery partner.
 * excludePartnerIds -> used when reassigning after a reject, so the same
 * partner who just rejected doesn't get picked again.
 * (Later this can be upgraded to real distance-based sorting using lat/lng + PostGIS)
 */
const findAvailablePartner = async (excludePartnerIds = []) => {
  let query = `SELECT * FROM delivery_partners WHERE status = 'available'`;
  const params = [];

  if (excludePartnerIds.length > 0) {
    query += ` AND id NOT IN (${excludePartnerIds.map((_, i) => `$${i + 1}`).join(',')})`;
    params.push(...excludePartnerIds);
  }
  query += ' LIMIT 1';

  const result = await pool.query(query, params);
  return result.rows[0] || null;
};

module.exports = { findAvailablePartner };
