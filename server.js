require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { initDatabase, fixChannelTables, migrateExistingMessagesToContacts } = require('./models/schema');
const { initSocket } = require('./sockets/socketManager');

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const channelRoutes = require('./routes/channelRoutes');
const messageRoutes = require('./routes/messageRoutes');
const contactRoutes = require('./routes/contactRoutes');

const app = express();
const server = http.createServer(app);

// Init DB and start server
(async () => {
    await initDatabase();
    await fixChannelTables();

    // Run migration asynchronously without blocking
    setTimeout(() => {
        migrateExistingMessagesToContacts().catch(err => {
            console.error('Migration error (non-fatal):', err.message);
        });
    }, 1000);

    // Proxy Trust
    app.set('trust proxy', 1);

    // Middleware
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
                scriptSrcElem: ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"], // Added explicitly
                scriptSrcAttr: ["'none'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
                imgSrc: ["'self'", "data:", "blob:", "https://*.giphy.com", "https://media.giphy.com", "https://*.turso.io", "https://res.cloudinary.com"],
                mediaSrc: ["'self'", "blob:", "data:", "https://res.cloudinary.com"],
                connectSrc: ["'self'", "https://*.giphy.com", "ws:", "wss:", "data:", "https://*.turso.io"],
                upgradeInsecureRequests: null,
            },
        },
        crossOriginEmbedderPolicy: false
    }));

    app.use(express.json({ limit: '10kb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'public')));

    // Routes
    app.get('/ping', (req, res) => res.status(200).send('Pong'));

    // API Routes
    app.use('/api', authRoutes); // Auth Routes
    app.use('/api', userRoutes);
    app.use('/api/admin', require('./routes/adminRoutes')); // New Admin Routes
    app.use('/api/channels', channelRoutes);
    app.use('/api', messageRoutes);
    app.use('/api/contacts', contactRoutes);

    // Static Files for Admin/Login
    app.get('/admin', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    });
    app.get('/login', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    });

    // Deep Linking
    app.get([
        /^\/\+[a-f0-9]+$/i,       // Private invite: /+hash
        /^\/[a-zA-Z0-9_]{3,}$/    // Public handle: /handle
    ], (req, res) => {
        // Exclude reserved paths just in case regex is too broad (though regex above is decent)
        if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path === '/login' || req.path === '/ping') {
            return res.status(404).send('Not found');
        }
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Socket.io
    initSocket(server);

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => { console.log(`Servidor seguro en http://localhost:${PORT}`); });
})();