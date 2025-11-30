require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
sharp.cache(false);
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURACIÓN ---
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; 
const JWT_SECRET = process.env.JWT_SECRET; 
const GIPHY_API_KEY = process.env.GIPHY_API_KEY; 

// --- HELMET CSP ---
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"], 
            scriptSrcAttr: ["'unsafe-inline'"], 
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "blob:", "https://*.giphy.com", "https://media.giphy.com"],
            mediaSrc: ["'self'", "blob:", "data:"], 
            connectSrc: ["'self'", "https://*.giphy.com", "ws:", "wss:", "data:"], 
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

// --- MULTER ---
const tempDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix);
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// --- BASE DE DATOS ---
const dbPath = path.join(__dirname, 'chat.db');
const db = new sqlite3.Database(dbPath, (err) => { 
    if (err) console.error(err.message);
    else console.log('Conectado a la base de datos SQLite.');
});

// INICIALIZACIÓN DE TABLAS
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, avatar TEXT)`);
    
    // Columnas adicionales
    db.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN is_premium INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN display_name TEXT`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN bio TEXT`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, from_user_id INTEGER, to_user_id INTEGER, content TEXT, type TEXT DEFAULT 'text', reply_to_id INTEGER, is_deleted INTEGER DEFAULT 0, caption TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS nicknames (user_id INTEGER, target_user_id INTEGER, nickname TEXT, PRIMARY KEY (user_id, target_user_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS favorite_stickers (user_id INTEGER, sticker_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, sticker_url))`);
    
    // [NUEVO] TABLA PARA MENSAJES OCULTOS "ELIMINAR PARA MÍ"
    db.run(`CREATE TABLE IF NOT EXISTS hidden_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, message_id INTEGER, UNIQUE(user_id, message_id))`);
});

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
    
    if(!username || !password || !firstName || !lastName) {
        return res.status(400).json({error: 'Todos los campos son obligatorios'});
    }
    if(password.length < 8) return res.status(400).json({error: 'Mínimo 8 caracteres'});
    if(username.length > 20) return res.status(400).json({error: 'Usuario muy largo'});
    
    const hash = bcrypt.hashSync(password, 10);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    db.run(`INSERT INTO users (username, password, avatar, display_name) VALUES (?, ?, ?, ?)`, 
    [username, hash, '/profile.png', fullName], function(err) {
        if (err) {
            console.error(err);
            return res.status(400).json({ error: 'El usuario ya existe' });
        }
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

        res.cookie('chat_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ 
            success: true,
            user: { 
                id: row.id, 
                username: row.username, 
                display_name: row.display_name,
                bio: row.bio,
                avatar: row.avatar || '/profile.png', 
                is_admin: row.is_admin, 
                is_verified: row.is_verified,
                is_premium: row.is_premium
            } 
        });
    });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('chat_token');
    res.json({ success: true });
});

app.get('/api/me', authenticateToken, (req, res) => {
    db.get(`SELECT id, username, display_name, bio, avatar, is_admin, is_verified, is_premium FROM users WHERE id = ?`, [req.user.id], (err, row) => {
        if(row) res.json(row);
        else res.status(401).json({error: 'Usuario no encontrado'});
    });
});

app.put('/api/profile/update', authenticateToken, (req, res) => {
    const { field, value } = req.body;
    const allowedFields = ['username', 'display_name', 'bio'];
    
    if (!allowedFields.includes(field)) return res.status(400).json({ error: 'Campo inválido' });

    let finalValue = value ? value.trim() : '';
    
    if (field === 'username') {
        if (finalValue.length < 3 || finalValue.length > 20) return res.status(400).json({ error: 'Usuario: 3-20 caracteres' });
    }
    if (field === 'display_name' && finalValue.length > 30) return res.status(400).json({ error: 'Nombre muy largo' });
    if (field === 'bio' && finalValue.length > 150) return res.status(400).json({ error: 'Biografía muy larga' });

    db.run(`UPDATE users SET ${field} = ? WHERE id = ?`, [finalValue, req.user.id], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Usuario en uso' });
            return res.status(500).json({ error: 'Error DB' });
        }
        emitUsers();
        res.json({ success: true, field, value: finalValue });
    });
});

// --- SUBIDA DE ARCHIVOS ---

// RUTA SUBIDA AVATAR (CORREGIDA)
app.post('/api/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Faltan datos' });
    const tempFilePath = req.file.path;
    const dir = './public/uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const filename = `avatar-${req.user.id}-${Date.now()}.jpeg`;
    const finalPath = path.join(dir, filename);
    
    try {
        await sharp(tempFilePath)
            .resize(500, 500, { fit: 'cover' })
            .toFormat('jpeg')
            .jpeg({ quality: 80 })
            .toFile(finalPath);

        // Usamos unlink asíncrono para que no tumbe el servidor si hay error
        fs.unlink(tempFilePath, (err) => {
            if (err) console.error("Advertencia al borrar temp:", err.message);
        });

        const avatarUrl = `/uploads/${filename}`;
        db.run(`UPDATE users SET avatar = ? WHERE id = ?`, [avatarUrl, req.user.id], (err) => {
            if (err) return res.status(500).json({error: 'Error interno'});
            io.emit('user_updated_profile', { userId: req.user.id, avatar: avatarUrl });
            res.json({ avatarUrl });
        });
    } catch (error) { 
        console.error("Error procesando avatar:", error);
        // Intentar borrar incluso si falló el proceso
        fs.unlink(tempFilePath, () => {}); 
        res.status(500).json({ error: 'Error procesando imagen' }); 
    }
});

// RUTA SUBIDA IMAGEN CHAT (CORREGIDA)
app.post('/api/upload-chat-image', authenticateToken, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No hay imagen' });
    const tempFilePath = req.file.path;
    const dir = './public/uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const filename = `chat-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpeg`;
    const finalPath = path.join(dir, filename);
    
    try {
        await sharp(tempFilePath)
            .resize(1024, 1024, { fit: 'inside' })
            .toFormat('jpeg')
            .jpeg({ quality: 80 })
            .toFile(finalPath);
            
        // Usamos unlink asíncrono para evitar el crash EBUSY
        fs.unlink(tempFilePath, (err) => {
            if (err) console.error("Advertencia al borrar temp:", err.message);
        });

        res.json({ imageUrl: `/uploads/${filename}` });
    } catch (error) { 
        console.error("Error procesando imagen chat:", error);
        fs.unlink(tempFilePath, () => {});
        res.status(500).json({ error: 'Error procesando imagen' }); 
    }
});

app.post('/api/upload-audio', authenticateToken, upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No hay audio' });
    const tempFilePath = req.file.path;

    try {
        const bufferHeader = Buffer.alloc(4);
        const fd = fs.openSync(tempFilePath, 'r');
        fs.readSync(fd, bufferHeader, 0, 4, 0);
        fs.closeSync(fd);
        const header = bufferHeader.toString('hex').toLowerCase();
        let ext = '';
        if (header === '1a45dfa3') ext = 'webm';
        else if (header.startsWith('494433') || header.startsWith('fff')) ext = 'mp3';
        else if (header === '4f676753') ext = 'ogg';
        else if (header === '52494646') ext = 'wav';

        if (!ext) {
            fs.unlinkSync(tempFilePath);
            return res.status(400).json({ error: 'Formato no válido' });
        }
        const filename = `audio-${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
        const finalPath = path.join('./public/uploads', filename);
        fs.renameSync(tempFilePath, finalPath);
        res.json({ audioUrl: `/uploads/${filename}` });
    } catch (e) {
        if(fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        res.status(500).json({error: "Error subiendo audio"});
    }
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
        if (err) {
            console.error("Error toggling premium:", err.message);
            return res.status(500).json({ error: 'Error DB' });
        }
        emitUsers(); 
        res.json({ success: true });
    });
});

// [MODIFICADO] RUTA OBTENER MENSAJES (Ahora filtra los "ocultos para mí")
app.get('/api/messages/:myId/:otherId', authenticateToken, (req, res) => {
    const { myId, otherId } = req.params;
    if (parseInt(myId) !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'No autorizado' });

    db.get(`SELECT is_admin FROM users WHERE id = ?`, [myId], (err, userRow) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        const isAdmin = userRow && userRow.is_admin === 1;
        
        let sqlCondition = `((m.from_user_id = ? AND m.to_user_id = ?) OR (m.from_user_id = ? AND m.to_user_id = ?))`;
        
        // Si NO es admin, ocultamos los eliminados globalmente
        if (!isAdmin) sqlCondition += ` AND m.is_deleted = 0`;

        // [MODIFICADO] SQL: LEFT JOIN con hidden_messages para filtrar los que borré "para mí"
        const sql = `
            SELECT m.*, r.content as reply_content, r.type as reply_type, r.from_user_id as reply_from_id 
            FROM messages m 
            LEFT JOIN messages r ON m.reply_to_id = r.id 
            LEFT JOIN hidden_messages h ON h.message_id = m.id AND h.user_id = ? 
            WHERE ${sqlCondition} 
            AND h.id IS NULL 
            ORDER BY m.timestamp ASC
        `;

        // Añadimos myId como primer parámetro para el join de hidden_messages
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
        const apiKey = process.env.GIPHY_API_KEY;

        if (!apiKey) {
            console.error("❌ ERROR: Falta GIPHY_API_KEY en el archivo .env");
            return res.status(500).json({ error: 'Configuración de servidor incompleta' });
        }

        const url = `https://api.giphy.com/v1/stickers/${q ? 'search' : 'trending'}?api_key=${apiKey}&limit=24&rating=g&q=${encodeURIComponent(q || '')}`;

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Giphy API respondió: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error("❌ ERROR en /api/stickers-proxy:", error.message);
        res.status(500).json({ error: 'Error interno obteniendo stickers' });
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
        if (!toUserId || !content || typeof content !== 'string' || content.length > 10000) return;
        if (type !== 'text' && type !== 'image' && type !== 'audio' && type !== 'sticker') type = 'text';

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

    // [MODIFICADO] EVENTO DELETE MESSAGE
    socket.on('delete message', ({ messageId, toUserId, deleteType }) => {
        const userId = socket.data.userId;
        const isAdmin = socket.data.isAdmin;

        if (deleteType === 'everyone') {
            // CASO 1: Eliminar para todos (Global)
            // Solo permitido si eres admin o el dueño del mensaje
            let query = `UPDATE messages SET is_deleted = 1 WHERE id = ?`;
            let params = [messageId];

            if (!isAdmin) {
                // Restricción extra para usuarios normales
                query += ` AND from_user_id = ?`;
                params.push(userId);
            }

            db.run(query, params, function(err) {
                if (!err && this.changes > 0) {
                    // Notificar a AMBOS (emisor y receptor)
                    socket.to(`user_${toUserId}`).emit('message deleted', { messageId });
                    socket.emit('message deleted', { messageId });
                }
            });

        } else if (deleteType === 'me') {
            // CASO 2: Eliminar para mí (Local)
            // Simplemente lo ocultamos insertando en hidden_messages
            db.run(`INSERT OR IGNORE INTO hidden_messages (user_id, message_id) VALUES (?, ?)`, [userId, messageId], function(err) {
                if(err) console.error("Error hidden_msg:", err);
                // NO emitimos al otro usuario.
                // El frontend del que solicitó ya lo borró visualmente.
            });
        }
    });
    socket.on('clear chat history', ({ toUserId, deleteType }) => {
    const userId = socket.data.userId;   // Tu ID
    const targetId = parseInt(toUserId); // El ID del otro

    if (!targetId) return;

    if (deleteType === 'everyone') {
        // --- CASO 1: ELIMINAR PARA TODOS ---
        const sqlUpdate = `
            UPDATE messages 
            SET is_deleted = 1 
            WHERE (from_user_id = ? AND to_user_id = ?) 
               OR (from_user_id = ? AND to_user_id = ?)
        `;
        
        db.run(sqlUpdate, [userId, targetId, targetId, userId], function(err) {
            if (!err) {
                // 1. Notificar al EMISOR (Tú): "Limpia el chat con targetId"
                socket.emit('chat history cleared', { chatId: targetId });

                // 2. Notificar al RECEPTOR (El otro): "Limpia el chat con userId"
                socket.to(`user_${targetId}`).emit('chat history cleared', { chatId: userId });
            }
        });

    } else {
        // --- CASO 2: ELIMINAR PARA MÍ ---
        const sqlGet = `SELECT id FROM messages WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)`;
        
        db.all(sqlGet, [userId, targetId, targetId, userId], (err, rows) => {
            if (rows && rows.length > 0) {
                const stmt = db.prepare(`INSERT OR IGNORE INTO hidden_messages (user_id, message_id) VALUES (?, ?)`);
                rows.forEach(row => {
                    stmt.run(userId, row.id);
                });
                stmt.finalize();
                
                // Solo te notificamos a ti (Tú limpias tu pantalla, el otro no)
                socket.emit('chat history cleared', { chatId: targetId });
            }
        });
    }
});

    // --- SOCKET: ALGUIEN VACIÓ EL CHAT ---
socket.on('chat history cleared', ({ chatId }) => {
    console.log("Evento recibido para limpiar chat con ID:", chatId);

    // 1. Verificamos si tengo abierto un chat
    // 2. Verificamos si el chat abierto es el mismo que se acaba de vaciar
    if (currentTargetUserId && parseInt(currentTargetUserId) === parseInt(chatId)) {
        
        // --- AQUÍ OCURRE LA MAGIA SIN RECARGAR ---
        const messagesList = document.getElementById('messages');
        
        // Efecto visual de desvanecimiento antes de borrar (Opcional, se ve pro)
        messagesList.style.opacity = '0';
        messagesList.style.transition = 'opacity 0.3s ease';

        setTimeout(() => {
            // Borrar todo el HTML de la lista de mensajes
            messagesList.innerHTML = '';
            
            // Añadir mensaje de sistema
            const li = document.createElement('li');
            li.style.cssText = 'text-align:center; color:#666; margin:20px; font-size:12px; font-weight:500; list-style:none; opacity:0; animation: fadeIn 0.5s forwards;';
            li.textContent = 'El historial del chat ha sido vaciado.';
            messagesList.appendChild(li);

            // Restaurar opacidad
            messagesList.style.opacity = '1';
            
            // Ocultar botón de scroll si existía
            const scrollBtn = document.getElementById('scrollToBottomBtn');
            if(scrollBtn) scrollBtn.classList.add('hidden');

        }, 300); // Espera 300ms a que termine la transición
    }
});

    socket.on('typing', ({ toUserId }) => socket.to(`user_${toUserId}`).emit('typing', { fromUserId: userId, username: socket.data.username }));
    socket.on('stop typing', ({ toUserId }) => socket.to(`user_${toUserId}`).emit('stop typing', { fromUserId: userId }));
    socket.on('disconnect', () => { emitUsers(); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Servidor seguro en http://localhost:${PORT}`); });