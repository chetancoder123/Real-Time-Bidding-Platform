# Source and deployment

Based on https://github.com/Balerion769/-Real-Time-Bidding-Platform, with permission confirmed by the user.
Deployment additions provide a Vercel entry point and health endpoint. Original source attribution is retained.
The source .env file and its history are excluded from this repository to avoid republishing credentials.

This project is an HTTP API, not a browser dashboard. Configure a hosted PostgreSQL database and JWT_SECRET in Vercel before registration, login, item management, or bidding can work.
Use DATABASE_URL or DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, and create the tables documented in README.md.
Socket.IO clients must use transports: ['websocket'] on Vercel's WebSocket runtime.
Cross-instance broadcasts require a shared Socket.IO adapter; the original implementation broadcasts only within one instance.
