const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const createUserRoutes = require('./routes/userRoutes');
const createItemRoutes = require('./routes/itemRoutes');
const createBidRoutes = require('./routes/bidRoutes');
const createNotificationRoutes = require('./routes/notificationRoutes');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

const databaseConfigured = Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
if (databaseConfigured) db.connect((err, client, release) => {
    if (err) {
        console.error('Database connection error:', err.stack);
    } else {
        console.log('Database connected');
        release();
    }
});

app.use(express.json());
app.use(cookieParser());
app.get('/health', (req, res) => res.json({ status: 'ok', databaseConfigured }));
app.get('/', (req, res) => res.json({
    service: 'Real-Time Bidding Platform API',
    databaseConfigured,
    endpoints: ['/health', '/users/register', '/users/login', '/users/profile', '/items', '/bids', '/notifications'],
    note: databaseConfigured ? 'API server is running.' : 'Set DATABASE_URL and JWT_SECRET in Vercel to enable database-backed features.'
}));
app.use((req, res, next) => {
    if (!databaseConfigured) return res.status(503).json({ error: 'Database is not configured. Set DATABASE_URL in Vercel.' });
    next();
});

app.use('/users', createUserRoutes(db));
app.use('/items', createItemRoutes(db));
app.use('/bids', createBidRoutes(db, io));
app.use('/notifications', createNotificationRoutes(db));

io.on('connection', (socket) => {
    console.log('New client connected');
    socket.on('bid', (data) => {
        io.emit('update', data);
    });
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = { db, io, server };
