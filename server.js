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
const storyRoutes = require('./routes/storyRoutes');

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
                imgSrc: ["'self'", "data:", "blob:", "https://*.giphy.com", "https://media.giphy.com", "https://*.turso.io", "https://res.cloudinary.com", "https://i.pravatar.cc"],
                mediaSrc: ["'self'", "blob:", "data:", "https://res.cloudinary.com"],
                connectSrc: ["'self'", "https://*.giphy.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "ws:", "wss:", "data:", "https://*.turso.io"],
                upgradeInsecureRequests: null,
            },
        },
        crossOriginEmbedderPolicy: false
    }));

    app.use(express.json({ limit: '10kb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'public')));

    app.get('/ping', (req, res) => res.status(200).send('Pong'));

    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/admin', require('./routes/adminRoutes'));
    app.use('/api/channels', channelRoutes);
    app.use('/api/messages', messageRoutes);
    app.use('/api/contacts', contactRoutes);
    app.use('/api/stories', storyRoutes);
    app.use('/api/emojis', require('./routes/emojiRoutes'));

    app.get('/admin', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    });
    app.get('/login', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    });

    app.get([
        /^\/\+[a-f0-9]+$/i,
        /^\/[a-zA-Z0-9_]{3,}$/
    ], (req, res) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path === '/login' || req.path === '/ping') {
            return res.status(404).send('Not found');
        }
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    initSocket(server);

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => { console.log(`Servidor seguro en http://localhost:${PORT}`); });
})();