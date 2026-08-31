const admin = require('../config/firebase');

/**
 * Verifies Firebase ID token sent from Frontend / Delivery App / Admin Dashboard.
 * Expected header: Authorization: Bearer <firebase_id_token>
 *
 * This is the SINGLE ENTRY POINT for auth - every protected route passes through this first.
 */
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const idToken = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Attach decoded firebase user info to request for use in controllers
    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      phone: decodedToken.phone_number || null,
    };

    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = verifyFirebaseToken;
