const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

io.on('connection', (socket) => {
  let room_id;
  let role;

  socket.on('joinRoom', (data) => {
    room_id = data.room_id;
    socket.join(room_id);
    console.log(`Socket ${socket.id} joined room ${room_id}`);
  });

  socket.on('broadcaster', () => {
    role = 'broadcaster';
  });

  socket.on('viewer', () => {
    role = 'viewer';
  });

  socket.on('message', (message) => {
    const data = JSON.parse(message);
    io.to(room_id).emit('message', data);
  });

  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
