const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');
const { createStore } = require('./demo-store');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { transports: ['websocket'], maxHttpBufferSize: 16384 });
const store = createStore();
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (req, res) => res.json({ status: 'ok', storage: 'temporary-memory', databaseRequired: false }));
app.get('/api/state', (req, res) => res.json(store.snapshot()));
app.post('/api/auctions', (req, res) => {
  try {
    const auction = store.createAuction(req.body, req.body.bidder);
    io.emit('state', store.snapshot());
    res.status(201).json({ auction, state: store.snapshot() });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
app.post('/api/auctions/:id/bids', (req, res) => {
  try {
    const auction = store.placeBid(req.params.id, req.body.amount, req.body.bidder);
    io.emit('state', store.snapshot());
    res.json({ auction, state: store.snapshot() });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
io.on('connection', socket => {
  socket.emit('state', store.snapshot());
  socket.on('state:request', () => socket.emit('state', store.snapshot()));
  socket.on('auction:create', (payload, reply) => {
    try {
      const auction = store.createAuction(payload, payload?.bidder);
      io.emit('state', store.snapshot());
      if (typeof reply === 'function') reply({ ok: true, auction });
    } catch (error) { if (typeof reply === 'function') reply({ ok: false, error: error.message }); }
  });
  socket.on('auction:bid', (payload, reply) => {
    try {
      const auction = store.placeBid(payload?.id, payload?.amount, payload?.bidder);
      io.emit('state', store.snapshot());
      if (typeof reply === 'function') reply({ ok: true, auction });
    } catch (error) { if (typeof reply === 'function') reply({ ok: false, error: error.message }); }
  });
});
if (require.main === module) server.listen(process.env.PORT || 3000);
module.exports = { app, server, io, store };
