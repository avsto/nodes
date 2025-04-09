const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = {}; // room_id => { broadcaster: ws, viewers: Set<ws> }

wss.on('connection', (ws, req) => {
  const urlParts = req.url.split('/');
  const roomId = urlParts[urlParts.length - 1];
  console.log(`New connection for room: ${roomId}`);

  if (!rooms[roomId]) {
    rooms[roomId] = { broadcaster: null, viewers: new Set() };
  }

  ws.on('message', (message) => {
    let data;

    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error('Invalid JSON:', e);
      return;
    }

    const { type } = data;

    if (type === 'broadcaster-join') {
      rooms[roomId].broadcaster = ws;
      ws.isBroadcaster = true;
      console.log(`Broadcaster joined room ${roomId}`);
    }

    if (type === 'viewer-join') {
      rooms[roomId].viewers.add(ws);
      ws.isViewer = true;
      console.log(`Viewer joined room ${roomId}`);

      // Notify broadcaster a viewer joined
      const broadcaster = rooms[roomId].broadcaster;
      if (broadcaster && broadcaster.readyState === WebSocket.OPEN) {
        broadcaster.send(JSON.stringify({ type: 'viewer-join' }));
      }
    }

    if (type === 'offer') {
      const viewers = rooms[roomId].viewers;
      viewers.forEach(viewer => {
        if (viewer.readyState === WebSocket.OPEN) {
          viewer.send(JSON.stringify({ type: 'offer', offer: data.offer }));
        }
      });
    }

    if (type === 'answer') {
      const broadcaster = rooms[roomId].broadcaster;
      if (broadcaster && broadcaster.readyState === WebSocket.OPEN) {
        broadcaster.send(JSON.stringify({ type: 'answer', answer: data.answer }));
      }
    }

    if (type === 'candidate') {
      if (ws.isBroadcaster) {
        // Send ICE candidate to all viewers
        rooms[roomId].viewers.forEach(viewer => {
          if (viewer.readyState === WebSocket.OPEN) {
            viewer.send(JSON.stringify({ type: 'candidate', candidate: data.candidate }));
          }
        });
      } else if (ws.isViewer) {
        const broadcaster = rooms[roomId].broadcaster;
        if (broadcaster && broadcaster.readyState === WebSocket.OPEN) {
          broadcaster.send(JSON.stringify({ type: 'candidate', candidate: data.candidate }));
        }
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    if (ws.isViewer) {
      rooms[roomId]?.viewers.delete(ws);
    }
    if (ws.isBroadcaster) {
      rooms[roomId]?.viewers.forEach(viewer => {
        viewer.close(); // close all viewers if broadcaster disconnects
      });
      delete rooms[roomId]; // clean up room
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Signaling server is running on port ${PORT}`);
});
