const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const broadcasters = {};

io.on("connection", (socket) => {

  console.log("Connected:", socket.id);

  // Admin Start Broadcast
  socket.on("broadcaster", ({ roomId }) => {

    broadcasters[roomId] = socket.id;

    socket.join(roomId);

    console.log("Broadcaster Started:", roomId);

  });

  // Listener Join Room
  socket.on("viewer", ({ roomId }) => {

    socket.join(roomId);

    const broadcasterId = broadcasters[roomId];

    if (broadcasterId) {

      io.to(broadcasterId).emit("viewer", {
        viewerId: socket.id,
      });

    }

  });

  // Send Offer
  socket.on("offer", ({ target, offer }) => {

    io.to(target).emit("offer", {
      sender: socket.id,
      offer,
    });

  });

  // Send Answer
  socket.on("answer", ({ target, answer }) => {

    io.to(target).emit("answer", {
      sender: socket.id,
      answer,
    });

  });

  // ICE Candidate
  socket.on("candidate", ({ target, candidate }) => {

    io.to(target).emit("candidate", {
      sender: socket.id,
      candidate,
    });

  });

  // Disconnect
  socket.on("disconnect", () => {

    console.log("Disconnected:", socket.id);

    for (let roomId in broadcasters) {

      if (broadcasters[roomId] === socket.id) {

        delete broadcasters[roomId];

      }

    }

  });

});

server.listen(5000, () => {
  console.log("Server Running On Port 5000");
});
