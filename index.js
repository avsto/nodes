const WebSocket = require('ws');
const http = require('http');

const port = process.env.PORT || 8080;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = {}; // room_id: { broadcaster: ws, viewers: Set<ws> }

wss.on('connection', (ws, req) => {
    let currentRoom = null;
    let role = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // Room is part of URL path, e.g. /room123
            const url = req.url; // e.g. "/room123"
            const roomId = url.split('/')[1];
            if (!roomId) return;

            currentRoom = roomId;

            // Room setup
            if (!rooms[roomId]) {
                rooms[roomId] = { broadcaster: null, viewers: new Set() };
            }

            // Role assignment
            if (data.type === 'broadcaster-join') {
                role = 'broadcaster';
                rooms[roomId].broadcaster = ws;
                console.log(`🎥 Broadcaster joined room ${roomId}`);
            }

            if (data.type === 'viewer-join') {
                role = 'viewer';
                rooms[roomId].viewers.add(ws);
                console.log(`👤 Viewer joined room ${roomId}`);
            }

            // Forward offer/answer/candidate between broadcaster & viewer
            if (data.type === 'offer' && role === 'broadcaster') {
                for (let viewer of rooms[roomId].viewers) {
                    viewer.send(JSON.stringify({ type: 'offer', offer: data.offer }));
                }
            }

            if (data.type === 'answer' && role === 'viewer') {
                if (rooms[roomId].broadcaster) {
                    rooms[roomId].broadcaster.send(JSON.stringify({ type: 'answer', answer: data.answer }));
                }
            }

            if (data.type === 'candidate') {
                if (role === 'broadcaster') {
                    for (let viewer of rooms[roomId].viewers) {
                        viewer.send(JSON.stringify({ type: 'candidate', candidate: data.candidate }));
                    }
                } else if (role === 'viewer') {
                    if (rooms[roomId].broadcaster) {
                        rooms[roomId].broadcaster.send(JSON.stringify({ type: 'candidate', candidate: data.candidate }));
                    }
                }
            }
        } catch (err) {
            console.error('Failed to process message:', err);
        }
    });

    ws.on('close', () => {
        if (!currentRoom) return;

        if (role === 'broadcaster') {
            console.log(`❌ Broadcaster left room ${currentRoom}`);
            for (let viewer of rooms[currentRoom].viewers) {
                viewer.send(JSON.stringify({ type: 'host-left' }));
                viewer.close();
            }
            rooms[currentRoom].broadcaster = null;
            rooms[currentRoom].viewers.clear();
        }

        if (role === 'viewer') {
            console.log(`👋 Viewer left room ${currentRoom}`);
            rooms[currentRoom].viewers.delete(ws);
        }

        // Cleanup room if empty
        if (
            rooms[currentRoom] &&
            !rooms[currentRoom].broadcaster &&
            rooms[currentRoom].viewers.size === 0
        ) {
            delete rooms[currentRoom];
            console.log(`🧹 Cleaned up empty room: ${currentRoom}`);
        }
    });
});

server.on('request', (req, res) => {
    res.writeHead(200);
    res.end("WebRTC signaling server running.");
});

server.listen(port, () => {
    console.log(`🚀 WebSocket signaling server running on port ${port}`);
});
