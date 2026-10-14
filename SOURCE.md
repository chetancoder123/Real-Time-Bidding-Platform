# Source and deployment

Based on https://github.com/Balerion769/-Real-Time-Bidding-Platform, with permission confirmed by the user.
Deployment additions provide a browser UI, an in-memory demo backend, a Vercel entry point, and a health endpoint. Original source attribution is retained.
The source .env file and its history are excluded from this repository to avoid republishing credentials.

The active demo requires no database, model service, or JWT_SECRET. It supports creating auctions, bidding, category/search filters, display names, and live bid updates.
Auctions and bids are stored in server memory. Server restarts erase them, and different Vercel instances may hold different collections. Clients connected to the same instance receive live broadcasts.
Display names are anonymous demo identities, not secure accounts. No payments are made.
Socket.IO clients must use transports: ['websocket'] on Vercel's WebSocket runtime.
Cross-instance broadcasts and durable history require a shared store. Legacy PostgreSQL controllers remain as upstream reference code but are not loaded by the demo.
