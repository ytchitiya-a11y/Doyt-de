let ioInstance = null;

/**
 * Initializes Socket.io on top of the HTTP server.
 * Rooms used:
 *   user_<id>              -> that specific customer
 *   partner_<id>           -> that specific delivery partner
 *   admin_room              -> all admin dashboards
 */
const initSocket = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log('🔌 New socket connected:', socket.id);

    // Client tells server which room to join right after connecting
    socket.on('join_room', ({ role, id }) => {
      if (role === 'customer') socket.join(`user_${id}`);
      if (role === 'delivery_partner') socket.join(`partner_${id}`);
      if (role === 'admin') socket.join('admin_room');
      console.log(`Socket ${socket.id} joined room for ${role} ${id || ''}`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected:', socket.id);
    });
  });
};

// Emits new order to a specific delivery partner
const notifyDeliveryPartner = (partnerId, order) => {
  if (!ioInstance) return;
  ioInstance.to(`partner_${partnerId}`).emit('new_order', order);
};

// Emits order status change to the customer who placed it
const notifyCustomer = (userId, orderUpdate) => {
  if (!ioInstance) return;
  ioInstance.to(`user_${userId}`).emit('order_status_update', orderUpdate);
};

// Emits any order event to all admin dashboards (for live monitoring)
const notifyAdmin = (eventName, data) => {
  if (!ioInstance) return;
  ioInstance.to('admin_room').emit(eventName, data);
};

module.exports = { initSocket, notifyDeliveryPartner, notifyCustomer, notifyAdmin };
