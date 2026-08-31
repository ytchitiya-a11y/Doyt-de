const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = require('./app');
const { initSocket } = require('./sockets/socket');

const PORT = process.env.PORT || 5000;

// Create raw HTTP server so Express + Socket.io can share the same port
const server = http.createServer(app);

// Attach Socket.io for real-time order updates (frontend, delivery app, admin)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : true;

const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});

initSocket(io);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
