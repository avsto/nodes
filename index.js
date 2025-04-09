// signaling-server.js
const WebSocket = require('ws');
const http = require('http');

// Create an HTTP server
const server = http.createServer();

// Attach WebSocket server to the HTTP server
const wss = new WebSocket.Server({ server });

// Keep track of rooms and their broadcasters/viewers
const rooms = {}; // { room_id: { broadcaster: ws, viewers: [ws, ...] } }

wss.on('connection', (ws, req) => {
    console.log('New client connected');

    let roomId = null;
    let role = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data);

            // Handle viewer/broadcaster joining
            if (data.type === 'viewer-join') {
                role = 'viewer';
                roomId = getRoomIdFromUrl(req.url);
                if (!rooms[roomId]) rooms[roomId] = { broadcaster: null, viewers: [] };
                rooms[roomId].viewers.push(ws);
            } else if (data.type === 'broadcaster-join') {
                role = 'broadcaster';
                roomId = getRoomIdFromUrl(req.url);
                if (!rooms[roomId]) rooms[roomId] = { broadcaster: null, viewers: [] };
                rooms[roomId].broadcaster = ws;
            }

            // Forward offer from broadcaster to viewers
            if (data.type === 'offer' && role === 'broadcaster') {
                rooms[roomId]?.viewers.forEach(viewer => {
                    viewer.send(JSON.stringify({ type: 'offer', offer: data.offer }));
                });
            }

            // Forward answer from viewer to broadcaster
            if (data.type === 'answer' && role === 'viewer') {
                rooms[roomId]?.broadcaster?.send(JSON.stringify({ type: 'answer', answer: data.answer }));
            }

            // Handle ICE candidates
            if (data.type === 'candidate') {
                if (role === 'broadcaster') {
                    rooms[roomId]?.viewers.forEach(viewer => {
                        viewer.send(JSON.stringify({ type: 'candidate', candidate: data.candidate }));
                    });
                } else if (role === 'viewer') {
                    rooms[roomId]?.broadcaster?.send(JSON.stringify({ type: 'candidate', candidate: data.candidate }));
                }
            }
        } catch (err) {
            console.error('Invalid message:', err);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (roomId && rooms[roomId]) {
            if (role === 'broadcaster') {
                // Notify all viewers broadcaster left
                rooms[roomId].viewers.forEach(viewer => {
                    viewer.send(JSON.stringify({ type: 'end' }));
                    viewer.close();
                });
                delete rooms[roomId];
            } else {
                // Remove viewer
                rooms[roomId].viewers = rooms[roomId].viewers.filter(v => v !== ws);
            }
        }
    });
});

function getRoomIdFromUrl(url) {
    // Example: /abc123 => abc123
    return url.split('/').pop();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`WebRTC signaling server running on port ${PORT}`);
});