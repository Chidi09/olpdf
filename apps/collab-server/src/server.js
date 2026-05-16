require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');
const { WebSocketServer } = require('ws');
const { setPersistence } = require('y-websocket/bin/utils');
const { setupPersistence } = require('y-leveldb');

const JWT_SECRET = process.env.JWT_SECRET || '';
const server = http.createServer((_req, res) => res.end('Collab server'));

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, 'http://localhost');
  const token = url.searchParams.get('token');

  if (!token) {
    socket.destroy();
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } catch {
    socket.destroy();
  }
});

wss.on('connection', (ws, request) => {
  wss.emit('connection', ws, request);
});

const LEVELDB_PATH = process.env.LEVELDB_PATH || './data';
const persistence = setupPersistence(LEVELDB_PATH);
setPersistence(persistence);

server.listen(process.env.PORT || 1234, () => {
  console.log(`Collab server on port ${process.env.PORT || 1234}`);
});
