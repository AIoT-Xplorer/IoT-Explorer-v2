// server.js
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 }, () => {
  console.log('WS listening on ws://localhost:8080');
});

wss.on('connection', (ws) => {
  console.log('client connected');

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'char') {
        console.log(`[CHAR] ${data.value}  (conf=${(data.confidence*100).toFixed(0)}%)  ts=${new Date(data.ts).toISOString()}`);
        // TODO: aici poți forwarda spre orice: serial, MQTT, HTTP, DB etc.
      }
    } catch (e) {
      console.log('message:', msg.toString());
    }
  });

  ws.on('close', () => console.log('client disconnected'));
});
