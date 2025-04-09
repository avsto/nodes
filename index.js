// signaling-server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const rooms = {}; // { roomId: { broadcaster, viewers: [] } }
const viewerMap = new Map();

wss.on('connection', (ws) => {
    let roomId = null;
    let isBroadcaster = false;

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'broadcaster-join':
                roomId = data.roomId;
                isBroadcaster = true;
                if (!rooms[roomId]) rooms[roomId] = { broadcaster: ws, viewers: [] };
                rooms[roomId].broadcaster = ws;
                console.log(`Broadcaster joined room ${roomId}`);
                break;

            case 'viewer-join':
                roomId = data.roomId;
                isBroadcaster = false;
                if (!rooms[roomId]) rooms[roomId] = { broadcaster: null, viewers: [] };
                rooms[roomId].viewers.push(ws);
                viewerMap.set(ws, roomId);
                console.log(`Viewer joined room ${roomId}`);

                if (rooms[roomId].broadcaster) {
                    rooms[roomId].broadcaster.send(JSON.stringify({ type: 'viewer-joined' }));
                }
                break;

            case 'offer':
                const lastViewer = rooms[roomId]?.viewers.at(-1);
                if (lastViewer) {
                    lastViewer.send(JSON.stringify({ type: 'offer', offer: data.offer }));
                }
                break;

            case 'answer':
                rooms[roomId]?.broadcaster?.send(JSON.stringify({ type: 'answer', answer: data.answer }));
                break;

            case 'candidate':
                if (isBroadcaster) {
                    rooms[roomId]?.viewers.forEach(v =>
                        v.send(JSON.stringify({ type: 'candidate', candidate: data.candidate }))
                    );
                } else {
                    rooms[roomId]?.broadcaster?.send(JSON.stringify({ type: 'candidate', candidate: data.candidate }));
                }
                break;

            default:
                console.log('Unknown message type:', data.type);
        }
    });

    ws.on('close', () => {
        if (!roomId) return;
        if (isBroadcaster) {
            console.log(`Broadcaster left room ${roomId}`);
            rooms[roomId].broadcaster = null;
        } else {
            rooms[roomId].viewers = rooms[roomId].viewers.filter(v => v !== ws);
            viewerMap.delete(ws);
            console.log(`Viewer left room ${roomId}`);
        }
    });
});

console.log('Signaling server running on ws://localhost:8080');
