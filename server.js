require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { initDatabase, fixChannelTables, migrateExistingMessagesToContacts } = require('./src/models/schema');
const { initSocket } = require('./src/sockets/socketManager');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const channelRoutes = require('./src/routes/channelRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const contactRoutes = require('./src/routes/contactRoutes');
const storyRoutes = require('./src/routes/storyRoutes');

const app = express();
const server = http.createServer(app);

// Init DB and start server
(async () => {
    await initDatabase();
    await fixChannelTables();

    setTimeout(() => {
        migrateExistingMessagesToContacts().catch(err => {
            console.error('Migration error (non-fatal):', err.message);
        });
    }, 1000);

    app.set('trust proxy', 1);

    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
                scriptSrcElem: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
                scriptSrcAttr: ["'none'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
                imgSrc: ["'self'", "data:", "blob:", "https://*.giphy.com", "https://media.giphy.com", "https://*.turso.io", "https://res.cloudinary.com", "https://i.pravatar.cc", "https://raw.githubusercontent.com"],
                mediaSrc: ["'self'", "blob:", "data:", "https://res.cloudinary.com"],
                connectSrc: ["'self'", "https://*.giphy.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "ws:", "wss:", "data:", "https://*.turso.io", "https://res.cloudinary.com", "https://raw.githubusercontent.com", "https://i.pravatar.cc"],
                upgradeInsecureRequests: null,
            },
        },
        crossOriginEmbedderPolicy: false
    }));

    // CORS Middleware for Mobile App
    app.use((req, res, next) => {
        const allowedOrigins = [
            'https://localhost',
            'capacitor://localhost',
            'http://localhost',
            'http://localhost:3000',
            'http://localhost:5173'
        ];
        const origin = req.headers.origin;
        if (allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }

        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
        res.header('Access-Control-Allow-Credentials', 'true');

        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });

    const publicDir = process.env.NODE_ENV === 'production'
        ? path.join(__dirname, 'dist', 'public')
        : path.join(__dirname, 'public');

    app.use(express.json({ limit: '10kb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(express.static(publicDir));

    const { apiLimiter } = require('./src/middleware/rateLimiter');
    app.use('/api/', apiLimiter);

    app.get('/ping', (req, res) => res.status(200).send('Pong'));

    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/admin', require('./src/routes/adminRoutes'));
    app.use('/api/channels', channelRoutes);
    app.use('/api/messages', messageRoutes);
    app.use('/api/contacts', contactRoutes);
    app.use('/api/stories', storyRoutes);
    app.use('/api/emojis', require('./src/routes/emojiRoutes'));
    app.use('/api/stickers-proxy', require('./src/routes/stickerRoutes'));

    app.get('/admin', (req, res) => {
        res.sendFile(path.join(publicDir, 'admin.html'));
    });
    app.get('/login', (req, res) => {
        res.sendFile(path.join(publicDir, 'login.html'));
    });

    app.get([
        /^\/\+[a-f0-9]+$/i,
        /^\/[a-zA-Z0-9_]{3,}$/
    ], (req, res) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path === '/login' || req.path === '/ping') {
            return res.status(404).send('Not found');
        }
        res.sendFile(path.join(publicDir, 'index.html'));
    });

    initSocket(server);

    const PORT = process.env.PORT || 3000;
    server.listen(PORT);
})();