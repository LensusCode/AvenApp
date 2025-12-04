require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const { createClient } = require("@libsql/client"); 
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs'); 
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

// --- INTEGRACIÓN CLOUDINARY ---
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();

// =======================================================
// SOLUCIÓN AL ERROR DE RENDER (Trust Proxy)
// =======================================================
app.set('trust proxy', 1); 
// Esto permite a Express leer la IP real del usuario a través 
// del proxy de Render, necesario para 'express-rate-limit'.

const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURACIÓN DE VARIABLES ---
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; 
const JWT_SECRET = process.env.JWT_SECRET; 
const GIPHY_API_KEY = process.env.GIPHY_API_KEY; 

// --- CONFIGURACIÓN CLOUDINARY ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 1. Storage para IMÁGENES (Avatar y Chat)
const imageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'social-network/images', 
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp'],
    }
});

// 2. Storage para AUDIOS
const audioStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'social-network/audios',
        resource_type: 'video', 
        allowed_formats: ['mp3', 'wav', 'ogg', 'webm', 'm4a']
    }
});

const uploadImage = multer({ storage: imageStorage });
const uploadAudio = multer({ storage: audioStorage });

// --- HELMET CSP (SEGURIDAD) ---
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"], 
            scriptSrcAttr: ["'unsafe-inline'"], 
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "blob:", "https://*.giphy.com", "https://media.giphy.com", "https://*.turso.io", "https://res.cloudinary.com"], 
            mediaSrc: ["'self'", "blob:", "data:", "https://res.cloudinary.com"], 
            connectSrc: ["'self'", "https://*.giphy.com", "ws:", "wss:", "data:", "https://*.turso.io"], 
            upgradeInsecureRequests: null,
        },
    },
    crossOriginEmbedderPolicy: false
}));

// --- MIDDLEWARE EXPRESS ---
app.use(express.json({ limit: '10kb' })); 
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/ping', (req, res) => res.status(200).send('Pong'));

// --- RATE LIMITING ---
// Ahora funcionará correctamente gracias a 'trust proxy'
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 20, 
    message: { error: "Demasiados intentos. Inténtalo más tarde." },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 100, 
    message: { error: "Límite de peticiones excedido." }
});

app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/', apiLimiter); 

// --- ENCRIPTACIÓN ---
function encrypt(text) {
    if (!text) return '';
    try {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return iv.toString('hex') + ':' + authTag + ':' + encrypted;
    } catch (e) { 
        console.error("Error encriptando:", e.message); 
        return ''; 
    }
}

function decrypt(text) {
    if (!text) return '';
    try {
        const parts = text.split(':');
        if (parts.length !== 3) return '[Formato ilegible]';
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error("Fallo desencriptación:", error.message);
        return '[Mensaje ilegible]';
    }
}

// ==========================================
// --- BASE DE DATOS (TURSO / LIBSQL) ---
// ==========================================

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Adaptador para simular sqlite3
const db = {
    run: function(sql, params, callback) {
        if (typeof params === 'function') { callback = params; params = []; }
        params = params || [];
        client.execute({ sql, args: params })
            .then((result) => {
                const context = { lastID: Number(result.lastInsertRowid), changes: result.rowsAffected };
                if (callback) callback.call(context, null);
            })
            .catch((err) => { if (callback) callback(err); else console.error("Error DB (run):", err.message); });
    },
    get: function(sql, params, callback) {
        if (typeof params === 'function') { callback = params; params = []; }
        params = params || [];
        client.execute({ sql, args: params })
            .then((result) => { if (callback) callback(null, result.rows[0]); })
            .catch((err) => { if (callback) callback(err); else console.error("Error DB (get):", err.message); });
    },
    all: function(sql, params, callback) {
        if (typeof params === 'function') { callback = params; params = []; }
        params = params || [];
        client.execute({ sql, args: params })
            .then((result) => { if (callback) callback(null, result.rows); })
            .catch((err) => { if (callback) callback(err); else console.error("Error DB (all):", err.message); });
    },
    serialize: function(callback) { if(callback) callback(); },
    prepare: function(sql) { return { run: (...args) => db.run(sql, args), finalize: () => {} } }
};

console.log('Conectado a Turso (LibSQL).');

// INICIALIZACIÓN DE TABLAS
async function initDatabase() {
    try {
        await client.execute(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, avatar TEXT)`);
        await client.execute(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, from_user_id INTEGER, to_user_id INTEGER, content TEXT, type TEXT DEFAULT 'text', reply_to_id INTEGER, is_deleted INTEGER DEFAULT 0, caption TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        await client.execute(`CREATE TABLE IF NOT EXISTS nicknames (user_id INTEGER, target_user_id INTEGER, nickname TEXT, PRIMARY KEY (user_id, target_user_id))`);
        await client.execute(`CREATE TABLE IF NOT EXISTS favorite_stickers (user_id INTEGER, sticker_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, sticker_url))`);
        await client.execute(`CREATE TABLE IF NOT EXISTS hidden_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, message_id INTEGER, UNIQUE(user_id, message_id))`);

        const addColumnSafe = async (table, columnDef) => {
            try { await client.execute(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`); } catch (error) {}
        };

        await addColumnSafe('users', 'is_admin INTEGER DEFAULT 0');
        await addColumnSafe('users', 'is_verified INTEGER DEFAULT 0');
        await addColumnSafe('users', 'is_premium INTEGER DEFAULT 0');
        await addColumnSafe('users', 'display_name TEXT');
        await addColumnSafe('users', 'bio TEXT');
        await addColumnSafe('messages', 'is_pinned INTEGER DEFAULT 0');
        await addColumnSafe('messages', 'is_edited INTEGER DEFAULT 0');

        console.log("✅ Base de datos verificada.");
    } catch (error) { console.error("❌ Error DB Init:", error); }
}
initDatabase();

// --- MIDDLEWARE AUTH ---
const authenticateToken = (req, res, next) => {
    const token = req.cookies.chat_token;
    if (!token) return res.status(401).json({ error: 'Acceso denegado' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.clearCookie('chat_token');
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user; 
        next();
    });
};

// --- EMISIÓN DE USUARIOS ---
function emitUsers() {
    db.all(`SELECT id, username, display_name, bio, avatar, is_verified, is_admin, is_premium FROM users`, (err, rows) => {
        if (err) return;
        const onlineUserIds = new Set();
        if (io.of("/")) {
            for (let [id, socket] of io.of("/").sockets) {
                if (socket.data.userId) onlineUserIds.add(socket.data.userId);
            }
        }
        const users = rows.map(row => ({
            userId: row.id,
            username: row.username,
            display_name: row.display_name,
            bio: row.bio,
            avatar: row.avatar || '/profile.png',
            online: onlineUserIds.has(row.id),
            is_verified: row.is_verified,
            is_admin: row.is_admin,
            is_premium: row.is_premium 
        }));
        io.emit('users', users);
    });
}

// ================= RUTAS API =================

app.post('/api/check-username', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Vacío' });
    db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, row) => {
        if (err) return res.status(500).json({ error: "DB Error" });
        res.json({ available: !row });
    });
});

app.post('/api/register', (req, res) => {
    const { username, password, firstName, lastName } = req.body;
    if(!username || !password || !firstName || !lastName) return res.status(400).json({error: 'Datos incompletos'});
    if(password.length < 8) return res.status(400).json({error: 'Contraseña corta'});
    if(username.length > 20) return res.status(400).json({error: 'Usuario largo'});
    
    const hash = bcrypt.hashSync(password, 10);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    db.run(`INSERT INTO users (username, password, avatar, display_name) VALUES (?, ?, ?, ?)`, 
    [username, hash, '/profile.png', fullName], function(err) {
        if (err) return res.status(400).json({ error: 'Usuario existe' });
        res.json({ id: this.lastID });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const SUPER_ADMIN_ENV = process.env.SUPER_ADMIN_USER; 

    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
        if (err || !row || !bcrypt.compareSync(password, row.password)) {
            return res.status(400).json({ error: 'Credenciales incorrectas' });
        }
        
        if (SUPER_ADMIN_ENV && row.username === SUPER_ADMIN_ENV && row.is_admin !== 1) {
            db.run(`UPDATE users SET is_admin = 1, is_verified = 1 WHERE id = ?`, [row.id]);
            row.is_admin = 1; row.is_verified = 1;
        }

        const token = jwt.sign({ id: row.id, username: row.username, is_admin: row.is_admin }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('chat_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });

        res.json({ success: true, user: { id: row.id, username: row.username, display_name: row.display_name, bio: row.bio, avatar: row.avatar || '/profile.png', is_admin: row.is_admin, is_verified: row.is_verified, is_premium: row.is_premium } });
    });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('chat_token');
    res.json({ success: true });
});

app.get('/api/me', authenticateToken, (req, res) => {
    db.get(`SELECT id, username, display_name, bio, avatar, is_admin, is_verified, is_premium FROM users WHERE id = ?`, [req.user.id], (err, row) => {
        if(row) res.json(row);
        else res.status(401).json({error: 'No encontrado'});
    });
});

app.put('/api/profile/update', authenticateToken, (req, res) => {
    const { field, value } = req.body;
    const allowedFields = ['username', 'display_name', 'bio'];
    if (!allowedFields.includes(field)) return res.status(400).json({ error: 'Campo inválido' });
    let finalValue = value ? value.trim() : '';
    if (field === 'username' && (finalValue.length < 3 || finalValue.length > 20)) return res.status(400).json({ error: 'Usuario: 3-20 caracteres' });

    db.run(`UPDATE users SET ${field} = ? WHERE id = ?`, [finalValue, req.user.id], function(err) {
        if (err) return res.status(400).json({ error: 'Error o usuario duplicado' });
        emitUsers();
        res.json({ success: true, field, value: finalValue });
    });
});

// --- RUTAS DE SUBIDA (MODIFICADAS PARA CLOUDINARY) ---

// 1. SUBIDA DE AVATAR
app.post('/api/upload-avatar', authenticateToken, uploadImage.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió imagen' });

    try {
        let avatarUrl = req.file.path;
        const splitUrl = avatarUrl.split('/upload/');
        if (splitUrl.length === 2) {
            avatarUrl = `${splitUrl[0]}/upload/w_500,h_500,c_fill,g_face/${splitUrl[1]}`;
        }

        db.run(`UPDATE users SET avatar = ? WHERE id = ?`, [avatarUrl, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: 'Error DB' });
            io.emit('user_updated_profile', { userId: req.user.id, avatar: avatarUrl });
            res.json({ avatarUrl });
        });
    } catch (error) {
        console.error("Error Avatar:", error);
        res.status(500).json({ error: 'Error procesando avatar' });
    }
});

// 2. SUBIDA DE IMAGEN CHAT
app.post('/api/upload-chat-image', authenticateToken, uploadImage.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió imagen' });
    res.json({ imageUrl: req.file.path });
});

// 3. SUBIDA DE AUDIO
app.post('/api/upload-audio', authenticateToken, uploadAudio.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió audio' });
    res.json({ audioUrl: req.file.path });
});

app.post('/api/admin/toggle-verify', authenticateToken, (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'No autorizado' });
    db.run(`UPDATE users SET is_verified = 1 - is_verified WHERE id = ?`, [req.body.targetUserId], function(err) {
        if (err) return res.status(500).json({ error: 'Error' });
        emitUsers(); res.json({ success: true });
    });
});

app.post('/api/admin/toggle-premium', authenticateToken, (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'No autorizado' });
    db.run(`UPDATE users SET is_premium = 1 - IFNULL(is_premium, 0) WHERE id = ?`, [req.body.targetUserId], function(err) {
        if (err) return res.status(500).json({ error: 'Error DB' });
        emitUsers(); res.json({ success: true });
    });
});

app.get('/api/messages/:myId/:otherId', authenticateToken, (req, res) => {
    const { myId, otherId } = req.params;
    if (parseInt(myId) !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'No autorizado' });

    db.get(`SELECT is_admin FROM users WHERE id = ?`, [myId], (err, userRow) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        const isAdmin = userRow && userRow.is_admin === 1;
        
        let sqlCondition = `((m.from_user_id = ? AND m.to_user_id = ?) OR (m.from_user_id = ? AND m.to_user_id = ?))`;
        if (!isAdmin) sqlCondition += ` AND m.is_deleted = 0`;

        const sql = `
            SELECT m.*, r.content as reply_content, r.type as reply_type, r.from_user_id as reply_from_id 
            FROM messages m 
            LEFT JOIN messages r ON m.reply_to_id = r.id 
            LEFT JOIN hidden_messages h ON h.message_id = m.id AND h.user_id = ? 
            WHERE ${sqlCondition} AND h.id IS NULL 
            ORDER BY m.timestamp ASC
        `;

        db.all(sql, [myId, myId, otherId, otherId, myId], (err, rows) => {
            if (err) return res.status(500).json({ error: 'Error DB' });
            const decryptedRows = rows.map(row => ({
                ...row,
                content: decrypt(row.content),
                reply_content: row.reply_content ? decrypt(row.reply_content) : null,
                caption: row.caption ? decrypt(row.caption) : null,
            }));
            res.json(decryptedRows);
        });
    });
});

app.get('/api/stickers-proxy', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        if (!process.env.GIPHY_API_KEY) return res.status(500).json({ error: 'Falta API Key' });
        const url = `https://api.giphy.com/v1/stickers/${q ? 'search' : 'trending'}?api_key=${process.env.GIPHY_API_KEY}&limit=24&rating=g&q=${encodeURIComponent(q || '')}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Giphy API error`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error Stickers:", error.message);
        res.status(500).json({ error: 'Error interno' });
    }
});
app.post('/api/favorites/add', authenticateToken, (req, res) => {
    db.run(`INSERT OR IGNORE INTO favorite_stickers (user_id, sticker_url) VALUES (?, ?)`, [req.user.id, req.body.url], (err) => res.json({success: !err}));
});
app.post('/api/favorites/remove', authenticateToken, (req, res) => {
    db.run(`DELETE FROM favorite_stickers WHERE user_id = ? AND sticker_url = ?`, [req.user.id, req.body.url], (err) => res.json({success: !err}));
});
app.get('/api/favorites/:userId', authenticateToken, (req, res) => {
    if (parseInt(req.params.userId) !== req.user.id) return res.status(403).json({error: 'No autorizado'});
    db.all(`SELECT sticker_url FROM favorite_stickers WHERE user_id = ? ORDER BY created_at DESC`, [req.user.id], (err, rows) => res.json(rows ? rows.map(r => r.sticker_url) : []));
});

// --- SOCKET.IO ---
io.use((socket, next) => {
    const cookieHeader = socket.request.headers.cookie;
    if (!cookieHeader) return next(new Error("No autorizado"));
    const cookies = {};
    cookieHeader.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        cookies[parts.shift().trim()] = decodeURI(parts.join('='));
    });
    const token = cookies['chat_token'];
    if (!token) return next(new Error("No autorizado"));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error("Token inválido"));
        socket.data.userId = decoded.id; 
        socket.data.username = decoded.username;
        socket.data.isAdmin = decoded.is_admin;
        next();
    });
});

io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(`user_${userId}`);
    let msgCount = 0; setInterval(() => { msgCount = 0; }, 1000);

    db.get(`SELECT avatar FROM users WHERE id = ?`, [userId], (err, row) => { if(row) socket.data.avatar = row.avatar; emitUsers(); });
    db.all(`SELECT target_user_id, nickname FROM nicknames WHERE user_id = ?`, [userId], (err, rows) => {
        if(!err && rows) { const map = {}; rows.forEach(r => map[r.target_user_id] = r.nickname); socket.emit('nicknames', map); }
    });

    socket.on('set nickname', ({ targetUserId, nickname }) => {
        if(!targetUserId || (nickname && nickname.length > 50)) return;
        if(!nickname || !nickname.trim()) db.run(`DELETE FROM nicknames WHERE user_id = ? AND target_user_id = ?`, [userId, targetUserId]);
        else db.run(`INSERT OR REPLACE INTO nicknames (user_id, target_user_id, nickname) VALUES (?, ?, ?)`, [userId, targetUserId, nickname.trim()]);
    });

    socket.on('private message', ({ content, toUserId, type = 'text', replyToId = null, caption = null }, callback) => {
        if (msgCount > 5) return; msgCount++;
        if (!toUserId || !content) return;
        if (!['text','image','audio','sticker'].includes(type)) type = 'text';

        const encryptedContent = encrypt(content);
        const encryptedCaption = caption ? encrypt(caption) : null;

        db.run(`INSERT INTO messages (from_user_id, to_user_id, content, type, reply_to_id, caption) VALUES (?, ?, ?, ?, ?, ?)`, 
        [userId, toUserId, encryptedContent, type, replyToId, encryptedCaption],
            function(err) {
                if (err) return;
                const newMessageId = this.lastID; 
                const emitMsg = (replyData) => {
                    const payload = {
                        id: newMessageId, content: content, type: type, fromUserId: userId, timestamp: new Date().toISOString(), caption: caption,
                        replyToId: replyToId, reply_content: replyData ? replyData.content : null, reply_type: replyData ? replyData.type : null, reply_from_id: replyData ? replyData.from_user_id : null
                    };
                    socket.to(`user_${toUserId}`).emit('private message', payload);
                    if (callback) callback(payload);
                };
                if(replyToId) {
                    db.get(`SELECT content, type, from_user_id FROM messages WHERE id = ?`, [replyToId], (err, row) => {
                        if(row) emitMsg({ ...row, content: decrypt(row.content) }); else emitMsg(null);
                    });
                } else emitMsg(null);
            }
        );
    });

    socket.on('delete message', ({ messageId, toUserId, deleteType }) => {
        const userId = socket.data.userId;
        const isAdmin = socket.data.isAdmin;

        if (deleteType === 'everyone') {
            let query = `UPDATE messages SET is_deleted = 1 WHERE id = ?`;
            let params = [messageId];
            if (!isAdmin) { query += ` AND from_user_id = ?`; params.push(userId); }

            db.run(query, params, function(err) {
                if (!err && this.changes > 0) {
                    socket.to(`user_${toUserId}`).emit('message deleted', { messageId });
                    socket.emit('message deleted', { messageId });
                }
            });
        } else if (deleteType === 'me') {
            db.run(`INSERT OR IGNORE INTO hidden_messages (user_id, message_id) VALUES (?, ?)`, [userId, messageId], (err)=>{});
        }
    });

    socket.on('clear chat history', ({ toUserId, deleteType }) => {
        const userId = socket.data.userId;
        const targetId = parseInt(toUserId);
        if (!targetId) return;

        if (deleteType === 'everyone') {
            const sqlUpdate = `UPDATE messages SET is_deleted = 1 WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)`;
            db.run(sqlUpdate, [userId, targetId, targetId, userId], function(err) {
                if (!err) {
                    socket.emit('chat history cleared', { chatId: targetId });
                    socket.to(`user_${targetId}`).emit('chat history cleared', { chatId: userId });
                }
            });
        } else {
            const sqlGet = `SELECT id FROM messages WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)`;
            db.all(sqlGet, [userId, targetId, targetId, userId], (err, rows) => {
                if (rows && rows.length > 0) {
                    rows.forEach(row => db.run(`INSERT OR IGNORE INTO hidden_messages (user_id, message_id) VALUES (?, ?)`, [userId, row.id]));
                    socket.emit('chat history cleared', { chatId: targetId });
                }
            });
        }
    });

    socket.on('pin message', ({ messageId, toUserId, type }) => {
        // 1. Primero, desfijar cualquier mensaje anterior en este chat (lógica Telegram: solo 1 a la vez)
        // Nota: Asumimos chat 1 a 1.
        
        const myId = socket.data.userId;
        
        // Query para resetear todos los pines entre estos dos usuarios
        const resetSql = `UPDATE messages SET is_pinned = 0 WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)`;
        
        db.run(resetSql, [myId, toUserId, toUserId, myId], (err) => {
            if (err) return;

            // 2. Si hay un ID (Fijar nuevo), actualizamos ese mensaje
            if (messageId) {
                db.run(`UPDATE messages SET is_pinned = 1 WHERE id = ?`, [messageId], (err2) => {
                    if (!err2) {
                        // Obtener contenido para enviar al cliente
                        db.get(`SELECT content, type, caption FROM messages WHERE id = ?`, [messageId], (err3, row) => {
                            if (row) {
                                // Desencriptar si usas tu función decrypt()
                                const cleanContent = decrypt(row.content); // Asegúrate de tener acceso a decrypt aquí
                                const payload = { 
                                    messageId, 
                                    content: row.type === 'text' ? cleanContent : (row.caption ? decrypt(row.caption) : 'Archivo adjunto'), 
                                    type: row.type 
                                };
                                
                                // Emitir a ambos
                                socket.emit('chat pinned update', payload);
                                socket.to(`user_${toUserId}`).emit('chat pinned update', payload);
                            }
                        });
                    }
                });
            } else {
                // 3. Si messageId es null, es DESFIJAR todo
                const payload = { messageId: null };
                socket.emit('chat pinned update', payload);
                socket.to(`user_${toUserId}`).emit('chat pinned update', payload);
            }
        });
    });
    app.get('/api/pinned-message/:otherId', authenticateToken, (req, res) => {
    const myId = req.user.id;
    const otherId = req.params.otherId;

    // Buscamos un mensaje que esté fijado (is_pinned = 1) entre estos dos usuarios
    const sql = `
        SELECT id, content, type, caption 
        FROM messages 
        WHERE ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
        AND is_pinned = 1 
        LIMIT 1
    `;

    db.get(sql, [myId, otherId, otherId, myId], (err, row) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        
        if (row) {
            // Desencriptamos si es necesario (usando tu función decrypt existente)
            const cleanContent = decrypt(row.content);
            const cleanCaption = row.caption ? decrypt(row.caption) : null;
            
            res.json({ 
                found: true, 
                messageId: row.id,
                content: row.type === 'text' ? cleanContent : (cleanCaption || 'Archivo adjunto'),
                type: row.type
            });
        } else {
            res.json({ found: false });
        }
    });
});

socket.on('edit message', ({ messageId, newContent, toUserId }) => {
        const myId = socket.data.userId;

        // 1. Verificar propiedad y tiempo (Seguridad en Servidor)
        db.get(`SELECT from_user_id, timestamp FROM messages WHERE id = ?`, [messageId], (err, row) => {
            if (err || !row) return;

            // Solo el dueño edita
            if (row.from_user_id !== myId) return;

            // Verificar 24 horas
            const msgTime = new Date(row.timestamp).getTime(); // Asegúrate de que timestamp sea compatible con Date
            const now = Date.now();
            const hoursDiff = (now - msgTime) / (1000 * 60 * 60);

            if (hoursDiff > 24) return; // Rechazar si pasó el tiempo

            // 2. Encriptar nuevo contenido
            const encryptedContent = encrypt(newContent);

            // 3. Actualizar DB
            db.run(`UPDATE messages SET content = ?, is_edited = 1 WHERE id = ?`, [encryptedContent, messageId], (err) => {
                if (!err) {
                    // 4. Emitir evento
                    const payload = {
                        messageId,
                        newContent: newContent, // Enviamos texto plano al cliente
                        isEdited: 1
                    };
                    
                    socket.emit('message updated', payload);
                    socket.to(`user_${toUserId}`).emit('message updated', payload);
                }
            });
        });
    });

    socket.on('typing', ({ toUserId }) => socket.to(`user_${toUserId}`).emit('typing', { fromUserId: userId, username: socket.data.username }));
    socket.on('stop typing', ({ toUserId }) => socket.to(`user_${toUserId}`).emit('stop typing', { fromUserId: userId }));
    socket.on('disconnect', () => { emitUsers(); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Servidor seguro en http://localhost:${PORT}`); });