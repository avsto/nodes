// Node.js API (using Express.js and Socket.IO)

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

const liveSessions = {};

io.on('connection', (socket) => {
  let room_id;
  let role;

  socket.on('message', async (message) => {
    const data = JSON.parse(message);
    room_id = socket.nsp.name.substring(1);

    if (data.type === 'broadcaster-join') {
      role = 'broadcaster';
      socket.join(room_id);
      io.to(room_id).emit('viewer-join', { from: socket.id });
    }
    if (data.type === 'viewer-join') {
      role = 'viewer';
      socket.join(room_id);
      io.to(room_id).emit('viewer-join', { from: socket.id });
    }
    if (data.type === 'offer') {
      io.to(room_id).emit('offer', { offer: data.offer, from: socket.id });
    }
    if (data.type === 'answer') {
      io.to(room_id).emit('answer', { answer: data.answer, from: socket.id });
    }
    if (data.type === 'candidate') {
      io.to(room_id).emit('candidate', { candidate: data.candidate, from: socket.id });
    }
  });

  socket.on('disconnect', () => {
    if (room_id && liveSessions[room_id]) {
      if (role === 'broadcaster') {
        delete liveSessions[room_id];
        io.to(room_id).emit('streamEnded');
      } else {
        liveSessions[room_id].viewers = liveSessions[room_id].viewers.filter((viewer) => viewer !== socket.id);
        io.to(room_id).emit('viewerLeft', socket.id);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
