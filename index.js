// Node.js API (using Express.js and Socket.IO)

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const liveSessions = {};

app.post('/streaming/start-live', (req, res) => {
  const room_id = generateRoomId(); // Implement your room ID generation
  const user_id = req.headers.authorization; // Example: extract user ID from auth header
  liveSessions[room_id] = { user_id, room_id, viewers: [] };
  res.json({ room_id });
});

app.post('/streaming/end-live', (req, res) => {
  const user_id = req.headers.authorization;
  const room_id = Object.keys(liveSessions).find(key => liveSessions[key].user_id === user_id);
  if (room_id) {
    delete liveSessions[room_id];
    io.to(room_id).emit('streamEnded');
    res.json({ message: 'Live ended' });
  } else {
    res.status(404).json({ error: 'Live session not found' });
  }
});

app.get('/streaming/get', (req, res) => {
  const sessions = Object.values(liveSessions);
  res.json({ sessions });
});

app.post('/streaming/joinRoom', (req, res) => {
  const { live_session_id } = req.body;
  const room_id = Object.keys(liveSessions).find(key => liveSessions[key].id === live_session_id);

  if (room_id) {
    liveSessions[room_id].viewers.push(req.headers.authorization);
    res.json({ message: 'Joined room' });

  } else {
    res.status(404).json({ error: 'Live session not found' });
  }
});

io.on('connection', (socket) => {
  let room_id;
  let role;

  socket.on('message', async (message) => {
    const data = JSON.parse(message);
    room_id = socket.nsp.name.substring(1); // extract room_id from namespace.

    if(data.type === "broadcaster-join"){
        role = "broadcaster";
        socket.join(room_id);
        io.to(room_id).emit("viewer-join", { from: socket.id });
    }
    if(data.type === "viewer-join"){
        role = "viewer";
        socket.join(room_id);
        io.to(room_id).emit("viewer-join", { from: socket.id });
    }
    if(data.type === "offer"){
        io.to(room_id).emit('offer', { offer: data.offer, from: socket.id });
    }
    if(data.type === "answer"){
        io.to(room_id).emit('answer', { answer: data.answer, from: socket.id });
    }
    if(data.type === "candidate"){
        io.to(room_id).emit('candidate', { candidate: data.candidate, from: socket.id });
    }
  });

  socket.on('disconnect', () => {
    if (room_id && liveSessions[room_id]) {
        if(role === "broadcaster"){
            delete liveSessions[room_id];
            io.to(room_id).emit("streamEnded");
        } else {
            liveSessions[room_id].viewers = liveSessions[room_id].viewers.filter(viewer => viewer !== socket.id);
            io.to(room_id).emit("viewerLeft", socket.id);
        }
    }
  });

});

function generateRoomId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
