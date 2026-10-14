const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStore } = require('../demo-store');
const { io: connect } = require('socket.io-client');

test('creates an auction, validates price increments, and records a bid without a database', () => {
  const store = createStore(() => 1000);
  const auction = store.createAuction({ title: 'Test camera', description: 'A camera', category: 'Electronics', price: '10.50', duration: 15 }, 'Seller');
  assert.equal(auction.currentPrice, 1050);
  assert.throws(() => store.placeBid(auction.id, 10, 'Buyer'), /at least/);
  assert.throws(() => store.placeBid(auction.id, 20, 'Seller'), /own auction/);
  const bid = store.placeBid(auction.id, 15.50, 'Buyer');
  assert.equal(bid.currentPrice, 1550);
  assert.equal(bid.leader, 'Buyer');
  assert.equal(store.snapshot().activity[0].kind, 'bid');
});

test('rejects invalid auctions and ended bids without changing state', () => {
  let time = 1000;
  const store = createStore(() => time);
  assert.throws(() => store.createAuction({ title: '', duration: 15, price: 10 }, 'Seller'));
  assert.throws(() => store.placeBid('sample-1', -5, 'Buyer'));
  assert.throws(() => store.placeBid('sample-1', 'not money', 'Buyer'));
  assert.throws(() => store.placeBid('sample-1', 100, ''));
  time += 100000000;
  assert.throws(() => store.placeBid('sample-1', 100, 'Buyer'), /ended/);
  assert.equal(store.snapshot().activity.length, 0);
});

test('serves the UI and broadcasts an accepted bid to two connected clients', async () => {
  const { server, io } = require('../app');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const clients = [connect(url, { transports: ['websocket'] }), connect(url, { transports: ['websocket'] })];
  try {
    assert.match(await (await fetch(url)).text(), /Your next great find/);
    const health = await (await fetch(url + '/health')).json();
    assert.equal(health.databaseRequired, false);
    await Promise.all(clients.map(client => new Promise((resolve, reject) => {
      if (client.connected) return resolve();
      client.once('connect', resolve); client.once('connect_error', reject);
    })));
    const broadcast = new Promise(resolve => clients[1].on('state', state => {
      if (state.auctions.find(item => item.id === 'sample-1')?.leader === 'Test buyer') resolve(state);
    }));
    const reply = await new Promise((resolve, reject) => clients[0].timeout(5000).emit('auction:bid', { id: 'sample-1', amount: 90, bidder: 'Test buyer' }, (error, result) => error ? reject(error) : resolve(result)));
    assert.equal(reply.ok, true);
    const state = await broadcast;
    assert.equal(state.auctions.find(item => item.id === 'sample-1').currentPrice, 9000);
  } finally { clients.forEach(client => client.disconnect()); await new Promise(resolve => io.close(resolve)); }
});
