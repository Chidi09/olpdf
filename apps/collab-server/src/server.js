require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');
const Y = require('yjs');
const { WebSocketServer } = require('ws');
const { setPersistence, setupWSConnection } = require('y-websocket/bin/utils');
const { LeveldbPersistence } = require('y-leveldb');

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

wss.on('connection', setupWSConnection);

const LEVELDB_PATH = process.env.LEVELDB_PATH || './data';
const persistence = new LeveldbPersistence(LEVELDB_PATH);
setPersistence({
  bindState: async (docName, ydoc) => {
    const persistedYdoc = await persistence.getYDoc(docName);
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));
    ydoc.on('update', (update) => persistence.storeUpdate(docName, update));
  },
  writeState: async () => {},
});

server.listen(process.env.PORT || 1234, () => {
  console.log(`Collab server on port ${process.env.PORT || 1234}`);
});
