// server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 }); // You can change the port as needed

const rooms = {};

wss.on('connection', (ws, req) => {
    let currentRoom = null;
    let role = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'viewer-join' || data.type === 'broadcaster-join') {
                currentRoom = data.roomId;
                role = data.type === 'viewer-join' ? 'viewer' : 'broadcaster';

                if (!rooms[currentRoom]) {
                    rooms[currentRoom] = { broadcaster: null, viewers: [] };
                }

                if (role === 'broadcaster') {
                    rooms[currentRoom].broadcaster = ws;
                } else {
                    rooms[currentRoom].viewers.push(ws);
                }

                // Notify broadcaster if viewer joins
                if (role === 'viewer' && rooms[currentRoom].broadcaster) {
                    rooms[currentRoom].broadcaster.send(JSON.stringify({ type: 'viewer-joined' }));
                }

                return;
            }

            // Offer from broadcaster to viewer
            if (data.type === 'offer' && currentRoom) {
                const viewer = rooms[currentRoom].viewers.find(v => v !== ws && v.readyState === WebSocket.OPEN);
                viewer?.send(JSON.stringify({ type: 'offer', offer: data.offer }));
            }

            // Answer from viewer to broadcaster
            if (data.type === 'answer' && currentRoom) {
                rooms[currentRoom].broadcaster?.send(JSON.stringify({ type: 'answer', answer: data.answer }));
            }

            // ICE Candidate
            if (data.type === 'candidate') {
                if (role === 'broadcaster') {
                    rooms[currentRoom].viewers.forEach(v => v.send(JSON.stringify({ type: 'candidate', candidate: data.candidate })));
                } else if (role === 'viewer') {
                    rooms[currentRoom].broadcaster?.send(JSON.stringify({ type: 'candidate', candidate: data.candidate }));
                }
            }

        } catch (err) {
            console.error('Message parse error:', err);
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms[currentRoom]) {
            if (role === 'viewer') {
                rooms[currentRoom].viewers = rooms[currentRoom].viewers.filter(v => v !== ws);
            }
            if (role === 'broadcaster') {
                rooms[currentRoom].broadcaster = null;
            }
        }
    });
});

console.log('Signaling server is running on ws://localhost:8080');
