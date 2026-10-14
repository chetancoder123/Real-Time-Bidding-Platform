const { randomUUID } = require('node:crypto');
function text(value, label, max = 80) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${label} must contain 1–${max} characters.`);
  return value.trim();
}
function cents(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 1000000) throw new Error('Enter a price between $0.01 and $1,000,000.');
  return Math.round(number * 100);
}
function createStore(now = () => Date.now()) {
  const started = now();
  const seeds = [
    ['Studio headphones', 'Electronics', 85, 3900000, 'Warm sound. Clean lines. Studio headphones in excellent condition.', 'headphones', '#e7eee8'],
    ['Mirrorless camera', 'Electronics', 420, 7200000, 'A compact camera for your next adventure. Includes a lens and carry strap.', 'camera', '#eee8de'],
    ['Mechanical keyboard', 'Electronics', 65, 5100000, 'A tactile, compact keyboard with ivory keycaps and a detachable cable.', 'keyboard', '#e6e5ef'],
    ['Everyday timepiece', 'Collectibles', 120, 9000000, 'Minimal dial, stainless steel case, and a comfortable woven strap.', 'watch', '#e8edf2'],
    ['Weekend carryall', 'Lifestyle', 55, 14400000, 'Room for the essentials. Durable canvas with thoughtful details.', 'bag', '#efe6e0'],
    ['Desk companion', 'Lifestyle', 35, 10800000, 'A sculptural desk lamp with a focused, warm light for your workspace.', 'lamp', '#ececda'],
  ];
  const auctions = seeds.map(([title, category, price, duration, description, art, color], index) => ({
    id: `sample-${index + 1}`, title, category, description, art, color, startingPrice: cents(price),
    currentPrice: cents(price), increment: 500, endTime: started + duration, seller: 'Demo collection', leader: null, bids: [], sample: true,
  }));
  const activity = [];
  function snapshot() { return JSON.parse(JSON.stringify({ auctions, activity, serverTime: now(), storage: 'temporary-memory' })); }
  function createAuction(payload, bidder) {
    const seller = text(bidder, 'Display name', 32);
    if (!payload || typeof payload !== 'object') throw new Error('Invalid auction.');
    const title = text(payload.title, 'Title');
    const category = ['Electronics', 'Collectibles', 'Lifestyle'].includes(payload.category) ? payload.category : 'Lifestyle';
    const duration = Number(payload.duration);
    if (![15, 60, 180, 1440].includes(duration)) throw new Error('Select a valid duration.');
    const price = cents(payload.price);
    if (auctions.length >= 100) throw new Error('This demo has reached its 100-auction limit.');
    const auction = {
      id: randomUUID(), title, category, description: text(payload.description, 'Description', 500),
      art: category === 'Electronics' ? 'headphones' : category === 'Collectibles' ? 'watch' : 'bag', color: '#e8edf2',
      startingPrice: price, currentPrice: price, increment: 500, endTime: now() + duration * 60000,
      seller, leader: null, bids: [], sample: false,
    };
    auctions.unshift(auction);
    activity.unshift({ id: randomUUID(), kind: 'created', title, bidder: seller, time: now() });
    activity.splice(40);
    return JSON.parse(JSON.stringify(auction));
  }
  function placeBid(id, value, bidder) {
    const name = text(bidder, 'Display name', 32);
    const auction = auctions.find(item => item.id === id);
    if (!auction) throw new Error('This auction is no longer available. Refresh the page.');
    if (auction.endTime <= now()) throw new Error('This auction has ended.');
    if (auction.seller === name) throw new Error('You cannot bid on your own auction.');
    const amount = cents(value);
    if (amount < auction.currentPrice + auction.increment) throw new Error(`The next bid must be at least $${((auction.currentPrice + auction.increment) / 100).toFixed(2)}.`);
    const bid = { id: randomUUID(), bidder: name, amount, time: now() };
    auction.bids.unshift(bid); auction.bids.splice(100);
    auction.currentPrice = amount; auction.leader = name;
    activity.unshift({ ...bid, kind: 'bid', title: auction.title }); activity.splice(40);
    return JSON.parse(JSON.stringify(auction));
  }
  return { snapshot, createAuction, placeBid };
}
module.exports = { createStore };
