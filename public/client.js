(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
  let state = { auctions: [], activity: [] }, view = 'all', category = 'All', selectedId = '', offset = 0, name = '';
  try { name = localStorage.getItem('bidroom-name') || ''; } catch {}
  const socket = typeof io === 'function' ? io({ transports: ['websocket'], reconnection: true }) : null;
  function identity(value) {
    name = value.trim().slice(0, 32);
    try { localStorage.setItem('bidroom-name', name); } catch {}
    $('identity-label').textContent = name || 'Your display name';
    $('avatar').textContent = name ? name[0].toUpperCase() : 'Y';
    render();
  }
  identity(name);
  function now() { return Date.now() + offset; }
  function remaining(end) {
    const seconds = Math.max(0, Math.floor((end - now()) / 1000));
    if (!seconds) return 'Ended';
    const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), rest = seconds % 60;
    return `${hours ? hours + 'h ' : ''}${minutes}m ${String(rest).padStart(2, '0')}s`;
  }
  function art(kind) {
    const drawings = {
      headphones: '<path d="M67 111V75a43 43 0 0 1 86 0v36" fill="none" stroke="#303b39" stroke-width="13"/><path d="M67 95V75a43 43 0 0 1 86 0v20" fill="none" stroke="#636f68" stroke-width="5"/><rect x="49" y="83" width="28" height="63" rx="13" fill="#343c39"/><rect x="56" y="88" width="22" height="55" rx="10" fill="#87918a"/><rect x="144" y="83" width="28" height="63" rx="13" fill="#343c39"/><rect x="142" y="88" width="22" height="55" rx="10" fill="#87918a"/>',
      camera: '<path d="M34 67h42l9-15h40l12 15h44a9 9 0 0 1 9 9v69a9 9 0 0 1-9 9H34a9 9 0 0 1-9-9V76a9 9 0 0 1 9-9" fill="#383b3d"/><rect x="30" y="75" width="158" height="68" rx="6" fill="#555657"/><rect x="34" y="76" width="27" height="68" rx="5" fill="#292d30"/><circle cx="113" cy="110" r="42" fill="#25292c"/><circle cx="113" cy="110" r="32" fill="#777b79"/><circle cx="113" cy="110" r="28" fill="#17242a"/><circle cx="113" cy="110" r="17" fill="#324a50"/><circle cx="105" cy="100" r="7" fill="#87a2a5" opacity=".7"/><rect x="147" y="77" width="29" height="7" rx="2" fill="#cecebf"/>',
      keyboard: '<g transform="rotate(-12 110 100)"><rect x="20" y="64" width="180" height="85" rx="8" fill="#696774"/><rect x="22" y="60" width="176" height="81" rx="7" fill="#ccc9cd"/>' + Array.from({ length: 36 }, (_, i) => `<rect x="${29 + i % 12 * 13}" y="${69 + Math.floor(i / 12) * 17}" width="11" height="13" rx="2" fill="${i % 9 ? '#f4f1e7' : '#8b92ae'}"/>`).join('') + '<rect x="72" y="121" width="78" height="12" rx="2" fill="#f4f1e7"/></g>',
      watch: '<g transform="rotate(15 110 98)"><rect x="91" y="4" width="38" height="184" rx="10" fill="#53677d"/><path d="M96 4v184m10-184v184m11-184v184m8-184v184" stroke="#72859c" stroke-width="2"/><circle cx="110" cy="96" r="47" fill="#9ea9b0"/><circle cx="110" cy="96" r="41" fill="#faf9f4"/><circle cx="110" cy="96" r="35" fill="none" stroke="#d6dadd" stroke-dasharray="2 15"/><path d="M110 70v26l20 11" fill="none" stroke="#343f51" stroke-width="3" stroke-linecap="round"/><circle cx="110" cy="96" r="4" fill="#354559"/><rect x="156" y="90" width="7" height="14" rx="2" fill="#a7afb6"/></g>',
      bag: '<path d="M53 72h113l14 88H40Z" fill="#b99775"/><path d="M56 77h105l11 76H47Z" fill="#d7b894"/><path d="M77 89V56a32 32 0 0 1 64 0v33" fill="none" stroke="#72543d" stroke-width="8"/><path d="M83 91V57a26 26 0 0 1 52 0v34" fill="none" stroke="#e6d2b7" stroke-width="3"/><rect x="73" y="104" width="65" height="33" rx="2" fill="#c6a27d"/><path d="M40 160h140" stroke="#8a6a4d" stroke-width="4"/>',
      lamp: '<path d="M110 138V73" stroke="#555d49" stroke-width="8"/><ellipse cx="110" cy="146" rx="43" ry="10" fill="#636a54"/><path d="M50 74a60 60 0 0 1 120 0Z" fill="#788265"/><ellipse cx="110" cy="74" rx="60" ry="7" fill="#ccd1ad"/><ellipse cx="110" cy="77" rx="26" ry="4" fill="#f7efc1"/>',
    };
    return `<svg viewBox="0 0 220 190" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${drawings[kind] || drawings.bag}</svg>`;
  }
  let toastTimer;
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4000); }
  function receive(next) {
    if (!next || !Array.isArray(next.auctions)) return;
    offset = next.serverTime - Date.now(); state = next; render();
    if ($('bid-dialog').open) updateBid();
  }
  function render() {
    const live = state.auctions.filter(item => item.endTime > now());
    $('stat-live').textContent = live.length;
    $('nav-count').textContent = live.length;
    $('stat-bids').textContent = name ? state.auctions.reduce((total, item) => total + item.bids.filter(bid => bid.bidder === name).length, 0) : 0;
    $('stat-leading').textContent = name ? live.filter(item => item.leader === name).length : 0;
    const query = $('search').value.trim().toLowerCase();
    let items = state.auctions.filter(item => (category === 'All' || item.category === category) && `${item.title} ${item.description}`.toLowerCase().includes(query));
    if (view === 'all') items = items.filter(item => item.endTime > now());
    if (view === 'bids') items = items.filter(item => name && item.bids.some(bid => bid.bidder === name));
    if (view === 'selling') items = items.filter(item => name && item.seller === name);
    if (view === 'ended') items = items.filter(item => item.endTime <= now());
    const sort = $('sort').value;
    if (sort === 'ending') items.sort((a, b) => a.endTime - b.endTime);
    if (sort === 'price') items.sort((a, b) => a.currentPrice - b.currentPrice);
    const title = { all: 'Live auctions', bids: 'My bids', selling: 'My auctions', ended: 'Ended auctions' }[view];
    $('collection-title').innerHTML = `${title} <span>${items.length}</span>`;
    document.querySelector('.breadcrumb b').textContent = title;
    $('auction-grid').innerHTML = items.map(item => `<article class="auction-card"><div class="product-art" style="background:${/^#[a-f0-9]{6}$/i.test(item.color) ? item.color : '#e8edf2'}"><span class="time-chip" data-end="${item.endTime}">◷ ${remaining(item.endTime)}</span>${art(item.art)}${item.sample ? '<span class="sample-chip">SAMPLE ITEM</span>' : ''}</div><div class="card-info"><div class="card-category">${escape(item.category)}</div><h3>${escape(item.title)}</h3><div class="bid-row"><div><label>${item.bids.length ? 'Current bid' : 'Starting price'}</label><strong class="bid-price">${money(item.currentPrice)}</strong></div><div class="bid-count">${item.bids.length} bid${item.bids.length === 1 ? '' : 's'}${name && item.leader === name ? '<br><span class="leading">You’re leading ↗</span>' : ''}</div></div><button class="card-button" data-bid="${escape(item.id)}">${item.endTime <= now() ? 'View result' : 'View & place bid'} <span>↗</span></button></div></article>`).join('') || `<div class="empty-state"><h3>Nothing here just yet.</h3><p>${view === 'bids' ? 'Place your first bid to see it here.' : view === 'selling' ? 'Create an auction to get started.' : 'Try another category or search.'}</p><button class="primary" data-create>Create auction ↗</button></div>`;
    $('activity').innerHTML = state.activity.slice(0, 6).map(item => `<div class="activity-item"><span class="activity-avatar">${escape(item.bidder[0].toUpperCase())}</span><div><p><b>${escape(item.bidder)}</b> ${item.kind === 'created' ? 'listed' : `bid <b>${money(item.amount)}</b> on`} ${escape(item.title)}</p><small>${new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div></div>`).join('') || '<div class="activity-empty"><span>↗</span>Your move starts here.<br>Place a bid and watch<br>the activity roll in.</div>';
  }
  function openBid(id) {
    selectedId = id;
    const item = state.auctions.find(auction => auction.id === id);
    if (!item) return;
    $('bid-art').style.background = item.color;
    $('bid-art').innerHTML = art(item.art);
    $('bid-title').textContent = item.title;
    $('bid-description').textContent = item.description;
    $('bid-amount').value = ((item.currentPrice + item.increment) / 100).toFixed(2);
    $('bid-name').value = name;
    $('bid-error').textContent = '';
    updateBid(); $('bid-dialog').showModal();
  }
  function updateBid() {
    const item = state.auctions.find(auction => auction.id === selectedId);
    if (!item) { $('bid-dialog').close(); toast('The server session reset. Please select an auction again.'); return; }
    const minimum = (item.currentPrice + item.increment) / 100;
    $('bid-current').textContent = money(item.currentPrice);
    $('bid-time').textContent = remaining(item.endTime);
    $('bid-amount').min = minimum;
    $('bid-minimum').textContent = `Minimum next bid: ${money(item.currentPrice + item.increment)} · $5 increments or more`;
    $('bid-submit').disabled = item.endTime <= now();
    $('bid-history').innerHTML = item.bids.slice(0, 8).map(bid => `<div class="history-row"><span>${escape(bid.bidder)}</span><b>${money(bid.amount)}</b></div>`).join('') || '<p>No bids yet. Be the first.</p>';
  }
  async function command(event, payload) {
    if (socket?.connected) {
      return new Promise((resolve, reject) => socket.timeout(10000).emit(event, payload, (error, reply) => {
        if (error) return reject(new Error('Connection timed out. Check the auction before trying again.'));
        if (!reply?.ok) return reject(new Error(reply?.error || 'Unable to complete this action.'));
        resolve(reply);
      }));
    }
    const endpoint = event === 'auction:create' ? '/api/auctions' : `/api/auctions/${encodeURIComponent(payload.id)}/bids`;
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to complete this action.');
    receive(data.state); return data;
  }
  document.addEventListener('click', event => {
    const create = event.target.closest('[data-create]');
    if (create) { $('create-form').elements.bidder.value = name; $('create-error').textContent = ''; $('create-dialog').showModal(); }
    const bid = event.target.closest('[data-bid]'); if (bid) openBid(bid.dataset.bid);
    const close = event.target.closest('[data-close]'); if (close) $(close.dataset.close).close();
    const nav = event.target.closest('[data-view]');
    if (nav) { view = nav.dataset.view; document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button === nav)); render(); }
    const filter = event.target.closest('[data-category]');
    if (filter) { category = filter.dataset.category; document.querySelectorAll('[data-category]').forEach(button => button.classList.toggle('selected', button === filter)); render(); }
  });
  $('search').addEventListener('input', render); $('sort').addEventListener('change', render);
  $('identity-button').addEventListener('click', () => { $('display-name').value = name; $('identity-dialog').showModal(); });
  $('identity-form').addEventListener('submit', event => { event.preventDefault(); identity($('display-name').value); $('identity-dialog').close(); toast(`Welcome, ${name}.`); });
  $('create-form').addEventListener('submit', async event => {
    event.preventDefault(); const payload = Object.fromEntries(new FormData(event.target));
    $('create-submit').disabled = true; $('create-error').textContent = '';
    try { await command('auction:create', payload); identity(payload.bidder); $('create-dialog').close(); event.target.reset(); toast('Your auction is live.'); }
    catch (error) { $('create-error').textContent = error.message; }
    finally { $('create-submit').disabled = false; }
  });
  $('bid-form').addEventListener('submit', async event => {
    event.preventDefault(); $('bid-submit').disabled = true; $('bid-error').textContent = '';
    try { await command('auction:bid', { id: selectedId, amount: $('bid-amount').value, bidder: $('bid-name').value }); identity($('bid-name').value); $('bid-dialog').close(); toast('Bid placed. You’re in the lead!'); }
    catch (error) { $('bid-error').textContent = error.message; }
    finally { updateBid(); }
  });
  async function poll() {
    if (socket?.connected) return;
    try { const response = await fetch('/api/state', { cache: 'no-store' }); if (!response.ok) throw new Error('Server unavailable'); receive(await response.json()); $('connection').textContent = 'HTTP updates'; $('connection').classList.add('online'); }
    catch { $('connection').textContent = 'Reconnecting…'; $('connection').classList.remove('online'); }
  }
  socket?.on('connect', () => { $('connection').textContent = 'Live connection'; $('connection').classList.add('online'); socket.emit('state:request'); });
  socket?.on('state', receive);
  socket?.on('disconnect', () => { $('connection').textContent = 'Reconnecting…'; $('connection').classList.remove('online'); });
  socket?.on('connect_error', poll);
  poll(); setInterval(poll, 5000);
  setInterval(() => {
    document.querySelectorAll('[data-end]').forEach(element => { element.textContent = '◷ ' + remaining(Number(element.dataset.end)); });
    if ($('bid-dialog').open) $('bid-time').textContent = remaining(state.auctions.find(item => item.id === selectedId)?.endTime || 0);
  }, 1000);
  setInterval(render, 30000);
})();
