const { io } = require('socket.io-client');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'https://real-time-bidding-platform-omega.vercel.app';
(async () => {
  for (const resource of ['/', '/style.css', '/client.js', '/socket.io/socket.io.js', '/health']) {
    const response = await fetch(base + resource);
    const body = await response.text();
    assert.equal(response.status, 200, resource);
    if (resource === '/') assert.match(body, /Your next great find/);
    console.log(`${resource} HTTP ${response.status}`);
  }
  const socket = io(base, { transports: ['websocket'], reconnection: false, timeout: 15000 });
  const deadline = setTimeout(() => { console.error('WebSocket verification timed out'); socket.close(); process.exit(1); }, 30000);
  try {
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve); socket.once('connect_error', reject);
    });
    const command = (event, payload) => new Promise((resolve, reject) => {
      socket.timeout(10000).emit(event, payload, (error, result) => {
        if (error) return reject(error);
        if (!result.ok) return reject(new Error(result.error));
        resolve(result);
      });
    });
    const created = await command('auction:create', {
      title: 'Deployment verification demo', description: 'Temporary test auction for checking the deployed UI and backend.',
      category: 'Electronics', price: 10, duration: 15, bidder: 'Deployment test seller',
    });
    const bid = await command('auction:bid', { id: created.auction.id, amount: 15, bidder: 'Deployment test buyer' });
    assert.equal(bid.auction.currentPrice, 1500);
    assert.equal(bid.auction.leader, 'Deployment test buyer');
    console.log('LIVE PASS: WebSocket connected, auction created, bid accepted ($15).');
  } finally { clearTimeout(deadline); socket.close(); }
})().catch(error => { console.error(error.message); process.exit(1); });
